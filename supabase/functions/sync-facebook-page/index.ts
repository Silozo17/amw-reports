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
    let totalViews = 0;       // organic only
    let totalViewsAll = 0;    // organic + paid
    let totalUniqueViewers = 0;
    let totalUniqueViewersOrganic = 0;
    let followerStart = 0;
    let followerEnd = 0;
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

      // ── Batch 1a: Organic views via is_from_ads breakdown ──
      // Meta v25 returns FLAT entries: each day has TWO rows with is_from_ads as a sibling field
      // { "value": 25, "is_from_ads": "0" } = organic,  { "value": 3, "is_from_ads": "1" } = paid
      try {
        const viewsUrl = `${GRAPH_BASE}/${pageId}/insights?metric=page_media_view&breakdown=is_from_ads&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`;
        const viewsRes = await fetch(viewsUrl);
        const viewsBody = await viewsRes.json();

        console.log(`page_media_view breakdown response for ${pageId}:`, JSON.stringify(viewsBody).slice(0, 500));

        if (viewsRes.ok && viewsBody.data) {
          for (const metric of viewsBody.data) {
            if (metric.name === 'page_media_view') {
              for (const dayEntry of (metric.values || [])) {
                const dayVal = Number(dayEntry.value || 0);
                const fromAds = String(dayEntry.is_from_ads ?? '');
                if (fromAds === '0' || fromAds === 'false' || fromAds === 'False') {
                  totalViews += dayVal;    // organic
                } else if (fromAds === '1' || fromAds === 'true' || fromAds === 'True') {
                  totalViewsAll += dayVal; // paid (add to total later)
                } else {
                  // No breakdown field — treat as organic (safe fallback)
                  totalViews += dayVal;
                }
              }
            }
          }
          totalViewsAll += totalViews; // totalViewsAll = organic + paid
          console.log(`Views for ${pageId}: organic=${totalViews}, total=${totalViewsAll}`);
          coreInsightsFetched = true;
        } else {
          console.error(`page_media_view breakdown failed for ${pageId}:`, JSON.stringify(viewsBody));
        }
      } catch (err) {
        console.error(`Organic views exception ${pageId}:`, err instanceof Error ? err.message : err);
      }

      // ── Batch 1b: Unique viewers (reach) with organic breakdown ──
      try {
        const reachUrl = `${GRAPH_BASE}/${pageId}/insights?metric=page_total_media_view_unique&breakdown=is_from_ads&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`;
        const reachRes = await fetch(reachUrl);
        const reachBody = await reachRes.json();

        console.log(`page_total_media_view_unique breakdown response for ${pageId}:`, JSON.stringify(reachBody).slice(0, 500));

        if (reachRes.ok && reachBody.data) {
          for (const metric of reachBody.data) {
            if (metric.name === 'page_total_media_view_unique') {
              for (const dayEntry of (metric.values || [])) {
                const dayVal = Number(dayEntry.value || 0);
                const fromAds = String(dayEntry.is_from_ads ?? '');
                if (fromAds === '0' || fromAds === 'false' || fromAds === 'False') {
                  totalUniqueViewersOrganic += dayVal;
                } else if (fromAds === '1' || fromAds === 'true' || fromAds === 'True') {
                  totalUniqueViewers += dayVal; // paid only (add organic later)
                } else {
                  totalUniqueViewersOrganic += dayVal; // fallback: treat as organic
                }
              }
            }
          }
          totalUniqueViewers += totalUniqueViewersOrganic; // total = organic + paid
          console.log(`Reach for ${pageId}: organic=${totalUniqueViewersOrganic}, total=${totalUniqueViewers}`);
        } else {
          // Fallback: use non-breakdown call
          console.warn(`Reach breakdown failed for ${pageId}, falling back to total`);
          const batch1b = await fetchPageInsights(pageId, pageToken, ["page_total_media_view_unique"], startDate, endDate);
          const totalReach = sumDailyValues(batch1b, "page_total_media_view_unique");
          totalUniqueViewers += totalReach;
          totalUniqueViewersOrganic += totalReach; // best effort
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Batch 1b failed page ${pageId}:`, msg);
      }

      // ── Followers: first and last daily value for growth calculation ──
      try {
        const followerUrl = `${GRAPH_BASE}/${pageId}/insights?metric=page_follows&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`;
        const followerRes = await fetch(followerUrl);
        if (followerRes.ok) {
          const followerData = await followerRes.json();
          const values = followerData.data?.[0]?.values || [];
          if (values.length > 0) {
            followerStart += Number(values[0]?.value || 0);
            followerEnd   += Number(values[values.length - 1]?.value || 0);
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

            // Call 1: post views — try post_impressions_unique first, fallback to post_total_media_view_unique
            try {
              const viewsRes = await fetch(
                `${GRAPH_BASE}/${post.id}/insights?metric=post_impressions_unique,post_total_media_view_unique&access_token=${pageToken}`
              );
              const viewsBody = await viewsRes.json();
              if (viewsRes.ok && viewsBody.data) {
                for (const insight of viewsBody.data) {
                  const val = Number(insight.values?.[0]?.value || 0);
                  if (insight.name === 'post_impressions_unique' && val > 0) {
                    postViews = val;
                  }
                  if (insight.name === 'post_total_media_view_unique' && val > 0 && postViews === 0) {
                    postViews = val;
                  }
                }
              } else {
                console.warn(`Post views failed for ${post.id}:`, JSON.stringify(viewsBody).slice(0, 300));
              }
            } catch (err) {
              console.error(`Post views exception ${post.id}:`, err instanceof Error ? err.message : err);
            }

            // Call 2: Object metrics (post_clicks_by_type, post_reactions_by_type_total)
            try {
              const objectRes = await fetch(
                `${GRAPH_BASE}/${post.id}/insights?metric=post_clicks_by_type,post_reactions_by_type_total&access_token=${pageToken}`
              );
              if (objectRes.ok) {
                const objectData = await objectRes.json();
                for (const insight of (objectData.data || [])) {
                  const val = insight.values?.[0]?.value;
                  if (insight.name === 'post_clicks_by_type') {
                    postClicksByType = (typeof val === 'object' && val !== null) ? val : {};
                    // Sum all click types for total clicks
                    postClicks = Object.values(postClicksByType).reduce((s: number, v: any) => s + Number(v || 0), 0);
                  }
                  if (insight.name === 'post_reactions_by_type_total')
                    reactionBreakdown = (typeof val === 'object' && val !== null) ? val : {};
                }
              }
            } catch {} // non-blocking

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

    // Engagement = reactions + comments + shares only (matches Meta Business Suite "Content interactions")
    const totalEngagement = allTopPosts.reduce((s, p) => s + (p.reactions || 0) + (p.comments || 0) + (p.shares || 0), 0);
    console.log(`Computed engagement from posts: ${totalEngagement}`);

    const topContent = allTopPosts.sort((a, b) => b.total_engagement - a.total_engagement);

    const followerGrowth = followerEnd - followerStart;

    const metricsData = {
      views:           totalViews,                // organic only
      views_total:     totalViewsAll,             // organic + paid
      reach:           totalUniqueViewersOrganic,  // organic only
      reach_total:     totalUniqueViewers,         // organic + paid
      engagement:      totalEngagement,
      engagement_rate: totalViews > 0 ? parseFloat(((totalEngagement / totalViews) * 100).toFixed(2)) : 0,
      total_followers: followerEnd,
      follower_growth: followerGrowth,
      reactions:       allTopPosts.reduce((s, p) => s + (p.reactions || 0), 0),
      likes:           allTopPosts.reduce((s, p) => s + (p.likes || 0), 0),
      comments:        allTopPosts.reduce((s, p) => s + (p.comments || 0), 0),
      shares:          allTopPosts.reduce((s, p) => s + (p.shares || 0), 0),
      post_clicks:     allTopPosts.reduce((s, p) => s + (p.clicks || 0), 0),
      posts_published: allTopPosts.length,
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

    console.log(`Facebook sync complete. organic_views=${totalViews}, total_views=${totalViewsAll}, reach=${totalUniqueViewers}, engagement=${totalEngagement}, followers=${followerEnd}, growth=${followerGrowth}, posts=${allTopPosts.length}`);

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
