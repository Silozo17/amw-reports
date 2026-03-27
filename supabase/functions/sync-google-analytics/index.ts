import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
        platform: "google_analytics",
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

    const propertyId = conn.account_id;
    if (!propertyId) {
      throw new Error("No GA4 property selected. Please select a property in the Account Picker.");
    }

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Main metrics report
    const reportRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: "sessions" },
            { name: "activeUsers" },
            { name: "newUsers" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
            { name: "screenPageViewsPerSession" },
          ],
        }),
      }
    );

    if (!reportRes.ok) {
      const errText = await reportRes.text();
      throw new Error(`GA4 API error (${reportRes.status}): ${errText.substring(0, 300)}`);
    }

    const reportData = await reportRes.json();
    const values = reportData.rows?.[0]?.metricValues || [];

    const metricsData = {
      sessions: Number(values[0]?.value || 0),
      active_users: Number(values[1]?.value || 0),
      new_users: Number(values[2]?.value || 0),
      ga_page_views: Number(values[3]?.value || 0),
      bounce_rate: Number(values[4]?.value || 0),
      avg_session_duration: Number(values[5]?.value || 0),
      pages_per_session: Number(values[6]?.value || 0),
    };

    // Top pages
    let topPages: any[] = [];
    try {
      const pagesRes = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: "pagePath" }],
            metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
            limit: 20,
            orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          }),
        }
      );
      const pagesData = await pagesRes.json();
      topPages = (pagesData.rows || []).map((r: any) => ({
        page: r.dimensionValues?.[0]?.value,
        views: Number(r.metricValues?.[0]?.value || 0),
        users: Number(r.metricValues?.[1]?.value || 0),
      }));
    } catch (e) {
      console.warn("Could not fetch top pages:", e);
    }

    // Traffic sources
    let trafficSources: any[] = [];
    try {
      const srcRes = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: "sessionDefaultChannelGroup" }],
            metrics: [{ name: "sessions" }, { name: "activeUsers" }],
            limit: 10,
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          }),
        }
      );
      const srcData = await srcRes.json();
      trafficSources = (srcData.rows || []).map((r: any) => ({
        source: r.dimensionValues?.[0]?.value,
        sessions: Number(r.metricValues?.[0]?.value || 0),
        users: Number(r.metricValues?.[1]?.value || 0),
      }));
    } catch (e) {
      console.warn("Could not fetch traffic sources:", e);
    }

    const topContent = [
      ...topPages.map((p: any) => ({ type: "page", ...p })),
      ...trafficSources.map((s: any) => ({ type: "source", ...s })),
    ];

    // Upsert snapshot
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "google_analytics")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    if (existing) {
      await supabase.from("monthly_snapshots")
        .update({ metrics_data: metricsData, top_content: topContent, raw_data: { topPages, trafficSources } })
        .eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "google_analytics",
        report_month: month,
        report_year: year,
        metrics_data: metricsData,
        top_content: topContent,
        raw_data: { topPages, trafficSources },
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
