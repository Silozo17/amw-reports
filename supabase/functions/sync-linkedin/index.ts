import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LI_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": "202401",
  "X-Restli-Protocol-Version": "2.0.0",
});

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

    const { data: syncLog } = await supabase
      .from("sync_logs")
      .insert({ client_id: clientId, platform: "linkedin", status: "running", report_month: month, report_year: year })
      .select("id")
      .single();

    const accessToken = conn.access_token;
    const metadata = conn.metadata as any;

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    const campaigns: any[] = [];

    // Fetch ad analytics if ad accounts exist
    const adAccounts = metadata?.ad_accounts || [];
    for (const adAcct of adAccounts) {
      try {
        const analyticsUrl = `https://api.linkedin.com/rest/adAnalytics?q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${year},month:${month},day:1),end:(year:${year},month:${month},day:${lastDay}))&accounts=urn:li:sponsoredAccount:${adAcct.id}&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions`;
        const analyticsRes = await fetch(analyticsUrl, { headers: LI_HEADERS(accessToken) });
        const analyticsData = await analyticsRes.json();
        console.log("LinkedIn analytics:", JSON.stringify(analyticsData).substring(0, 500));

        if (analyticsData.elements) {
          for (const el of analyticsData.elements) {
            const spend = Number(el.costInLocalCurrency || 0) / 10000; // LinkedIn returns in micro-currency
            const impressions = Number(el.impressions || 0);
            const clicks = Number(el.clicks || 0);
            const conversions = Number(el.externalWebsiteConversions || 0);

            totalSpend += spend;
            totalImpressions += impressions;
            totalClicks += clicks;
            totalConversions += conversions;

            campaigns.push({ spend, impressions, clicks, conversions });
          }
        }
      } catch (e) {
        console.warn(`LinkedIn ad analytics error for account ${adAcct.id}:`, e);
      }
    }

    // Fetch organization page stats
    let totalFollowers = 0;
    const organizations = metadata?.organizations || [];
    for (const org of organizations) {
      try {
        const followerUrl = `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${org.id}`;
        const followerRes = await fetch(followerUrl, { headers: LI_HEADERS(accessToken) });
        const followerData = await followerRes.json();

        if (followerData.elements?.[0]) {
          const el = followerData.elements[0];
          totalFollowers += Number(el.followerCounts?.organicFollowerCount || 0) + Number(el.followerCounts?.paidFollowerCount || 0);
        }
      } catch (e) {
        console.warn(`LinkedIn follower stats error for org ${org.id}:`, e);
      }
    }

    const metricsData = {
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
      cost_per_conversion: totalConversions > 0 ? totalSpend / totalConversions : 0,
      total_followers: totalFollowers,
      campaign_count: campaigns.length,
      organizations_count: organizations.length,
    };

    const topContent = campaigns
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);

    // Upsert monthly snapshot
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "linkedin")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    if (existing) {
      await supabase.from("monthly_snapshots").update({ metrics_data: metricsData, top_content: topContent, raw_data: { campaigns } }).eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({ client_id: clientId, platform: "linkedin", report_month: month, report_year: year, metrics_data: metricsData, top_content: topContent, raw_data: { campaigns } });
    }

    await supabase.from("platform_connections").update({ last_sync_at: new Date().toISOString(), last_sync_status: "success", last_error: null }).eq("id", connectionId);

    if (syncLog?.id) {
      await supabase.from("sync_logs").update({ status: "success", completed_at: new Date().toISOString() }).eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("LinkedIn sync error:", e);
    if (connectionId) {
      await supabase.from("platform_connections").update({ last_sync_status: "failed", last_error: e instanceof Error ? e.message : "Unknown error" }).eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
