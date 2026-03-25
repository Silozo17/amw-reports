import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { connection_id, month, year } = await req.json();
    connectionId = connection_id;

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

    if (!conn.is_connected || !conn.access_token) {
      throw new Error("Connection is not authenticated. Please connect via OAuth first.");
    }

    // Get org_id from client
    const { data: clientData } = await supabase.from("clients").select("org_id").eq("id", clientId).single();
    const orgId = clientData?.org_id;

    const { data: syncLog } = await supabase
      .from("sync_logs")
      .insert({ client_id: clientId, platform: "tiktok", status: "running", report_month: month, report_year: year, org_id: orgId })
      .select("id")
      .single();

    const accessToken = conn.access_token;
    const advertiserId = conn.account_id;

    if (!advertiserId) {
      throw new Error("No advertiser ID found. Please reconnect TikTok.");
    }

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Fetch campaign-level report
    const reportRes = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify({
          advertiser_id: advertiserId,
          report_type: "BASIC",
          dimensions: ["campaign_id"],
          data_level: "AUCTION_CAMPAIGN",
          metrics: ["spend", "impressions", "clicks", "conversion", "ctr", "cpc", "cpm", "reach", "video_play_actions", "average_video_play", "video_watched_2s", "video_watched_6s", "profile_visits_rate"],
          start_date: startDate,
          end_date: endDate,
          page_size: 500,
        }),
      }
    );

    const reportData = await reportRes.json();
    console.log("TikTok report response code:", reportData.code);

    if (reportData.code !== 0) {
      throw new Error(reportData.message || "TikTok reporting API error");
    }

    const rows = reportData.data?.list || [];

    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalReach = 0;
    let totalVideoPlays = 0;
    let totalAvgWatchTime = 0;

    const campaigns: any[] = [];

    for (const row of rows) {
      const m = row.metrics || {};
      const spend = Number(m.spend || 0);
      const impressions = Number(m.impressions || 0);
      const clicks = Number(m.clicks || 0);
      const conversions = Number(m.conversion || 0);
      const reach = Number(m.reach || 0);

      totalSpend += spend;
      totalImpressions += impressions;
      totalClicks += clicks;
      totalConversions += conversions;
      totalReach += reach;
      totalVideoPlays += Number(m.video_play_actions || 0);
      totalAvgWatchTime += Number(m.average_video_play || 0);

      campaigns.push({
        id: row.dimensions?.campaign_id,
        spend, impressions, clicks, conversions, reach,
        ctr: Number(m.ctr || 0),
        cpc: Number(m.cpc || 0),
        cpm: Number(m.cpm || 0),
      });
    }

    const metricsData = {
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      reach: totalReach,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
      cost_per_conversion: totalConversions > 0 ? totalSpend / totalConversions : 0,
      video_views: totalVideoPlays,
      average_watch_time: campaigns.length > 0 ? totalAvgWatchTime / campaigns.length : 0,
      campaign_count: campaigns.length,
    };

    const topContent = campaigns
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);

    // Upsert monthly snapshot
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "tiktok")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    if (existing) {
      await supabase.from("monthly_snapshots").update({ metrics_data: metricsData, top_content: topContent, raw_data: { campaigns } }).eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({ client_id: clientId, platform: "tiktok", report_month: month, report_year: year, metrics_data: metricsData, top_content: topContent, raw_data: { campaigns } });
    }

    await supabase.from("platform_connections").update({ last_sync_at: new Date().toISOString(), last_sync_status: "success", last_error: null }).eq("id", connectionId);

    if (syncLog?.id) {
      await supabase.from("sync_logs").update({ status: "success", completed_at: new Date().toISOString() }).eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData, campaigns_synced: campaigns.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("TikTok sync error:", e);
    if (connectionId) {
      await supabase.from("platform_connections").update({ last_sync_status: "failed", last_error: e instanceof Error ? e.message : "Unknown error" }).eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
