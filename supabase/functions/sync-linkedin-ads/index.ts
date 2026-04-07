import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken, decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LI_VERSION = "202601";

const LI_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": LI_VERSION,
  "X-Restli-Protocol-Version": "2.0.0",
});

// Only fields documented as valid in AdAnalyticsV8 finder (q=analytics)
// See: https://learn.microsoft.com/en-gb/linkedin/marketing/integrations/ads/reporting/ads-reporting
const ACCOUNT_FIELDS = "impressions,clicks,costInLocalCurrency,externalWebsiteConversions,dateRange,pivotValues,landingPageClicks,shares,likes";
const CAMPAIGN_FIELDS = "impressions,clicks,costInLocalCurrency,externalWebsiteConversions,pivotValues,shares,likes";

function buildAnalyticsUrl(
  pivot: string,
  adAccountId: string,
  month: number,
  year: number,
  lastDay: number,
  fields: string,
): string {
  const params = new URLSearchParams();
  params.set("q", "analytics");
  params.set("pivot", pivot);
  params.set("dateRange.start.day", "1");
  params.set("dateRange.start.month", String(month));
  params.set("dateRange.start.year", String(year));
  params.set("dateRange.end.day", String(lastDay));
  params.set("dateRange.end.month", String(month));
  params.set("dateRange.end.year", String(year));
  params.set("timeGranularity", "MONTHLY");

  const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${adAccountId}`);
  return `https://api.linkedin.com/rest/adAnalytics?${params.toString()}&accounts=List(${accountUrn})&fields=${fields}`;
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

    if (conn.access_token) conn.access_token = await decryptToken(conn.access_token);
    if (conn.refresh_token) conn.refresh_token = await decryptToken(conn.refresh_token);

    if (!conn.is_connected || !conn.access_token) {
      throw new Error("Connection is not authenticated. Please connect via OAuth first.");
    }

    const { data: clientData } = await supabase.from("clients").select("org_id").eq("id", clientId).single();
    const orgId = clientData?.org_id;

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
      .insert({ client_id: clientId, platform: "linkedin_ads", status: "running", report_month: month, report_year: year, org_id: orgId })
      .select("id")
      .single();

    // ── Auto-refresh token if expired ──
    let accessToken = conn.access_token;
    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      if (!conn.refresh_token) {
        throw new Error("LinkedIn Ads token expired and no refresh token available. Please reconnect.");
      }
      console.log("LinkedIn Ads token expired, refreshing...");
      const liClientId = Deno.env.get("LINKEDIN_ADS_CLIENT_ID")!;
      const liClientSecret = Deno.env.get("LINKEDIN_ADS_CLIENT_SECRET")!;

      const refreshRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: conn.refresh_token,
          client_id: liClientId,
          client_secret: liClientSecret,
        }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.error || !refreshData.access_token) {
        throw new Error(`LinkedIn Ads token refresh failed: ${refreshData.error_description || refreshData.error || "Unknown error"}. Please reconnect.`);
      }

      accessToken = refreshData.access_token;
      const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 5184000) * 1000).toISOString();
      await supabase.from("platform_connections").update({
        access_token: await encryptToken(accessToken),
        refresh_token: await encryptToken(refreshData.refresh_token || conn.refresh_token),
        token_expires_at: newExpiresAt,
        last_error: null,
      }).eq("id", connectionId);
      console.log("LinkedIn Ads token refreshed successfully.");
    }

    const adAccountId = conn.account_id;
    if (!adAccountId) {
      throw new Error("No ad account selected. Please select an ad account first.");
    }

    const lastDay = new Date(year, month, 0).getDate();

    // ── Fetch Ad Analytics (account-level aggregated) ──
    const analyticsUrlStr = buildAnalyticsUrl("ACCOUNT", adAccountId, month, year, lastDay, ACCOUNT_FIELDS);
    console.log("LinkedIn Ads analytics URL:", analyticsUrlStr);

    const analyticsRes = await fetch(analyticsUrlStr, { headers: LI_HEADERS(accessToken) });
    const analyticsData = await analyticsRes.json();

    if (!analyticsRes.ok) {
      console.error("LinkedIn Ads analytics error:", JSON.stringify(analyticsData));
      throw new Error(`LinkedIn Ads API error (${analyticsRes.status}): ${analyticsData.message || JSON.stringify(analyticsData).substring(0, 300)}`);
    }

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpend = 0;
    let totalConversions = 0;
    let totalLandingPageClicks = 0;
    let totalLikes = 0;
    let totalShares = 0;

    for (const el of analyticsData.elements || []) {
      totalImpressions += Number(el.impressions || 0);
      totalClicks += Number(el.clicks || 0);
      totalSpend += Number(el.costInLocalCurrency || 0) / 1_000_000;
      totalConversions += Number(el.externalWebsiteConversions || 0);
      totalLandingPageClicks += Number(el.landingPageClicks || 0);
      totalLikes += Number(el.likes || 0);
      totalShares += Number(el.shares || 0);
    }

    const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const overallCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const overallCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const costPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const totalEngagements = totalLikes + totalShares + totalClicks;

    // ── Fetch Campaign-level analytics ──
    const campaignUrlStr = buildAnalyticsUrl("CAMPAIGN", adAccountId, month, year, lastDay, CAMPAIGN_FIELDS);
    const campaignRes = await fetch(campaignUrlStr, { headers: LI_HEADERS(accessToken) });
    const campaignData = await campaignRes.json();

    interface CampaignRow {
      name: string;
      id: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      leads: number;
      ctr: number;
    }

    const campaigns: CampaignRow[] = [];

    if (campaignRes.ok && campaignData.elements) {
      for (const el of campaignData.elements) {
        const pivotValue = (el.pivotValues && el.pivotValues[0]) || "";
        const campaignId = pivotValue.replace("urn:li:sponsoredCampaign:", "");
        const impressions = Number(el.impressions || 0);
        const clicks = Number(el.clicks || 0);
        const spend = Number(el.costInLocalCurrency || 0) / 1_000_000;
        const conversions = Number(el.externalWebsiteConversions || 0);
        const leads = Number(el.leads || 0);

        campaigns.push({
          name: `Campaign ${campaignId}`,
          id: campaignId,
          spend,
          impressions,
          clicks,
          conversions,
          leads,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        });
      }
    }

    for (const campaign of campaigns) {
      try {
        const nameRes = await fetch(
          `https://api.linkedin.com/rest/adCampaigns/${campaign.id}`,
          { headers: LI_HEADERS(accessToken) }
        );
        if (nameRes.ok) {
          const nameData = await nameRes.json();
          if (nameData.name) {
            campaign.name = nameData.name;
          }
        }
      } catch {
        // non-blocking
      }
    }

    const metricsData = {
      spend: Math.round(totalSpend * 100) / 100,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: Math.round(overallCtr * 100) / 100,
      cpc: Math.round(overallCpc * 100) / 100,
      cpm: Math.round(overallCpm * 100) / 100,
      conversions: totalConversions,
      conversion_rate: Math.round(conversionRate * 100) / 100,
      cost_per_conversion: Math.round(costPerConversion * 100) / 100,
      leads: totalLeads,
      cost_per_lead: Math.round(costPerLead * 100) / 100,
      video_views: totalVideoViews,
      reach: totalImpressions,
      landing_page_clicks: totalLandingPageClicks,
      engagement: totalEngagements,
      campaign_count: campaigns.length,
    };

    const topContent = campaigns
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10)
      .map((c) => ({
        name: c.name,
        spend: Math.round(c.spend * 100) / 100,
        clicks: c.clicks,
        impressions: c.impressions,
        conversions: c.conversions,
        leads: c.leads,
        ctr: Math.round(c.ctr * 100) / 100,
      }));

    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "linkedin_ads")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) {
      throw new Error("Snapshot for this period is locked and cannot be overwritten.");
    }

    if (existing) {
      await supabase.from("monthly_snapshots").update({
        metrics_data: metricsData,
        top_content: topContent,
        raw_data: { campaigns },
      }).eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "linkedin_ads",
        report_month: month,
        report_year: year,
        metrics_data: metricsData,
        top_content: topContent,
        raw_data: { campaigns },
      });
    }

    await supabase.from("platform_connections").update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: "success",
      last_error: null,
    }).eq("id", connectionId);

    if (syncLog?.id) {
      await supabase.from("sync_logs").update({ status: "success", completed_at: new Date().toISOString() }).eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData, campaigns_synced: campaigns.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("LinkedIn Ads sync error:", e);
    if (connectionId) {
      await supabase.from("platform_connections").update({
        last_sync_status: "failed",
        last_error: e instanceof Error ? e.message : "Unknown error",
      }).eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
