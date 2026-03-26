import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_BASE = "https://graph.facebook.com/v25.0";

/** Helper: sum daily values from a page insights metric array */
const sumDailyValues = (metricData: any[], metricName: string): number => {
  for (const metric of metricData) {
    if (metric.name === metricName) {
      return (metric.values || []).reduce((sum: number, v: any) => sum + (Number(v.value) || 0), 0);
    }
  }
  return 0;
};

/** Helper: fetch page insights for a set of metrics (single API call) */
const fetchPageInsights = async (
  pageId: string,
  pageToken: string,
  metrics: string[],
  startDate: string,
  endDate: string,
): Promise<any[]> => {
  const url = `${GRAPH_BASE}/${pageId}/insights?metric=${metrics.join(",")}&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Insights API error (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.data || [];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

  let connectionId = "";
  let clientId = "";

  try {
    const { connection_id, month, year } = await req.json();
    connectionId = connection_id;

    if (!connectionId || !month || !year) {
      return new Response(JSON.stringify({ error: "connection_id, month, and year are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: conn, error: connError } = await supabaseClient
      .from("platform_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !conn) {
      return new Response(JSON.stringify({ error: "Connection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    clientId = conn.client_id;

    if (!conn.is_connected || !conn.access_token) {
      throw new Error("Facebook connection is not authenticated. Please connect via OAuth first.");
    }

    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      await supabaseClient
        .from("platform_connections")
        .update({ last_error: "Token expired. Please reconnect.", last_sync_status: "failed" })
        .eq("id", connectionId);
      return new Response(JSON.stringify({ error: "Token expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = conn.metadata as any;
    const allPages = metadata?.pages || [];

    let pages: any[];
    if (conn.account_id) {
      const selectedPage = allPages.find((p: any) => String(p.id) === String(conn.account_id));
      if (!selectedPage) {
        throw new Error(`Selected page ${conn.account_id} not found in metadata.`);
      }
      pages = [selectedPage];
      console.log(`Syncing ONLY selected page: ${selectedPage.name} (${selectedPage.id})`);
    } else {
      pages = allPages;
    }

    if (pages.length === 0) {
      throw new Error("No Facebook Pages discovered. Please reconnect Facebook.");
    }

    const { data: clientData } = await supabaseClient.from("clients").select("org_id").eq("id", clientId).single();
    const orgId = clientData?.org_id;

    const { data: syncLog } = await supabaseClient
      .from("sync_logs")
      .insert({ client_id: clientId, platform: "facebook", status: "running", report_month: month, report_year: year, org_id: orgId })
      .select("id")
      .single();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // ── Accumulators ──
    let totalViews = 0;
    let totalUniqueViewers = 0;
    let totalEngagement = 0;
    let totalCTAClicks = 0;
    let totalPageViews = 0;
    let totalLinkClicks = 0;
    let totalNewFollowers = 0;
    let totalUnfollows = 0;
    let currentFollowers = 0;
    let coreInsightsFetched = false;
    const allTopPosts: any[] = [];

    for (const page of pages) {
      const pageToken = page.access_token;
      if (!pageToken) {
        console.error(`No Page Access Token for page ${page.id}.`);
        await supabaseClient.from("platform_connections")
          .update({ last_error: `No token for page ${page.id}`, last_sync_status: "failed" })
          .eq("id", connectionId);
        continue;
      }
      const pageId = page.id;

      // ── Batch 1: Views, unique viewers, engagement, CTA clicks ──
      try {
        const batch1 = await fetchPageInsights(pageId, pageToken, [
          "page_media_view",
          "page_total_media_view_unique",
          "page_post_engagements",
          "page_total_actions",
        ], startDate, endDate);

        totalViews         += sumDailyValues(batch1, "page_media_view");
        totalUniqueViewers += sumDailyValues(batch1, "page_total_media_view_unique");
        totalEngagement    += sumDailyValues(batch1, "page_post_engagements");
        totalCTAClicks     += sumDailyValues(batch1, "page_total_actions");
        coreInsightsFetched = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Batch 1 failed page ${pageId}:`, msg);
        await supabaseClient.from("platform_connections")
          .update({ last_error: `Batch 1 failed: ${msg}`, last_sync_status: "partial" })
          .eq("id", connectionId);
      }

      // ── Batch 2: Page views, link clicks, follows ──
      try {
        const batch2 = await fetchPageInsights(pageId, pageToken, [
          "page_views_total",
          "page_consumptions",
          "page_daily_follows_unique",
          "page_daily_unfollows_unique",
        ], startDate, endDate);

        totalPageViews    += sumDailyValues(batch2, "page_views_total");
        totalLinkClicks   += sumDailyValues(batch2, "page_consumptions");
        totalNewFollowers += sumDailyValues(batch2, "page_daily_follows_unique");
        totalUnfollows    += sumDailyValues(batch2, "page_daily_unfollows_unique");
      } catch (err) {
        console.warn(`Batch 2 failed page ${pageId}:`, err instanceof Error ? err.message : err);
      }

      // ── Call B: Total followers (last daily value) ──
      try {
        const followerUrl = `${GRAPH_BASE}/${pageId}/insights?metric=page_follows&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`;
        const followerRes = await fetch(followerUrl);
        if (followerRes.ok) {
          const followerData = await followerRes.json();
          const values = followerData.data?.[0]?.values || [];
          if (values.length > 0) {
            currentFollowers += Number(values[values.length - 1]?.value || 0);
          }
        }
      } catch (err) {
        console.warn(`Followers fetch failed page ${pageId}:`, err instanceof Error ? err.message : err);
      }

      // ── Posts: published_posts (organic only — dark ad posts excluded) ──
      try {
        let postsUrl: string | null = `${GRAPH_BASE}/${pageId}/published_posts?fields=id,message,created_time,full_picture,permalink_url,is_promoted,reactions.summary(true),comments.summary(true),shares,attachments{media_type,media,url,title}&since=${startDate}&until=${endDate}&limit=100&access_token=${pageToken}`;

        while (postsUrl) {
          const postsRes = await fetch(postsUrl);
          if (!postsRes.ok) {
            const errorBody = await postsRes.text();
            throw new Error(`Posts API error (${postsRes.status}): ${errorBody}`);
          }
          const postsData = await postsRes.json();

          for (const post of (postsData.data || [])) {
            const totalReactions = post.reactions?.summary?.total_count || 0;
            const comments       = post.comments?.summary?.total_count || 0;
            const shares         = post.shares?.count || 0;
            const attachmentType = post.attachments?.data?.[0]?.media_type || 'status';
            const isPromoted     = post.is_promoted === true;

            let postViews = 0;
            let postClicks = 0;
            let postEngagedUsers = 0;
            let postClicksByType: Record<string, number> = {};
            let reactionBreakdown: Record<string, number> = {};

            try {
              const insightMetrics = 'post_media_view,post_clicks,post_clicks_by_type,post_engaged_users,post_reactions_by_type_total';
              const piRes = await fetch(`${GRAPH_BASE}/${post.id}/insights?metric=${insightMetrics}&access_token=${pageToken}`);
              if (piRes.ok) {
                const piData = await piRes.json();
                for (const insight of (piData.data || [])) {
                  const val = insight.values?.[0]?.value;
                  if (insight.name === 'post_media_view')              postViews = Number(val || 0);
                  if (insight.name === 'post_clicks')                  postClicks = Number(val || 0);
                  if (insight.name === 'post_engaged_users')           postEngagedUsers = Number(val || 0);
                  if (insight.name === 'post_clicks_by_type')          postClicksByType = (typeof val === 'object' && val !== null) ? val : {};
                  if (insight.name === 'post_reactions_by_type_total') reactionBreakdown = (typeof val === 'object' && val !== null) ? val : {};
                }
              }
            } catch {} // non-blocking per-post

            allTopPosts.push({
              page_name:      page.name,
              message:        post.message || '',
              created_time:   post.created_time,
              full_picture:   post.full_picture || null,
              permalink_url:  post.permalink_url || null,
              media_type:     attachmentType,
              is_promoted:    isPromoted,
              reactions:      totalReactions,
              likes:          totalReactions,
              comments,
              shares,
              views:          postViews,
              clicks:         postClicks,
              engaged_users:  postEngagedUsers,
              link_clicks:    postClicksByType['link clicks'] || postClicksByType['link_click'] || 0,
              reaction_like:  reactionBreakdown['LIKE'] || 0,
              reaction_love:  reactionBreakdown['LOVE'] || 0,
              reaction_wow:   reactionBreakdown['WOW'] || 0,
              reaction_haha:  reactionBreakdown['HAHA'] || 0,
              reaction_sorry: reactionBreakdown['SORRY'] || 0,
              reaction_anger: reactionBreakdown['ANGER'] || 0,
              total_engagement: totalReactions + comments + shares,
            });
          }

          postsUrl = postsData.paging?.next || null;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Posts sync error page ${pageId}:`, msg);
        await supabaseClient.from("platform_connections")
          .update({ last_error: msg, last_sync_status: "partial" })
          .eq("id", connectionId);
      }
    }

    const topContent = allTopPosts.sort((a, b) => b.total_engagement - a.total_engagement);

    const metricsData = {
      views:           totalViews,
      impressions:     totalViews,
      reach:           totalUniqueViewers,
      engagement:      totalEngagement,
      engagement_rate: totalViews > 0 ? parseFloat(((totalEngagement / totalViews) * 100).toFixed(2)) : 0,
      page_views:      totalPageViews,
      link_clicks:     totalLinkClicks,
      cta_clicks:      totalCTAClicks,
      total_followers: currentFollowers,
      new_followers:   totalNewFollowers,
      unfollows:       totalUnfollows,
      follower_growth: Math.max(totalNewFollowers - totalUnfollows, 0),
      reactions:       allTopPosts.reduce((s, p) => s + (p.reactions || 0), 0),
      likes:           allTopPosts.reduce((s, p) => s + (p.likes || 0), 0),
      comments:        allTopPosts.reduce((s, p) => s + (p.comments || 0), 0),
      shares:          allTopPosts.reduce((s, p) => s + (p.shares || 0), 0),
      posts_published: allTopPosts.length,
      post_views:      allTopPosts.reduce((s, p) => s + (p.views || 0), 0),
      post_clicks:     allTopPosts.reduce((s, p) => s + (p.clicks || 0), 0),
      pages_count:     pages.length,
    };

    // ── Overwrite protection ──
    const hasPostActivity = allTopPosts.some(p => (p.reactions || 0) > 0);
    const allCoreZero = metricsData.views === 0 && metricsData.engagement === 0 && metricsData.total_followers === 0;

    const { data: existing } = await supabaseClient
      .from("monthly_snapshots")
      .select("id, snapshot_locked, metrics_data")
      .eq("client_id", clientId)
      .eq("platform", "facebook")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    if (allCoreZero && hasPostActivity && existing) {
      const existingMetrics = existing.metrics_data as Record<string, number>;
      if ((existingMetrics?.views || 0) > 0 || (existingMetrics?.engagement || 0) > 0) {
        console.warn("Skipping overwrite: new data is all zeros but existing snapshot has real values.");
        await supabaseClient.from("platform_connections")
          .update({ last_sync_status: "partial", last_error: "Core page insights unavailable — existing data preserved." })
          .eq("id", connectionId);
        if (syncLog?.id) {
          await supabaseClient.from("sync_logs")
            .update({ status: "partial", completed_at: new Date().toISOString(), error_message: "Core insights failed, existing snapshot preserved" })
            .eq("id", syncLog.id);
        }
        return new Response(JSON.stringify({ success: false, error: "Core insights unavailable, existing data preserved", posts_count: allTopPosts.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (existing) {
      await supabaseClient.from("monthly_snapshots")
        .update({ metrics_data: metricsData, top_content: topContent })
        .eq("id", existing.id);
    } else {
      await supabaseClient.from("monthly_snapshots")
        .insert({ client_id: clientId, platform: "facebook", report_month: month, report_year: year, metrics_data: metricsData, top_content: topContent });
    }

    await supabaseClient.from("platform_connections")
      .update({ last_sync_at: new Date().toISOString(), last_sync_status: "success", last_error: null })
      .eq("id", connectionId);

    if (syncLog?.id) {
      await supabaseClient.from("sync_logs")
        .update({ status: "success", completed_at: new Date().toISOString() })
        .eq("id", syncLog.id);
    }

    console.log(`Facebook sync complete. views=${totalViews}, reach=${totalUniqueViewers}, engagement=${totalEngagement}, followers=${currentFollowers}, posts=${allTopPosts.length}`);

    return new Response(JSON.stringify({ success: true, metrics: metricsData, pages_synced: pages.length, posts_count: allTopPosts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Facebook Page sync error:", e);
    if (connectionId) {
      await supabaseClient.from("platform_connections")
        .update({ last_sync_status: "failed", last_error: e instanceof Error ? e.message : "Unknown error" })
        .eq("id", connectionId);
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
