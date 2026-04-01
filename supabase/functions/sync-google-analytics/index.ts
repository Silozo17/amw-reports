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

async function runGA4Report(
  propertyId: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<any> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GA4 API error (${res.status}): ${errText.substring(0, 300)}`);
  }
  return res.json();
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
    const dateRanges = [{ startDate, endDate }];

    // ── Run all reports in parallel ──────────────────────────────
    const [mainReport, pagesReport, sourcesReport, geoReport, cityReport, deviceReport, newVsRetReport, landingReport] = await Promise.all([
      // 1. Main metrics (expanded with 3 new metrics)
      runGA4Report(propertyId, accessToken, {
        dateRanges,
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "newUsers" },
          { name: "screenPageViews" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
          { name: "screenPageViewsPerSession" },
          { name: "totalUsers" },
          { name: "engagedSessions" },
          { name: "engagementRate" },
        ],
      }),
      // 2. Top pages
      runGA4Report(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
        limit: 20,
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      }).catch((e) => { console.warn("Top pages fetch failed:", e); return null; }),
      // 3. Traffic sources
      runGA4Report(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        limit: 10,
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }).catch((e) => { console.warn("Traffic sources fetch failed:", e); return null; }),
      // 4. Geographic (country)
      runGA4Report(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "country" }, { name: "countryId" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        limit: 50,
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      }).catch((e) => { console.warn("Geo country fetch failed:", e); return null; }),
      // 5. Geographic (city)
      runGA4Report(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "city" }, { name: "country" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        limit: 30,
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      }).catch((e) => { console.warn("Geo city fetch failed:", e); return null; }),
      // 6. Device category
      runGA4Report(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      }).catch((e) => { console.warn("Device fetch failed:", e); return null; }),
      // 7. New vs Returning
      runGA4Report(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "newVsReturning" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      }).catch((e) => { console.warn("New vs returning fetch failed:", e); return null; }),
      // 8. Landing pages
      runGA4Report(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [{ name: "sessions" }, { name: "bounceRate" }],
        limit: 20,
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }).catch((e) => { console.warn("Landing pages fetch failed:", e); return null; }),
    ]);

    // ── Parse main metrics ───────────────────────────────────────
    const values = mainReport.rows?.[0]?.metricValues || [];
    const metricsData: Record<string, number> = {
      sessions: Number(values[0]?.value || 0),
      active_users: Number(values[1]?.value || 0),
      new_users: Number(values[2]?.value || 0),
      ga_page_views: Number(values[3]?.value || 0),
      bounce_rate: Number(values[4]?.value || 0),
      avg_session_duration: Number(values[5]?.value || 0),
      pages_per_session: Number(values[6]?.value || 0),
      total_users: Number(values[7]?.value || 0),
      engaged_sessions: Number(values[8]?.value || 0),
      ga_engagement_rate: Number(values[9]?.value || 0),
    };

    // ── Parse top pages ──────────────────────────────────────────
    const topPages = (pagesReport?.rows || []).map((r: any) => ({
      page: r.dimensionValues?.[0]?.value,
      views: Number(r.metricValues?.[0]?.value || 0),
      users: Number(r.metricValues?.[1]?.value || 0),
    }));

    // ── Parse traffic sources ────────────────────────────────────
    const trafficSources = (sourcesReport?.rows || []).map((r: any) => ({
      source: r.dimensionValues?.[0]?.value,
      sessions: Number(r.metricValues?.[0]?.value || 0),
      users: Number(r.metricValues?.[1]?.value || 0),
    }));

    // ── Parse geographic data ────────────────────────────────────
    const geoCountries = (geoReport?.rows || []).map((r: any) => ({
      country: r.dimensionValues?.[0]?.value,
      countryId: r.dimensionValues?.[1]?.value,
      users: Number(r.metricValues?.[0]?.value || 0),
      sessions: Number(r.metricValues?.[1]?.value || 0),
    }));

    const geoCities = (cityReport?.rows || []).map((r: any) => ({
      city: r.dimensionValues?.[0]?.value,
      country: r.dimensionValues?.[1]?.value,
      users: Number(r.metricValues?.[0]?.value || 0),
      sessions: Number(r.metricValues?.[1]?.value || 0),
    }));

    // ── Parse device data ────────────────────────────────────────
    const devices = (deviceReport?.rows || []).map((r: any) => ({
      device: r.dimensionValues?.[0]?.value,
      users: Number(r.metricValues?.[0]?.value || 0),
      sessions: Number(r.metricValues?.[1]?.value || 0),
    }));

    // ── Parse new vs returning ───────────────────────────────────
    const newVsReturning = (newVsRetReport?.rows || []).map((r: any) => ({
      type: r.dimensionValues?.[0]?.value,
      users: Number(r.metricValues?.[0]?.value || 0),
      sessions: Number(r.metricValues?.[1]?.value || 0),
    }));

    // ── Parse landing pages ──────────────────────────────────────
    const landingPages = (landingReport?.rows || []).map((r: any) => ({
      page: r.dimensionValues?.[0]?.value,
      sessions: Number(r.metricValues?.[0]?.value || 0),
      bounceRate: Number(r.metricValues?.[1]?.value || 0),
    }));

    // ── Build top_content (legacy format + new types) ────────────
    const topContent = [
      ...topPages.map((p: any) => ({ type: "page", ...p })),
      ...trafficSources.map((s: any) => ({ type: "source", ...s })),
    ];

    // ── Build raw_data with all new dimension reports ────────────
    const rawData: Record<string, unknown> = {
      topPages,
      trafficSources,
      geoCountries,
      geoCities,
      devices,
      newVsReturning,
      landingPages,
    };

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
        .update({ metrics_data: metricsData, top_content: topContent, raw_data: rawData })
        .eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "google_analytics",
        report_month: month,
        report_year: year,
        metrics_data: metricsData,
        top_content: topContent,
        raw_data: rawData,
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
