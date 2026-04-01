import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken, decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_API_VERSION = "v25.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

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
        console.log("Meta Ads token expiring soon, re-exchanging for fresh long-lived token...");
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
            console.log("Meta Ads token re-exchanged successfully.");
          } else {
            console.warn("Meta Ads token re-exchange failed:", reExchangeData.error?.message || "Unknown");
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
      // Pick first active account
      const activeAccount = meData.data.find((a: any) => a.account_status === 1) || meData.data[0];
      adAccountId = activeAccount.id; // format: act_123456
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

    // Fetch campaign-level insights
    const insightsUrl = `${GRAPH_BASE}/${adAccountId}/insights`;
    const insightsParams = new URLSearchParams({
      access_token: accessToken,
      level: "campaign",
      fields: "campaign_name,campaign_id,impressions,clicks,spend,actions,action_values,ctr,cpc,cpm,reach,frequency,video_play_actions",
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      limit: "500",
    });

    const insightsRes = await fetch(`${insightsUrl}?${insightsParams}`);
    if (!insightsRes.ok) {
      const errText = await insightsRes.text();
      throw new Error(`Meta Ads API error (${insightsRes.status}): ${errText.substring(0, 500)}`);
    }
    const insightsData = await insightsRes.json();
    const rows = insightsData.data || [];

    // Parse & aggregate
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpend = 0;
    let totalLeads = 0;
    let totalReach = 0;
    let totalLinkClicks = 0;
    let totalVideoPlays = 0;

    const campaigns: any[] = [];

    for (const row of rows) {
      const impressions = Number(row.impressions || 0);
      const clicks = Number(row.clicks || 0);
      const spend = Number(row.spend || 0);
      const reach = Number(row.reach || 0);

      // Extract leads from actions array
      let leads = 0;
      if (row.actions) {
        for (const action of row.actions) {
          if (action.action_type === "lead" ||
              action.action_type === "onsite_conversion.lead_grouped" ||
              action.action_type === "offsite_conversion.fb_pixel_lead" ||
              action.action_type === "onsite_web_lead") {
            leads += Number(action.value || 0);
          }
        }
      }

      totalImpressions += impressions;
      totalClicks += clicks;
      totalSpend += spend;
      totalLeads += leads;
      totalReach += reach;
      // Extract link_clicks from actions array
      const linkClickAction = row.actions?.find((a: any) => a.action_type === 'link_click');
      const outboundClickAction = row.actions?.find((a: any) => a.action_type === 'outbound_click');
      totalLinkClicks += linkClickAction ? Number(linkClickAction.value || 0)
        : outboundClickAction ? Number(outboundClickAction.value || 0)
        : 0;
      if (row.video_play_actions) {
        for (const action of row.video_play_actions) {
          totalVideoPlays += Number(action.value || 0);
        }
      }
      campaigns.push({
        name: row.campaign_name || "Unknown",
        id: row.campaign_id,
        impressions,
        clicks,
        spend,
        reach,
        leads,
        ctr: Number(row.ctr || 0),
        cpc: Number(row.cpc || 0),
        cpm: Number(row.cpm || 0),
        frequency: Number(row.frequency || 0),
      });
    }

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

    // Top campaigns by spend
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

    if (existing) {
      await supabase
        .from("monthly_snapshots")
        .update({
          metrics_data: metricsData,
          top_content: topContent,
          raw_data: { campaigns },
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
        raw_data: { campaigns },
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
