import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_BASE = "https://graph.facebook.com/v25.0";
const DEADLINE_MS = 50_000; // 50s safety net (edge fn timeout ~60s)
const BATCH_SIZE = 25;      // post IDs per batch insight call
const MAX_POSTS = 200;      // cap posts to prevent timeout
const FETCH_TIMEOUT_MS = 8_000; // per-request timeout

/** Fetch with AbortController timeout */
const fetchWithTimeout = async (url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
};

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
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Insights API error (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.data || [];
};

/**
 * Batch-fetch post insights for multiple post IDs in one API call.
 * Uses the ?ids= parameter to fetch insights for up to BATCH_SIZE posts.
 * Returns a map of postId → { views, clicks, clicksByType, reactionBreakdown }
 */
const batchFetchPostInsights = async (
  postIds: string[],
  pageToken: string,
): Promise<Map<string, { views: number; clicks: number; clicksByType: Record<string, number>; reactionBreakdown: Record<string, number> }>> => {
  const result = new Map<string, { views: number; clicks: number; clicksByType: Record<string, number>; reactionBreakdown: Record<string, number> }>();

  // Initialize defaults
  for (const id of postIds) {
    result.set(id, { views: 0, clicks: 0, clicksByType: {}, reactionBreakdown: {} });
  }

  // Batch 1: post views (post_impressions_unique, post_total_media_view_unique)
  try {
    const ids = postIds.join(",");
    const url = `${GRAPH_BASE}/?ids=${ids}&fields=insights.metric(post_impressions_unique,post_total_media_view_unique)&access_token=${pageToken}`;
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const data = await res.json();
      for (const postId of postIds) {
        const postData = data[postId];
        if (!postData?.insights?.data) continue;
        const entry = result.get(postId)!;
        for (const insight of postData.insights.data) {
          const val = Number(insight.values?.[0]?.value || 0);
          if (insight.name === "post_impressions_unique" && val > 0) {
            entry.views = val;
          }
          if (insight.name === "post_total_media_view_unique" && val > 0 && entry.views === 0) {
            entry.views = val;
          }
        }
      }
    } else {
      const body = await res.text();
      console.warn(`Batch views failed: ${body.slice(0, 300)}`);
    }
  } catch (err) {
    console.error("Batch views exception:", err instanceof Error ? err.message : err);
  }

  // Batch 2: clicks + reaction breakdown
  try {
    const ids = postIds.join(",");
    const url = `${GRAPH_BASE}/?ids=${ids}&fields=insights.metric(post_clicks_by_type,post_reactions_by_type_total)&access_token=${pageToken}`;
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const data = await res.json();
      for (const postId of postIds) {
        const postData = data[postId];
        if (!postData?.insights?.data) continue;
        const entry = result.get(postId)!;
        for (const insight of (postData.insights.data || [])) {
          const val = insight.values?.[0]?.value;
          if (insight.name === "post_clicks_by_type") {
            entry.clicksByType = (typeof val === "object" && val !== null) ? val : {};
            entry.clicks = Object.values(entry.clicksByType).reduce((s: number, v: any) => s + Number(v || 0), 0);
          }
          if (insight.name === "post_reactions_by_type_total") {
            entry.reactionBreakdown = (typeof val === "object" && val !== null) ? val : {};
          }
        }
      }
    } else {
      const body = await res.text();
      console.warn(`Batch clicks failed: ${body.slice(0, 300)}`);
    }
  } catch (err) {
    console.error("Batch clicks exception:", err instanceof Error ? err.message : err);
  }

  return result;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const isNearTimeout = () => Date.now() - startTime > DEADLINE_MS;

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

    // Page tokens stored in metadata are permanent — no expiry check needed

    const metadata = conn.metadata as Record<string, unknown> | null;
    const allPages = ((metadata?.pages) as Array<{ id?: string; name?: string; access_token?: string }>) || [];

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

    // Verify requesting user belongs to the client's org
    const authHeader = req.headers.get("Authorization");
    if (authHeader && orgId) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabaseClient.auth.getUser(token);
      if (caller) {
        const { data: membership } = await supabaseClient.from("org_members").select("id").eq("user_id", caller.id).eq("org_id", orgId).limit(1).single();
        if (!membership) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // ── Cleanup stuck sync_logs (older than 5 minutes, still "running") ──
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await supabaseClient
      .from("sync_logs")
      .update({ status: "failed", completed_at: new Date().toISOString(), error_message: "Timeout — sync did not complete" })
      .eq("client_id", clientId)
      .eq("platform", "facebook")
      .eq("status", "running")
      .lt("started_at", fiveMinAgo);

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
    let timedOut = false;

    for (const page of pages) {
      const pageToken = page.access_token ? await decryptToken(page.access_token) : null;
      if (!pageToken) {
        console.error(`No Page Access Token for page ${page.id}.`);
        await supabaseClient.from("platform_connections")
          .update({ last_error: `No token for page ${page.id}`, last_sync_status: "failed" })
          .eq("id", connectionId);
        continue;
      }
      const pageId = page.id;

      // ── Batch 1a: Organic views via is_from_ads breakdown ──
      try {
        const viewsUrl = `${GRAPH_BASE}/${pageId}/insights?metric=page_media_view&breakdown=is_from_ads&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`;
        const viewsRes = await fetchWithTimeout(viewsUrl);
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
                  totalViews += dayVal;
                }
              }
            }
          }
          totalViewsAll += totalViews;
          console.log(`Views for ${pageId}: organic=${totalViews}, total=${totalViewsAll}`);
          coreInsightsFetched = true;
        } else {
          console.error(`page_media_view breakdown failed for ${pageId}:`, JSON.stringify(viewsBody));
        }
      } catch (err) {
        console.error(`Organic views exception ${pageId}:`, err instanceof Error ? err.message : err);
      }

      // ── Reach: organic and total using dedicated Facebook metrics ──
      try {
        const reachData = await fetchPageInsights(
          pageId,
          pageToken,
          ["page_impressions_organic_unique", "page_impressions_unique"],
          startDate,
          endDate,
        );
        const pageOrganicReach = sumDailyValues(reachData, "page_impressions_organic_unique");
        const pageTotalReach = sumDailyValues(reachData, "page_impressions_unique");
        totalUniqueViewersOrganic += pageOrganicReach;
        totalUniqueViewers += pageTotalReach;
        console.log(`Reach for ${pageId}: organic=${pageOrganicReach}, total=${pageTotalReach}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Reach fetch failed page ${pageId}:`, msg);
      }

      // ── Followers: first and last daily value for growth calculation ──
      try {
        const followerUrl = `${GRAPH_BASE}/${pageId}/insights?metric=page_follows&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`;
        const followerRes = await fetchWithTimeout(followerUrl);
        if (followerRes.ok) {
          const followerData = await followerRes.json();
          const values = followerData.data?.[0]?.values || [];
          if (values.length > 0) {
            followerStart += Number(values[0]?.value || 0);
            followerEnd   += Number(values[values.length - 1]?.value || 0);
          }
        } else {
          await followerRes.text(); // consume body
        }
      } catch (err) {
        console.warn(`Followers fetch failed page ${pageId}:`, err instanceof Error ? err.message : err);
      }

      // ── Phase 1: Collect post metadata (no per-post API calls) ──
      const rawPosts: any[] = [];
      try {
        let postsUrl: string | null = `${GRAPH_BASE}/${pageId}/published_posts?fields=id,message,created_time,full_picture,permalink_url,is_promoted,reactions.summary(true),comments.summary(true),shares,attachments{media_type,media,url,title}&since=${startDate}&until=${endDate}&limit=100&access_token=${pageToken}`;

        while (postsUrl) {
          if (isNearTimeout()) {
            console.warn("Approaching timeout during post pagination, stopping.");
            timedOut = true;
            break;
          }
          const postsRes = await fetchWithTimeout(postsUrl);
          if (!postsRes.ok) {
            const errorBody = await postsRes.text();
            throw new Error(`Posts API error (${postsRes.status}): ${errorBody}`);
          }
          const postsData = await postsRes.json();

          for (const post of (postsData.data || [])) {
            rawPosts.push({
              ...post,
              page_name: page.name,
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

      // Cap to top MAX_POSTS by engagement to prevent timeout
      const sortedPosts = rawPosts
        .map(post => ({
          post,
          engagement: (post.reactions?.summary?.total_count || 0) + (post.comments?.summary?.total_count || 0) + (post.shares?.count || 0),
        }))
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, MAX_POSTS)
        .map(x => x.post);

      console.log(`Page ${pageId}: ${rawPosts.length} posts found, processing top ${sortedPosts.length}`);

      // Build initial post entries (no insights yet)
      const postEntries: any[] = [];
      for (const post of sortedPosts) {
        const totalReactions = post.reactions?.summary?.total_count || 0;
        const comments       = post.comments?.summary?.total_count || 0;
        const shares         = post.shares?.count || 0;
        const attachmentType = post.attachments?.data?.[0]?.media_type || 'status';
        const isPromoted     = post.is_promoted === true;

        postEntries.push({
          id:             post.id,
          page_name:      post.page_name,
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
          views:          0,
          clicks:         0,
          engaged_users:  0,
          link_clicks:    0,
          reaction_like:  0,
          reaction_love:  0,
          reaction_wow:   0,
          reaction_haha:  0,
          reaction_sorry: 0,
          reaction_anger: 0,
          total_engagement: totalReactions + comments + shares,
        });
      }

      // ── Phase 2: Batch-fetch post insights in chunks of BATCH_SIZE ──
      const postIds = postEntries.map(p => p.id);
      const postMap = new Map(postEntries.map(p => [p.id, p]));

      for (let i = 0; i < postIds.length; i += BATCH_SIZE) {
        if (isNearTimeout()) {
          console.warn(`Approaching timeout at batch ${i}/${postIds.length}, saving partial data.`);
          timedOut = true;
          break;
        }

        const batchIds = postIds.slice(i, i + BATCH_SIZE);
        const insights = await batchFetchPostInsights(batchIds, pageToken);

        for (const [postId, data] of insights) {
          const entry = postMap.get(postId);
          if (!entry) continue;
          entry.views = data.views;
          entry.clicks = data.clicks;
          entry.link_clicks = data.clicksByType['link clicks'] || data.clicksByType['link_click'] || 0;
          entry.reaction_like  = data.reactionBreakdown['LIKE'] || 0;
          entry.reaction_love  = data.reactionBreakdown['LOVE'] || 0;
          entry.reaction_wow   = data.reactionBreakdown['WOW'] || 0;
          entry.reaction_haha  = data.reactionBreakdown['HAHA'] || 0;
          entry.reaction_sorry = data.reactionBreakdown['SORRY'] || 0;
          entry.reaction_anger = data.reactionBreakdown['ANGER'] || 0;
        }
      }

      allTopPosts.push(...postEntries);
    }

    // Engagement = reactions + comments + shares only
    const totalEngagement = allTopPosts.reduce((s, p) => s + (p.reactions || 0) + (p.comments || 0) + (p.shares || 0), 0);
    console.log(`Computed engagement from posts: ${totalEngagement}`);

    const topContent = allTopPosts.sort((a, b) => b.total_engagement - a.total_engagement);

    const followerGrowth = followerEnd - followerStart;

    const metricsData = {
      views:           totalViews,
      views_total:     totalViewsAll,
      reach:           totalUniqueViewersOrganic,
      reach_total:     totalUniqueViewers,
      engagement:      totalEngagement,
      engagement_rate: totalViews > 0 ? parseFloat(((totalEngagement / totalViews) * 100).toFixed(2)) : 0,
      total_followers: followerEnd,
      follower_growth: followerGrowth,
      reactions:       allTopPosts.reduce((s, p) => s + (p.reactions || 0), 0),
      likes:           allTopPosts.reduce((s, p) => s + (p.likes || 0), 0),
      comments:        allTopPosts.reduce((s, p) => s + (p.comments || 0), 0),
      shares:          allTopPosts.reduce((s, p) => s + (p.shares || 0), 0),
      post_clicks:     allTopPosts.reduce((s, p) => s + (p.clicks || 0), 0),
      impressions:     totalViews,
      clicks:          allTopPosts.reduce((s, p) => s + (p.clicks || 0), 0),
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

    const finalStatus = timedOut ? "partial" : "success";

    await supabaseClient.from("platform_connections")
      .update({ last_sync_at: new Date().toISOString(), last_sync_status: finalStatus, last_error: timedOut ? "Completed with partial post insights (timeout safety)" : null })
      .eq("id", connectionId);

    if (syncLog?.id) {
      await supabaseClient.from("sync_logs")
        .update({ status: finalStatus, completed_at: new Date().toISOString(), error_message: timedOut ? "Partial — timeout safety triggered" : null })
        .eq("id", syncLog.id);
    }

    console.log(`Facebook sync complete (${finalStatus}). organic_views=${totalViews}, total_views=${totalViewsAll}, reach=${totalUniqueViewers}, engagement=${totalEngagement}, followers=${followerEnd}, growth=${followerGrowth}, posts=${allTopPosts.length}`);

    return new Response(JSON.stringify({ success: true, status: finalStatus, metrics: metricsData, pages_synced: pages.length, posts_count: allTopPosts.length }), {
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
