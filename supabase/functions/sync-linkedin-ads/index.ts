import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken, decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

const LI_VERSION = "202601";
const DEADLINE_MS = 50_000;

const LI_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": LI_VERSION,
  "X-Restli-Protocol-Version": "2.0.0",
});

const ACCOUNT_FIELDS = "impressions,clicks,costInLocalCurrency,externalWebsiteConversions,dateRange,pivotValues,landingPageClicks,shares,likes";
const CAMPAIGN_FIELDS = "impressions,clicks,costInLocalCurrency,externalWebsiteConversions,pivotValues,shares,likes";
const CREATIVE_FIELDS = "impressions,clicks,costInLocalCurrency,externalWebsiteConversions,pivotValues,shares,likes";

function buildAnalyticsUrl(
  pivot: string,
  adAccountId: string,
  month: number,
  year: number,
  lastDay: number,
  fields: string,
): string {
  const dateRange = `(start:(year:${year},month:${month},day:1),end:(year:${year},month:${month},day:${lastDay}))`;
  const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${adAccountId}`);
  return `https://api.linkedin.com/rest/adAnalytics?q=analytics&pivot=${pivot}&dateRange=${dateRange}&timeGranularity=MONTHLY&accounts=List(${accountUrn})&fields=${fields}`;
}

function hasTimeLeft(startTime: number): boolean {
  return Date.now() - startTime < DEADLINE_MS;
}

Deno.serve(async (req) => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "sync-linkedin-ads", method: req.method, connection_id: null }));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
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
      const errorDetails = analyticsData.errorDetails ? JSON.stringify(analyticsData.errorDetails) : "";
      throw new Error(`LinkedIn Ads API error (${analyticsRes.status}): ${analyticsData.message || analyticsData.error || ""} ${errorDetails}`.trim());
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
      ctr: number;
      cpc: number;
      status: string;
      campaignGroupId: string;
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

        campaigns.push({
          name: `Campaign ${campaignId}`,
          id: campaignId,
          spend,
          impressions,
          clicks,
          conversions,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          status: "ACTIVE",
          campaignGroupId: "",
        });
      }
    }

    // ── Fetch campaign details (name, status, campaignGroup) ──
    for (const campaign of campaigns) {
      if (!hasTimeLeft(startTime)) break;
      try {
        const nameRes = await fetch(
          `https://api.linkedin.com/rest/adCampaigns/${campaign.id}`,
          { headers: LI_HEADERS(accessToken) }
        );
        if (nameRes.ok) {
          const nameData = await nameRes.json();
          if (nameData.name) campaign.name = nameData.name;
          if (nameData.status) campaign.status = nameData.status;
          if (nameData.campaignGroup) {
            campaign.campaignGroupId = nameData.campaignGroup.replace("urn:li:sponsoredCampaignGroup:", "");
          }
        }
      } catch {
        // non-blocking
      }
    }

    // ── Fetch Campaign Group details ──
    interface CampaignGroupRow {
      id: string;
      name: string;
      status: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      ctr: number;
      cpc: number;
    }

    const campaignGroupIds = [...new Set(campaigns.map(c => c.campaignGroupId).filter(Boolean))];
    const campaignGroupMap = new Map<string, CampaignGroupRow>();

    for (const groupId of campaignGroupIds) {
      if (!hasTimeLeft(startTime)) break;
      try {
        const groupRes = await fetch(
          `https://api.linkedin.com/rest/adCampaignGroups/${groupId}`,
          { headers: LI_HEADERS(accessToken) }
        );
        if (groupRes.ok) {
          const groupData = await groupRes.json();
          campaignGroupMap.set(groupId, {
            id: groupId,
            name: groupData.name || `Campaign Group ${groupId}`,
            status: groupData.status || "ACTIVE",
            spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0,
          });
        }
      } catch {
        // non-blocking
      }
    }

    // Aggregate campaign metrics into their groups
    for (const campaign of campaigns) {
      if (!campaign.campaignGroupId) continue;
      let group = campaignGroupMap.get(campaign.campaignGroupId);
      if (!group) {
        group = {
          id: campaign.campaignGroupId,
          name: `Campaign Group ${campaign.campaignGroupId}`,
          status: "ACTIVE",
          spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0,
        };
        campaignGroupMap.set(campaign.campaignGroupId, group);
      }
      group.spend += campaign.spend;
      group.impressions += campaign.impressions;
      group.clicks += campaign.clicks;
      group.conversions += campaign.conversions;
    }

    // Calculate derived metrics for groups
    for (const group of campaignGroupMap.values()) {
      group.ctr = group.impressions > 0 ? (group.clicks / group.impressions) * 100 : 0;
      group.cpc = group.clicks > 0 ? group.spend / group.clicks : 0;
    }

    const campaignGroups = [...campaignGroupMap.values()];

    // ── Fetch Creative-level analytics ──
    interface AdRow {
      name: string;
      id: string;
      campaignId: string;
      campaign_name: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      ctr: number;
      cpc: number;
      status: string;
      creative?: { title?: string; body?: string; image_url?: string } | null;
    }

    const ads: AdRow[] = [];

    if (hasTimeLeft(startTime)) {
      const creativeUrlStr = buildAnalyticsUrl("CREATIVE", adAccountId, month, year, lastDay, CREATIVE_FIELDS);
      const creativeRes = await fetch(creativeUrlStr, { headers: LI_HEADERS(accessToken) });
      const creativeData = await creativeRes.json();

      if (creativeRes.ok && creativeData.elements) {
        for (const el of creativeData.elements) {
          const pivotValue = (el.pivotValues && el.pivotValues[0]) || "";
          const creativeId = pivotValue.replace("urn:li:sponsoredCreative:", "");
          const impressions = Number(el.impressions || 0);
          const clicks = Number(el.clicks || 0);
          const spend = Number(el.costInLocalCurrency || 0) / 1_000_000;
          const conversions = Number(el.externalWebsiteConversions || 0);

          ads.push({
            name: `Creative ${creativeId}`,
            id: creativeId,
            campaignId: "",
            campaign_name: "",
            spend,
            impressions,
            clicks,
            conversions,
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            cpc: clicks > 0 ? spend / clicks : 0,
            status: "ACTIVE",
            creative: null,
          });
        }
      }
    }

    // ── Fetch creative metadata (name, status, campaign link) ──
    for (const ad of ads) {
      if (!hasTimeLeft(startTime)) break;
      try {
        const metaRes = await fetch(
          `https://api.linkedin.com/rest/adCreatives/${ad.id}`,
          { headers: LI_HEADERS(accessToken) }
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          if (metaData.campaign) {
            const campId = metaData.campaign.replace("urn:li:sponsoredCampaign:", "");
            ad.campaignId = campId;
            const matchedCampaign = campaigns.find(c => c.id === campId);
            ad.campaign_name = matchedCampaign?.name || `Campaign ${campId}`;
          }
          if (metaData.status) ad.status = metaData.status;
          // Extract creative content from intendedStatus or variables
          const content = metaData.content || metaData.variables?.data;
          if (content) {
            ad.creative = {
              title: content["com.linkedin.ads.SponsoredUpdateCreativeVariables"]?.title || undefined,
              body: content["com.linkedin.ads.SponsoredUpdateCreativeVariables"]?.body || undefined,
            };
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
        ctr: Math.round(c.ctr * 100) / 100,
      }));

    const rawData = {
      campaignGroups: campaignGroups.map(g => ({
        ...g,
        spend: Math.round(g.spend * 100) / 100,
        ctr: Math.round(g.ctr * 100) / 100,
        cpc: Math.round(g.cpc * 100) / 100,
      })),
      campaigns: campaigns.map(c => ({
        ...c,
        spend: Math.round(c.spend * 100) / 100,
        ctr: Math.round(c.ctr * 100) / 100,
        cpc: Math.round(c.cpc * 100) / 100,
      })),
      ads: ads.map(a => ({
        ...a,
        spend: Math.round(a.spend * 100) / 100,
        ctr: Math.round(a.ctr * 100) / 100,
        cpc: Math.round(a.cpc * 100) / 100,
      })),
    };

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
        raw_data: rawData,
      }).eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "linkedin_ads",
        report_month: month,
        report_year: year,
        metrics_data: metricsData,
        top_content: topContent,
        raw_data: rawData,
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
      JSON.stringify({ success: true, metrics: metricsData, campaigns_synced: campaigns.length, ads_synced: ads.length }),
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
