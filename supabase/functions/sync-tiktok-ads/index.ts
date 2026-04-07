import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADS_REPORT_URL = "https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/";

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

    // ── Fetch connection ──
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

    // Decrypt token
    if (conn.access_token) conn.access_token = await decryptToken(conn.access_token);

    if (!conn.is_connected || !conn.access_token) {
      throw new Error("Connection is not authenticated. Please connect via OAuth first.");
    }

    if (!conn.account_id) {
      throw new Error("No advertiser_id found. Please reconnect TikTok Ads.");
    }

    const { data: clientData } = await supabase
      .from("clients")
      .select("org_id")
      .eq("id", clientId)
      .single();
    const orgId = clientData?.org_id;

    // ── Verify requesting user belongs to the client's org ──
    const authHeader = req.headers.get("Authorization");
    if (authHeader && orgId) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabase.auth.getUser(token);
      if (caller) {
        const { data: membership } = await supabase
          .from("org_members")
          .select("id")
          .eq("user_id", caller.id)
          .eq("org_id", orgId)
          .limit(1)
          .single();
        if (!membership) {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // ── Create sync log ──
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

    // ── Build date range for the target month ──
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const accessToken = conn.access_token;
    const advertiserId = conn.account_id;

    // ── Fetch advertiser-level metrics ──
    const metrics = [
      "spend",
      "impressions",
      "clicks",
      "ctr",
      "cpc",
      "cpm",
      "conversion",
      "cost_per_conversion",
      "reach",
      "video_views_p25",
      "video_views_p50",
      "video_views_p75",
      "video_views_p100",
    ];

    const params = new URLSearchParams({
      advertiser_id: advertiserId,
      report_type: "BASIC",
      data_level: "AUCTION_ADVERTISER",
      dimensions: JSON.stringify(["advertiser_id"]),
      metrics: JSON.stringify(metrics),
      start_date: startDate,
      end_date: endDate,
      page: "1",
      page_size: "10",
    });

    console.log(`Fetching TikTok Ads report for advertiser ${advertiserId}, ${startDate} to ${endDate}`);

    const reportRes = await fetch(`${ADS_REPORT_URL}?${params.toString()}`, {
      method: "GET",
      headers: {
        "Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    const reportData = await reportRes.json();
    console.log("TikTok Ads report response code:", reportData.code);

    if (reportData.code !== 0) {
      throw new Error(
        `TikTok Ads API error: ${reportData.message || "Unknown error"} (code: ${reportData.code})`
      );
    }

    const rows = reportData.data?.list || [];
    const row = rows.length > 0 ? rows[0].metrics : {};

    const conversions = Number(row.conversion || 0);
    const clicks = Number(row.clicks || 0);
    const metricsData = {
      spend: Number(row.spend || 0),
      impressions: Number(row.impressions || 0),
      clicks,
      ctr: Number(row.ctr || 0),
      cpc: Number(row.cpc || 0),
      cpm: Number(row.cpm || 0),
      conversions,
      conversion_rate: clicks > 0 ? conversions / clicks : 0,
      cost_per_conversion: Number(row.cost_per_conversion || 0),
      reach: Number(row.reach || 0),
      video_views_p25: Number(row.video_views_p25 || 0),
      video_views_p50: Number(row.video_views_p50 || 0),
      video_views_p75: Number(row.video_views_p75 || 0),
      video_views_p100: Number(row.video_views_p100 || 0),
    };

    console.log("TikTok Ads metrics:", JSON.stringify(metricsData));

    // ── Fetch ad-level breakdown for top content ──
    let topContent: Record<string, unknown>[] = [];
    try {
      const adMetrics = ["ad_name", "spend", "impressions", "clicks", "conversion", "ctr", "cpc", "cpm"];
      const adParams = new URLSearchParams({
        advertiser_id: advertiserId,
        report_type: "BASIC",
        data_level: "AUCTION_AD",
        dimensions: JSON.stringify(["ad_id"]),
        metrics: JSON.stringify(adMetrics),
        start_date: startDate,
        end_date: endDate,
        page: "1",
        page_size: "20",
        order_field: "spend",
        order_type: "DESC",
      });

      const adRes = await fetch(`${ADS_REPORT_URL}?${adParams.toString()}`, {
        method: "GET",
        headers: { "Access-Token": accessToken, "Content-Type": "application/json" },
      });
      const adData = await adRes.json();

      if (adData.code === 0 && adData.data?.list) {
        topContent = adData.data.list.map((item: { dimensions: Record<string, string>; metrics: Record<string, string> }) => ({
          id: item.dimensions?.ad_id || "",
          message: item.metrics?.ad_name || `Ad ${item.dimensions?.ad_id || "unknown"}`,
          spend: Number(item.metrics?.spend || 0),
          impressions: Number(item.metrics?.impressions || 0),
          clicks: Number(item.metrics?.clicks || 0),
          conversions: Number(item.metrics?.conversion || 0),
          ctr: Number(item.metrics?.ctr || 0),
          cpc: Number(item.metrics?.cpc || 0),
          cpm: Number(item.metrics?.cpm || 0),
        }));
      }
    } catch (adErr) {
      console.warn("Could not fetch ad-level breakdown:", adErr);
    }

    // ── Upsert monthly snapshot ──
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "tiktok_ads")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) {
      throw new Error("Snapshot for this period is locked.");
    }

    const snapshotPayload = {
      metrics_data: metricsData,
      top_content: topContent,
      raw_data: { report: rows },
    };

    if (existing) {
      await supabase.from("monthly_snapshots").update(snapshotPayload).eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "tiktok_ads",
        report_month: month,
        report_year: year,
        ...snapshotPayload,
      });
    }

    // ── Update connection status ──
    await supabase
      .from("platform_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "success",
        last_error: null,
      })
      .eq("id", connectionId);

    if (syncLog?.id) {
      await supabase
        .from("sync_logs")
        .update({ status: "success", completed_at: new Date().toISOString() })
        .eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData, top_ads: topContent.length }),
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
