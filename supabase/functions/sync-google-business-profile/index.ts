import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken, decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SyncRequest {
  connection_id: string;
  month: number;
  year: number;
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let connectionId = "";
  let clientId = "";

  try {
    const body: SyncRequest = await req.json();
    connectionId = body.connection_id;
    const { month, year } = body;

    if (!connectionId || !month || !year) {
      return new Response(
        JSON.stringify({ error: "connection_id, month, and year are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: conn, error: connError } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !conn) {
      return new Response(
        JSON.stringify({ error: "Connection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    clientId = conn.client_id;

    if (!conn.is_connected || !conn.refresh_token) {
      return new Response(
        JSON.stringify({ error: "Connection is not authenticated." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get org_id from client
    const { data: clientData } = await supabase.from("clients").select("org_id").eq("id", clientId).single();
    const orgId = clientData?.org_id;

    // Verify requesting user belongs to the client's org
    const authHeader = req.headers.get("Authorization");
    if (authHeader && orgId) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabase.auth.getUser(token);
      if (caller) {
        const { data: membership } = await supabase.from("org_members").select("id").eq("user_id", caller.id).eq("org_id", orgId).limit(1).single();
        if (!membership) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }


    const { data: syncLog } = await supabase
      .from("sync_logs")
      .insert({
        client_id: clientId,
        platform: "google_business_profile",
        status: "running",
        report_month: month,
        report_year: year,
        org_id: orgId,
      })
      .select("id")
      .single();

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    let accessToken = conn.access_token;
    const tokenExpiry = conn.token_expires_at ? new Date(conn.token_expires_at) : new Date(0);
    if (tokenExpiry <= new Date()) {
      const refreshed = await refreshAccessToken(conn.refresh_token, googleClientId, googleClientSecret);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase.from("platform_connections").update({ access_token: accessToken, token_expires_at: newExpiry }).eq("id", connectionId);
    }

    const locationId = conn.account_id;
    if (!locationId) {
      throw new Error("No location selected. Please select a business location in the Account Picker.");
    }

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Fetch daily metrics time series
    const dailyMetrics = [
      "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
      "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
      "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
      "CALL_CLICKS",
      "WEBSITE_CLICKS",
      "BUSINESS_DIRECTION_REQUESTS",
    ];

    let totalViews = 0;
    let totalSearches = 0;
    let totalCalls = 0;
    let totalWebsiteClicks = 0;
    let totalDirections = 0;

    for (const metric of dailyMetrics) {
      try {
        const metricRes = await fetch(
          `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries?dailyMetric=${metric}&dailyRange.startDate.year=${year}&dailyRange.startDate.month=${month}&dailyRange.startDate.day=1&dailyRange.endDate.year=${year}&dailyRange.endDate.month=${month}&dailyRange.endDate.day=${lastDay}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!metricRes.ok) {
          const errBody = await metricRes.text();
          console.warn(`GBP metric ${metric} failed (${metricRes.status}):`, errBody);
          continue;
        }

        const metricData = await metricRes.json();
        const dataPoints = metricData.timeSeries?.datedValues || [];
        const total = dataPoints.reduce((sum: number, dp: any) => sum + Number(dp.value || 0), 0);

        if (metric.includes("IMPRESSIONS")) {
          if (metric.includes("SEARCH")) totalSearches += total;
          else totalViews += total;
        } else if (metric === "CALL_CLICKS") totalCalls += total;
        else if (metric === "WEBSITE_CLICKS") totalWebsiteClicks += total;
        else if (metric === "BUSINESS_DIRECTION_REQUESTS") totalDirections += total;
      } catch (e) {
        console.warn(`Could not fetch GBP metric ${metric}:`, e);
      }
    }

    // Total views = maps + search views
    const gbpViews = totalViews + totalSearches;

    // TODO: Reviews API — the v4 mybusiness.googleapis.com endpoint was deprecated (sunset March 2023).
    // Google has not yet released a public v1 replacement for reviews.
    // Setting to null so the dashboard can distinguish "no data" from "zero reviews."
    const reviewsCount: number | null = null;
    const avgRating: number | null = null;

    const metricsData = {
      gbp_views: gbpViews,
      gbp_searches: totalSearches,
      gbp_calls: totalCalls,
      gbp_direction_requests: totalDirections,
      gbp_website_clicks: totalWebsiteClicks,
      gbp_reviews_count: reviewsCount,
      gbp_average_rating: avgRating,
    };

    // Upsert snapshot
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "google_business_profile")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    if (existing) {
      await supabase.from("monthly_snapshots")
        .update({ metrics_data: metricsData, raw_data: { dailyMetrics: metricsData } })
        .eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "google_business_profile",
        report_month: month,
        report_year: year,
        metrics_data: metricsData,
        raw_data: { dailyMetrics: metricsData },
      });
    }

    await supabase.from("platform_connections").update({
      last_sync_at: new Date().toISOString(), last_sync_status: "success", last_error: null,
    }).eq("id", connectionId);

    if (syncLog?.id) {
      await supabase.from("sync_logs").update({ status: "success", completed_at: new Date().toISOString() }).eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Sync error:", e);
    if (connectionId) {
      await supabase.from("platform_connections").update({
        last_sync_status: "failed", last_error: e instanceof Error ? e.message : "Unknown error",
      }).eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
