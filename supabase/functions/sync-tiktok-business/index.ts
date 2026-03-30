import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3";

interface SyncRequest {
  connection_id: string;
  month: number;
  year: number;
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

    // Get connection details
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
      return new Response(
        JSON.stringify({ error: "Connection is not authenticated. Please connect via OAuth first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!conn.account_id) {
      return new Response(
        JSON.stringify({ error: "No advertiser account selected. Please select an account first." }),
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

    // Create sync log
    const { data: syncLog } = await supabase
      .from("sync_logs")
      .insert({
        client_id: clientId,
        platform: "tiktok_ads",
        status: "running",
        report_month: month,
        report_year: year,
        org_id: orgId,
      })
      .select("id")
      .single();

    const accessToken = conn.access_token;
    const advertiserId = conn.account_id;

    // Build date range
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Fetch reporting data from TikTok Business API
    const reportUrl = new URL(`${TIKTOK_API_BASE}/report/integrated/get/`);
    reportUrl.searchParams.set("advertiser_id", advertiserId);
    reportUrl.searchParams.set("report_type", "BASIC");
    reportUrl.searchParams.set("data_level", "AUCTION_ADVERTISER");
    reportUrl.searchParams.set("dimensions", JSON.stringify(["advertiser_id"]));
    reportUrl.searchParams.set("metrics", JSON.stringify([
      "spend", "impressions", "clicks", "ctr", "cpc", "cpm",
      "conversion", "complete_payment_roas", "reach",
      "video_play_actions", "total_complete_payment_rate",
    ]));
    reportUrl.searchParams.set("start_date", startDate);
    reportUrl.searchParams.set("end_date", endDate);

    const reportRes = await fetch(reportUrl.toString(), {
      headers: {
        "Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    const reportData = await reportRes.json();
    console.log("TikTok Ads report response:", JSON.stringify(reportData));

    if (reportData.code !== 0) {
      throw new Error(`TikTok API error (${reportData.code}): ${reportData.message || "Unknown error"}`);
    }

    // Parse metrics from response
    const rows = reportData.data?.list || [];
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalReach = 0;
    let totalVideoViews = 0;
    let totalConversionsValue = 0;

    for (const row of rows) {
      const metrics = row.metrics || {};
      totalSpend += Number(metrics.spend || 0);
      totalImpressions += Number(metrics.impressions || 0);
      totalClicks += Number(metrics.clicks || 0);
      totalConversions += Number(metrics.conversion || 0);
      totalReach += Number(metrics.reach || 0);
      totalVideoViews += Number(metrics.video_play_actions || 0);
      // complete_payment_roas is a ratio, not a value to sum — calculate from spend
      totalConversionsValue += Number(metrics.complete_payment_roas || 0) * Number(metrics.spend || 0);
    }

    const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const overallCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const overallCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const overallConversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

    const metricsData = {
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: overallCtr,
      cpc: overallCpc,
      cpm: overallCpm,
      conversions: totalConversions,
      conversions_value: totalConversionsValue,
      reach: totalReach,
      video_views: totalVideoViews,
      conversion_rate: overallConversionRate,
    };

    // Upsert monthly snapshot
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "tiktok_ads")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) {
      throw new Error("Snapshot for this period is locked and cannot be overwritten.");
    }

    if (existing) {
      await supabase
        .from("monthly_snapshots")
        .update({
          metrics_data: metricsData,
          top_content: [],
          raw_data: { rows },
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "tiktok_ads",
        report_month: month,
        report_year: year,
        metrics_data: metricsData,
        top_content: [],
        raw_data: { rows },
      });
    }

    // Update connection sync status
    await supabase
      .from("platform_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "success",
        last_error: null,
      })
      .eq("id", connectionId);

    // Update sync log
    if (syncLog?.id) {
      await supabase
        .from("sync_logs")
        .update({ status: "success", completed_at: new Date().toISOString() })
        .eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        metrics: metricsData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("TikTok Ads sync error:", e);

    if (connectionId) {
      await supabase
        .from("platform_connections")
        .update({
          last_sync_status: "failed",
          last_error: e instanceof Error ? e.message : "Unknown error",
        })
        .eq("id", connectionId);
    }

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
