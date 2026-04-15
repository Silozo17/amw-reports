import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken, decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

const GRAPH_API_VERSION = "v25.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const DEADLINE_MS = 50_000; // 50s safety deadline

interface SyncRequest {
  connection_id: string;
  month: number;
  year: number;
}

function hasTimeLeft(start: number): boolean {
  return Date.now() - start < DEADLINE_MS;
}

async function fetchAllPages(url: string, accessToken: string, start: number, limit = 500): Promise<any[]> {
  const results: any[] = [];
  let nextUrl: string | null = `${url}&limit=${limit}&access_token=${accessToken}`;
  while (nextUrl && hasTimeLeft(start)) {
    const res = await fetch(nextUrl);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Meta API error (${res.status}): ${errText.substring(0, 500)}`);
    }
    const json = await res.json();
    if (json.data) results.push(...json.data);
    nextUrl = json.paging?.next || null;
    if (results.length >= 2000) break; // safety cap
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "sync-meta-ads", method: req.method, connection_id: null }));

  const startTime = Date.now();
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

    // Decrypt tokens
    if (conn.access_token) conn.access_token = await decryptToken(conn.access_token);

    if (!conn.is_connected || !conn.access_token) {
      return new Response(
        JSON.stringify({ error: "Connection is not authenticated. Please connect via OAuth first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get org_id from client
    const { data: clientData } = await supabase.from("clients").select("org_id").eq("id", clientId).single();
    const orgId = clientData?.org_id;
    if (!orgId) {
      throw new Error("Could not resolve org_id for client — sync aborted");
    }

    // Require authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (orgId) {
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
        platform: "meta_ads",
        status: "running",
        report_month: month,
        report_year: year,
        org_id: orgId,
      })
      .select("id")
      .single();

    // ── Proactive token re-exchange if expiring within 7 days ──
    let accessToken = conn.access_token;
    if (conn.token_expires_at) {
      const expiresAt = new Date(conn.token_expires_at);
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (expiresAt < sevenDaysFromNow) {
        console.log("Meta Ads token expiring soon, re-exchanging...");
        const appId = Deno.env.get("META_APP_ID")!;
        const appSecret = Deno.env.get("META_APP_SECRET")!;
        try {
          const reExchangeRes = await fetch(
            `${GRAPH_BASE}/oauth/access_token?` +
              new URLSearchParams({
                grant_type: "fb_exchange_token",
                client_id: appId,
                client_secret: appSecret,
                fb_exchange_token: accessToken,
              })
          );
          const reExchangeData = await reExchangeRes.json();
          if (reExchangeData.access_token) {
            accessToken = reExchangeData.access_token;
            const newExpiresAt = new Date(Date.now() + (reExchangeData.expires_in || 5184000) * 1000).toISOString();
            await supabase.from("platform_connections").update({
              access_token: await encryptToken(accessToken),
              token_expires_at: newExpiresAt,
              last_error: null,
            }).eq("id", connectionId);
          }
        } catch (e) {
          console.warn("Meta Ads token re-exchange exception:", e);
        }
      }
    }

    // Discover ad account ID if missing
    let adAccountId = conn.account_id;
    if (!adAccountId) {
      const meRes = await fetch(`${GRAPH_BASE}/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`);
      if (!meRes.ok) {
        const errText = await meRes.text();
        throw new Error(`Failed to discover ad accounts (${meRes.status}): ${errText.substring(0, 300)}`);
      }
      const meData = await meRes.json();
      if (!meData.data || meData.data.length === 0) {
        throw new Error("No ad accounts found for this Facebook user.");
      }
      const activeAccount = meData.data.find((a: any) => a.account_status === 1) || meData.data[0];
      adAccountId = activeAccount.id;
      const accountName = activeAccount.name || `Meta Ads (${adAccountId})`;
      await supabase
        .from("platform_connections")
        .update({ account_id: adAccountId, account_name: accountName })
        .eq("id", connectionId);
    }

    // Build date range
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const timeRange = JSON.stringify({ since: startDate, until: endDate });

    // ═══════════════════════════════════════════════════════════
    // 1. Campaign-level insights (existing)
    // ═══════════════════════════════════════════════════════════
    const campaignInsightsUrl = `${GRAPH_BASE}/${adAccountId}/insights?` +
      new URLSearchParams({
        level: "campaign",
        fields: "campaign_name,campaign_id,impressions,clicks,spend,actions,action_values,ctr,cpc,cpm,reach,frequency,video_play_actions",
        time_range: timeRange,
        limit: "500",
        access_token: accessToken,
      });

    const campaignInsightsRes = await fetch(campaignInsightsUrl);
    if (!campaignInsightsRes.ok) {
      const errText = await campaignInsightsRes.text();
      throw new Error(`Meta Ads campaign insights error (${campaignInsightsRes.status}): ${errText.substring(0, 500)}`);
    }
    const campaignInsightsData = await campaignInsightsRes.json();
    const campaignRows = campaignInsightsData.data || [];

    // ═══════════════════════════════════════════════════════════
    // 2. Ad Set-level insights
    // ═══════════════════════════════════════════════════════════
    let adSetRows: any[] = [];
    if (hasTimeLeft(startTime)) {
      try {
        const adSetUrl = `${GRAPH_BASE}/${adAccountId}/insights?` +
          new URLSearchParams({
            level: "adset",
            fields: "adset_name,adset_id,campaign_name,campaign_id,impressions,clicks,spend,actions,ctr,cpc,cpm,reach",
            time_range: timeRange,
            limit: "500",
            access_token: accessToken,
          });
        const adSetRes = await fetch(adSetUrl);
        if (adSetRes.ok) {
          const adSetData = await adSetRes.json();
          adSetRows = adSetData.data || [];
        } else {
          console.warn("Ad set insights fetch failed:", await adSetRes.text());
        }
      } catch (e) {
        console.warn("Ad set insights exception:", e);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 3. Ad-level insights
    // ═══════════════════════════════════════════════════════════
    let adRows: any[] = [];
    if (hasTimeLeft(startTime)) {
      try {
        const adUrl = `${GRAPH_BASE}/${adAccountId}/insights?` +
          new URLSearchParams({
            level: "ad",
            fields: "ad_name,ad_id,adset_name,adset_id,campaign_name,campaign_id,impressions,clicks,spend,actions,ctr,cpc,cpm,reach",
            time_range: timeRange,
            limit: "500",
            access_token: accessToken,
          });
        const adRes = await fetch(adUrl);
        if (adRes.ok) {
          const adData = await adRes.json();
          adRows = adData.data || [];
        } else {
          console.warn("Ad-level insights fetch failed:", await adRes.text());
        }
      } catch (e) {
        console.warn("Ad-level insights exception:", e);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 4. Campaign/AdSet/Ad statuses
    // ═══════════════════════════════════════════════════════════
    const statusMaps = { campaigns: {} as Record<string, any>, adSets: {} as Record<string, any>, ads: {} as Record<string, any> };

    if (hasTimeLeft(startTime)) {
      try {
        // Campaign statuses
        const campStatusRows = await fetchAllPages(
          `${GRAPH_BASE}/${adAccountId}/campaigns?fields=id,name,status,objective`,
          accessToken, startTime
        );
        for (const c of campStatusRows) {
          statusMaps.campaigns[c.id] = { status: c.status, objective: c.objective };
        }

        // Ad set statuses
        if (hasTimeLeft(startTime)) {
          const adSetStatusRows = await fetchAllPages(
            `${GRAPH_BASE}/${adAccountId}/adsets?fields=id,name,status,campaign_id`,
            accessToken, startTime
          );
          for (const a of adSetStatusRows) {
            statusMaps.adSets[a.id] = { status: a.status, campaign_id: a.campaign_id };
          }
        }

        // Ad statuses
        if (hasTimeLeft(startTime)) {
          const adStatusRows = await fetchAllPages(
            `${GRAPH_BASE}/${adAccountId}/ads?fields=id,name,status,adset_id,creative{id}`,
            accessToken, startTime
          );
          for (const a of adStatusRows) {
            statusMaps.ads[a.id] = { status: a.status, adset_id: a.adset_id, creative_id: a.creative?.id };
          }
        }
      } catch (e) {
        console.warn("Status fetch exception:", e);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 5. Ad Creatives (batch via individual fetches, capped)
    // ═══════════════════════════════════════════════════════════
    const creatives: Record<string, any> = {};
    if (hasTimeLeft(startTime) && adRows.length > 0) {
      // Collect unique ad IDs that have creatives
      const adIdsWithCreatives = adRows
        .map((a: any) => a.ad_id)
        .filter((id: string) => id && statusMaps.ads[id]?.creative_id);

      const uniqueCreativeIds = [...new Set(adIdsWithCreatives.map((adId: string) => statusMaps.ads[adId].creative_id))];

      // Fetch creatives in batches of 50
      const BATCH_SIZE = 50;
      for (let i = 0; i < uniqueCreativeIds.length && hasTimeLeft(startTime); i += BATCH_SIZE) {
        const batch = uniqueCreativeIds.slice(i, i + BATCH_SIZE);
        const batchIds = batch.join(",");
        try {
          const creativeRes = await fetch(
            `${GRAPH_BASE}/?ids=${batchIds}&fields=id,thumbnail_url,title,body,image_url,object_story_spec&access_token=${accessToken}`
          );
          if (creativeRes.ok) {
            const creativeData = await creativeRes.json();
            for (const [creativeId, data] of Object.entries(creativeData)) {
              const d = data as any;
              creatives[creativeId] = {
                thumbnail_url: d.thumbnail_url || d.image_url || null,
                title: d.title || d.object_story_spec?.link_data?.name || null,
                body: d.body || d.object_story_spec?.link_data?.message || null,
                image_url: d.image_url || null,
              };
            }
          }
        } catch (e) {
          console.warn("Creative batch fetch exception:", e);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Parse & aggregate campaign metrics (existing logic)
    // ═══════════════════════════════════════════════════════════
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpend = 0;
    let totalLeads = 0;
    let totalReach = 0;
    let totalLinkClicks = 0;
    let totalVideoPlays = 0;

    const extractLeads = (actions: any[]): number => {
      const leadAction = actions.find(a => a.action_type === "lead");
      if (leadAction) return Number(leadAction.value || 0);

      let leads = 0;
      for (const action of actions) {
        if (action.action_type === "onsite_conversion.lead_grouped" ||
            action.action_type === "offsite_conversion.fb_pixel_lead" ||
            action.action_type === "onsite_web_lead") {
          leads += Number(action.value || 0);
        }
      }
      return leads;
    };

    const campaigns: any[] = [];

    for (const row of campaignRows) {
      const impressions = Number(row.impressions || 0);
      const clicks = Number(row.clicks || 0);
      const spend = Number(row.spend || 0);
      const reach = Number(row.reach || 0);
      const leads = row.actions ? extractLeads(row.actions) : 0;

      totalImpressions += impressions;
      totalClicks += clicks;
      totalSpend += spend;
      totalLeads += leads;
      totalReach += reach;

      const linkClickAction = row.actions?.find((a: any) => a.action_type === 'link_click');
      const outboundClickAction = row.actions?.find((a: any) => a.action_type === 'outbound_click');
      totalLinkClicks += linkClickAction ? Number(linkClickAction.value || 0)
        : outboundClickAction ? Number(outboundClickAction.value || 0) : 0;

      if (row.video_play_actions) {
        for (const action of row.video_play_actions) {
          totalVideoPlays += Number(action.value || 0);
        }
      }

      const campStatus = statusMaps.campaigns[row.campaign_id];
      campaigns.push({
        name: row.campaign_name || "Unknown",
        id: row.campaign_id,
        impressions, clicks, spend, reach, leads,
        ctr: Number(row.ctr || 0),
        cpc: Number(row.cpc || 0),
        cpm: Number(row.cpm || 0),
        frequency: Number(row.frequency || 0),
        status: campStatus?.status || "UNKNOWN",
        objective: campStatus?.objective || null,
      });
    }

    // Build ad sets array
    const adSets: any[] = adSetRows.map((row: any) => {
      const adSetStatus = statusMaps.adSets[row.adset_id];
      const leads = row.actions ? extractLeads(row.actions) : 0;
      return {
        name: row.adset_name || "Unknown",
        id: row.adset_id,
        campaign_name: row.campaign_name,
        campaign_id: row.campaign_id,
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        spend: Number(row.spend || 0),
        reach: Number(row.reach || 0),
        leads,
        ctr: Number(row.ctr || 0),
        cpc: Number(row.cpc || 0),
        cpm: Number(row.cpm || 0),
        status: adSetStatus?.status || "UNKNOWN",
      };
    });

    // Build ads array
    const ads: any[] = adRows.map((row: any) => {
      const adStatus = statusMaps.ads[row.ad_id];
      const creativeId = adStatus?.creative_id;
      const creative = creativeId ? creatives[creativeId] : null;
      const leads = row.actions ? extractLeads(row.actions) : 0;
      return {
        name: row.ad_name || "Unknown",
        id: row.ad_id,
        adset_name: row.adset_name,
        adset_id: row.adset_id,
        campaign_name: row.campaign_name,
        campaign_id: row.campaign_id,
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        spend: Number(row.spend || 0),
        reach: Number(row.reach || 0),
        leads,
        ctr: Number(row.ctr || 0),
        cpc: Number(row.cpc || 0),
        cpm: Number(row.cpm || 0),
        status: adStatus?.status || "UNKNOWN",
        creative: creative || null,
      };
    });

    const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const overallCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const overallCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const totalFrequency = totalImpressions > 0 && totalReach > 0 ? totalImpressions / totalReach : 0;

    const metricsData = {
      impressions: totalImpressions,
      clicks: totalClicks,
      spend: totalSpend,
      leads: totalLeads,
      ctr: overallCtr,
      cpc: overallCpc,
      cpm: overallCpm,
      cost_per_lead: totalLeads > 0 ? totalSpend / totalLeads : 0,
      reach: totalReach,
      link_clicks: totalLinkClicks,
      frequency: totalFrequency,
      video_views: totalVideoPlays,
      campaign_count: campaigns.length,
    };

    // Top campaigns by spend (kept for backwards compatibility)
    const topContent = campaigns
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10)
      .map((c) => ({
        name: c.name,
        spend: c.spend,
        clicks: c.clicks,
        impressions: c.impressions,
        leads: c.leads,
        ctr: c.ctr,
      }));

    // Upsert monthly snapshot
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "meta_ads")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) {
      throw new Error("Snapshot for this period is locked and cannot be overwritten.");
    }

    const rawData = { campaigns, adSets, ads, creatives };

    if (existing) {
      await supabase
        .from("monthly_snapshots")
        .update({
          metrics_data: metricsData,
          top_content: topContent,
          raw_data: rawData,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "meta_ads",
        report_month: month,
        report_year: year,
        metrics_data: metricsData,
        top_content: topContent,
        raw_data: rawData,
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
        campaigns_synced: campaigns.length,
        adsets_synced: adSets.length,
        ads_synced: ads.length,
        creatives_fetched: Object.keys(creatives).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Meta Ads sync error:", e);

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
