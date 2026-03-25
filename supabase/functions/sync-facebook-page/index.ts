import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_BASE = "https://graph.facebook.com/v25.0";

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

    // Filter to the selected page (account_id) only
    let pages: any[];
    if (conn.account_id) {
      const selectedPage = allPages.find((p: any) => String(p.id) === String(conn.account_id));
      if (!selectedPage) {
        throw new Error(`Selected page ${conn.account_id} not found in metadata. Available: ${allPages.map((p: any) => p.id).join(", ")}`);
      }
      pages = [selectedPage];
      console.log(`Syncing ONLY selected page: ${selectedPage.name} (${selectedPage.id})`);
    } else {
      pages = allPages;
      console.log(`No account_id set — syncing all ${pages.length} pages (legacy mode)`);
    }

    if (pages.length === 0) {
      throw new Error("No Facebook Pages discovered. Please reconnect Facebook to grant page permissions.");
    }

    const { data: clientData } = await supabaseClient.from("clients").select("org_id").eq("id", clientId).single();
    const orgId = clientData?.org_id;

    const { data: syncLog } = await supabaseClient
      .from("sync_logs")
      .insert({ client_id: clientId, platform: "facebook", status: "running", report_month: month, report_year: year, org_id: orgId })
      .select("id")
      .single();

    // Build date range
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    let totalEngagement = 0;
    let totalMediaViews = 0;
    let totalMediaViewsPaid = 0;
    let totalMediaViewsOrganic = 0;
    let totalPageViews = 0;
    let totalLinkClicks = 0;
    const metricsAccum: Record<string, number> = {};
    const allTopPosts: any[] = [];

    for (const page of pages) {
      const pageToken = page.access_token;
      if (!pageToken) {
        console.error(`No Page Access Token for page ${page.id}. Reconnect Facebook.`);
        await supabaseClient
          .from("platform_connections")
          .update({ last_error: `No token for page ${page.id}`, last_sync_status: "failed" })
          .eq("id", connectionId);
        continue;
      }
      const pageId = page.id;

      // 1. Fetch core insights: page_post_engagements + page_follows
      try {
        const insightsUrl = `${GRAPH_BASE}/${pageId}/insights?metric=page_post_engagements,page_follows&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`;
        console.log(`Fetching insights for page ${pageId} (${page.name})`);
        const insightsRes = await fetch(insightsUrl);
        if (!insightsRes.ok) {
          const errorBody = await insightsRes.text();
          throw new Error(`Insights API error (${insightsRes.status}): ${errorBody}`);
        }
        const insightsData = await insightsRes.json();

        if (insightsData.data) {
          for (const metric of insightsData.data) {
            const values = metric.values || [];
            if (metric.name === "page_post_engagements") {
              totalEngagement += values.reduce((sum: number, v: any) => sum + (Number(v.value) || 0), 0);
            } else if (metric.name === "page_follows") {
              const lastValue = values.at(-1)?.value || 0;
              const firstValue = values.at(0)?.value || 0;
              metricsAccum.total_fans = (metricsAccum.total_fans || 0) + Number(lastValue);
              metricsAccum.follower_growth = (metricsAccum.follower_growth || 0) + (Number(lastValue) - Number(firstValue));
            }
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Insights sync error for page ${pageId}:`, errorMsg);
        await supabaseClient
          .from("platform_connections")
          .update({ last_error: errorMsg, last_sync_status: "partial" })
          .eq("id", connectionId);
      }

      // 2. Fetch page_media_view (replaces deprecated page_impressions)
      try {
        const mediaViewUrl = `${GRAPH_BASE}/${pageId}/insights?metric=page_media_view&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`;
        const mediaViewRes = await fetch(mediaViewUrl);
        if (mediaViewRes.ok) {
          const mediaViewData = await mediaViewRes.json();
          if (mediaViewData.data) {
            for (const metric of mediaViewData.data) {
              totalMediaViews += (metric.values || []).reduce((sum: number, v: any) => sum + (Number(v.value) || 0), 0);
            }
          }
        }
      } catch {} // non-blocking

      // 3. Fetch page_media_view with is_from_ads breakdown for paid vs organic
      try {
        const breakdownUrl = `${GRAPH_BASE}/${pageId}/insights?metric=page_media_view&period=day&since=${startDate}&until=${endDate}&breakdowns=is_from_ads&access_token=${pageToken}`;
        const breakdownRes = await fetch(breakdownUrl);
        if (breakdownRes.ok) {
          const breakdownData = await breakdownRes.json();
          if (breakdownData.data) {
            for (const metric of breakdownData.data) {
              for (const val of metric.values || []) {
                if (val.value && typeof val.value === "object") {
                  totalMediaViewsPaid += Number(val.value["true"] || 0);
                  totalMediaViewsOrganic += Number(val.value["false"] || 0);
                }
              }
            }
          }
        }
      } catch {} // non-blocking

      // 4. Fetch page_views_total (Page Visits)
      try {
        const pageViewsUrl = `${GRAPH_BASE}/${pageId}/insights?metric=page_views_total&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`;
        const pageViewsRes = await fetch(pageViewsUrl);
        if (pageViewsRes.ok) {
          const pageViewsData = await pageViewsRes.json();
          if (pageViewsData.data) {
            for (const metric of pageViewsData.data) {
              totalPageViews += (metric.values || []).reduce((sum: number, v: any) => sum + (Number(v.value) || 0), 0);
            }
          }
        }
      } catch {} // non-blocking

      // 5. Fetch page_consumptions (Link Clicks / Content Clicks)
      try {
        const consumptionsUrl = `${GRAPH_BASE}/${pageId}/insights?metric=page_consumptions&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`;
        const consumptionsRes = await fetch(consumptionsUrl);
        if (consumptionsRes.ok) {
          const consumptionsData = await consumptionsRes.json();
          if (consumptionsData.data) {
            for (const metric of consumptionsData.data) {
              totalLinkClicks += (metric.values || []).reduce((sum: number, v: any) => sum + (Number(v.value) || 0), 0);
            }
          }
        }
      } catch {} // non-blocking

      // 6. Fetch video stats
      try {
        const videoUrl = `${GRAPH_BASE}/${pageId}/video_posts?fields=length,description,created_time,video_insights{name,values}&since=${startDate}&until=${endDate}&limit=25&access_token=${pageToken}`;
        const videoRes = await fetch(videoUrl);
        if (videoRes.ok) {
          const videoData = await videoRes.json();
          for (const video of videoData.data || []) {
            for (const insight of video.video_insights?.data || []) {
              if (insight.name === "total_video_views") {
                metricsAccum.video_views = (metricsAccum.video_views || 0) + (insight.values?.[0]?.value || 0);
              }
            }
          }
        }
      } catch {} // non-blocking

      // 7. Fetch ALL posts with full content, images, and per-post insights
      try {
        let postsUrl: string | null = `${GRAPH_BASE}/${pageId}/published_posts?fields=message,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true),shares,reactions.summary(true),insights.metric(post_impressions_unique,post_clicks){values}&since=${startDate}&until=${endDate}&limit=100&access_token=${pageToken}`;

        while (postsUrl) {
          const postsRes = await fetch(postsUrl);
          if (!postsRes.ok) {
            const errorBody = await postsRes.text();
            throw new Error(`Posts API error (${postsRes.status}): ${errorBody}`);
          }
          const postsData = await postsRes.json();

          if (postsData.data) {
            for (const post of postsData.data) {
              const likes = post.likes?.summary?.total_count || 0;
              const comments = post.comments?.summary?.total_count || 0;
              const shares = post.shares?.count || 0;

              // Extract per-post reach and clicks from inline insights
              let postReach = 0;
              let postClicks = 0;
              if (post.insights?.data) {
                for (const insight of post.insights.data) {
                  if (insight.name === "post_impressions_unique") {
                    postReach = insight.values?.[0]?.value || 0;
                  } else if (insight.name === "post_clicks") {
                    postClicks = insight.values?.[0]?.value || 0;
                  }
                }
              }

              allTopPosts.push({
                page_name: page.name,
                message: post.message || "",
                created_time: post.created_time,
                full_picture: post.full_picture || null,
                permalink_url: post.permalink_url || null,
                likes,
                comments,
                shares,
                reach: postReach,
                clicks: postClicks,
                total_engagement: likes + comments + shares,
              });
            }
          }

          // Paginate if more posts exist
          postsUrl = postsData.paging?.next || null;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Posts sync error for page ${pageId}:`, errorMsg);
        await supabaseClient
          .from("platform_connections")
          .update({ last_error: errorMsg, last_sync_status: "partial" })
          .eq("id", connectionId);
      }
    }

    // Sort all posts by engagement, keep all of them
    const topContent = allTopPosts.sort((a, b) => b.total_engagement - a.total_engagement);

    const metricsData = {
      impressions: totalMediaViews,
      organic_impressions: totalMediaViewsOrganic || Math.max(totalMediaViews - totalMediaViewsPaid, 0),
      paid_impressions: totalMediaViewsPaid,
      reach: totalMediaViews,
      engagement: totalEngagement,
      page_views: totalPageViews,
      link_clicks: totalLinkClicks,
      follower_growth: metricsAccum.follower_growth || 0,
      total_followers: metricsAccum.total_fans || 0,
      video_views: metricsAccum.video_views || 0,
      likes: allTopPosts.reduce((s, p) => s + (p.likes || 0), 0),
      comments: allTopPosts.reduce((s, p) => s + (p.comments || 0), 0),
      shares: allTopPosts.reduce((s, p) => s + (p.shares || 0), 0),
      posts_published: allTopPosts.length,
      engagement_rate: totalMediaViews > 0 ? (totalEngagement / totalMediaViews) * 100 : 0,
      pages_count: pages.length,
    };

    // Upsert monthly snapshot
    const { data: existing } = await supabaseClient
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "facebook")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) {
      throw new Error("Snapshot for this period is locked.");
    }

    if (existing) {
      await supabaseClient
        .from("monthly_snapshots")
        .update({ metrics_data: metricsData, top_content: topContent })
        .eq("id", existing.id);
    } else {
      await supabaseClient
        .from("monthly_snapshots")
        .insert({
          client_id: clientId,
          platform: "facebook",
          report_month: month,
          report_year: year,
          metrics_data: metricsData,
          top_content: topContent,
        });
    }

    await supabaseClient
      .from("platform_connections")
      .update({ last_sync_at: new Date().toISOString(), last_sync_status: "success", last_error: null })
      .eq("id", connectionId);

    if (syncLog?.id) {
      await supabaseClient
        .from("sync_logs")
        .update({ status: "success", completed_at: new Date().toISOString() })
        .eq("id", syncLog.id);
    }

    console.log(`Facebook sync complete. Pages synced: ${pages.length}, Metrics:`, JSON.stringify(metricsData));

    return new Response(JSON.stringify({ success: true, metrics: metricsData, pages_synced: pages.length, posts_count: allTopPosts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Facebook Page sync error:", e);
    if (connectionId) {
      await supabaseClient
        .from("platform_connections")
        .update({ last_sync_status: "failed", last_error: e instanceof Error ? e.message : "Unknown error" })
        .eq("id", connectionId);
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
