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

    // Accumulators
    let totalEngagement = 0;
    let totalPageViews = 0;
    let totalLinkClicks = 0;

    // Organic metrics (native from FB API)
    let organicReach = 0;          // page_impressions_organic_unique
    let organicVideoViews = 0;     // page_video_views_organic

    // Paid metrics
    let paidImpressions = 0;       // page_impressions_paid
    let paidVideoViews = 0;        // page_video_views_paid

    // Totals (for reference & organic impressions calculation)
    let totalImpressions = 0;      // page_impressions
    let totalVideoViews = 0;       // page_video_views

    // Media view breakdown (secondary signal)
    let totalMediaViews = 0;
    let totalMediaViewsPaid = 0;
    let totalMediaViewsOrganic = 0;

    const metricsAccum: Record<string, number> = {};
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

      // 1. Core organic/paid page-level metrics
      try {
        const coreMetrics = await fetchPageInsights(pageId, pageToken, [
          "page_post_engagements",
          "page_follows",
          "page_impressions",
          "page_impressions_paid",
          "page_impressions_organic_unique",
          "page_video_views",
          "page_video_views_organic",
          "page_video_views_paid",
        ], startDate, endDate);

        totalEngagement += sumDailyValues(coreMetrics, "page_post_engagements");
        totalImpressions += sumDailyValues(coreMetrics, "page_impressions");
        paidImpressions += sumDailyValues(coreMetrics, "page_impressions_paid");
        organicReach += sumDailyValues(coreMetrics, "page_impressions_organic_unique");
        totalVideoViews += sumDailyValues(coreMetrics, "page_video_views");
        organicVideoViews += sumDailyValues(coreMetrics, "page_video_views_organic");
        paidVideoViews += sumDailyValues(coreMetrics, "page_video_views_paid");

        // page_follows: get growth from first to last day
        for (const metric of coreMetrics) {
          if (metric.name === "page_follows") {
            const values = metric.values || [];
            const lastValue = values.at(-1)?.value || 0;
            const firstValue = values.at(0)?.value || 0;
            metricsAccum.total_fans = (metricsAccum.total_fans || 0) + Number(lastValue);
            metricsAccum.follower_growth = (metricsAccum.follower_growth || 0) + (Number(lastValue) - Number(firstValue));
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Core insights error page ${pageId}:`, errorMsg);
        await supabaseClient.from("platform_connections")
          .update({ last_error: errorMsg, last_sync_status: "partial" })
          .eq("id", connectionId);
      }

      // 2. page_media_view (total)
      try {
        const mediaViewData = await fetchPageInsights(pageId, pageToken, ["page_media_view"], startDate, endDate);
        totalMediaViews += sumDailyValues(mediaViewData, "page_media_view");
      } catch {} // non-blocking

      // 3. page_media_view with is_from_ads breakdown (secondary signal)
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

      // 4. page_views_total
      try {
        const pageViewsData = await fetchPageInsights(pageId, pageToken, ["page_views_total"], startDate, endDate);
        totalPageViews += sumDailyValues(pageViewsData, "page_views_total");
      } catch {} // non-blocking

      // 5. page_consumptions (link clicks)
      try {
        const consumptionsData = await fetchPageInsights(pageId, pageToken, ["page_consumptions"], startDate, endDate);
        totalLinkClicks += sumDailyValues(consumptionsData, "page_consumptions");
      } catch {} // non-blocking

      // 6. Fetch ALL posts with basic fields, then fetch per-post insights individually
      try {
        let postsUrl: string | null = `${GRAPH_BASE}/${pageId}/published_posts?fields=message,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true),shares,attachments{media_type,media,url,title}&since=${startDate}&until=${endDate}&limit=100&access_token=${pageToken}`;

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
              const attachmentType = post.attachments?.data?.[0]?.media_type || '';
              const isVideo = attachmentType === 'video' || attachmentType === 'video_inline';

              // Fetch per-post insights: organic reach, paid reach, video views
              let postOrganicReach = 0;
              let postPaidReach = 0;
              let postClicks = 0;
              let postVideoViews = 0;

              try {
                const insightMetrics = isVideo
                  ? 'post_impressions_organic_unique,post_impressions_paid_unique,post_clicks,post_video_views'
                  : 'post_impressions_organic_unique,post_impressions_paid_unique,post_clicks';

                const postInsightsUrl = `${GRAPH_BASE}/${post.id}/insights?metric=${insightMetrics}&access_token=${pageToken}`;
                const postInsightsRes = await fetch(postInsightsUrl);

                if (postInsightsRes.ok) {
                  const postInsightsData = await postInsightsRes.json();
                  for (const insight of postInsightsData.data || []) {
                    const val = insight.values?.[0]?.value || 0;
                    if (insight.name === 'post_impressions_organic_unique') postOrganicReach = val;
                    if (insight.name === 'post_impressions_paid_unique') postPaidReach = val;
                    if (insight.name === 'post_clicks') postClicks = val;
                    if (insight.name === 'post_video_views') postVideoViews = val;
                  }
                }
              } catch {} // non-blocking per-post

              const isBoosted = postPaidReach > 0;

              allTopPosts.push({
                page_name: page.name,
                message: post.message || "",
                created_time: post.created_time,
                full_picture: post.full_picture || null,
                permalink_url: post.permalink_url || null,
                likes,
                comments,
                shares,
                reach: postOrganicReach,
                organic_reach: postOrganicReach,
                paid_reach: postPaidReach,
                clicks: postClicks,
                video_views: postVideoViews > 0 ? postVideoViews : undefined,
                media_type: attachmentType || 'status',
                total_engagement: likes + comments + shares,
                is_boosted: isBoosted,
              });
            }
          }

          postsUrl = postsData.paging?.next || null;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Posts sync error page ${pageId}:`, errorMsg);
        await supabaseClient.from("platform_connections")
          .update({ last_error: errorMsg, last_sync_status: "partial" })
          .eq("id", connectionId);
      }
    }

    // Sort by engagement, keep all
    const topContent = allTopPosts.sort((a, b) => b.total_engagement - a.total_engagement);

    // Aggregate video views from posts (month-specific, not lifetime)
    const monthlyVideoViews = allTopPosts.reduce((sum, p) => sum + (p.video_views || 0), 0);

    // Organic impressions: total - paid (no native organic-only impressions metric exists at non-unique level)
    const organicImpressions = Math.max(totalImpressions - paidImpressions, 0);

    // Use native organic metrics as primary; fall back to media view breakdown if core metrics failed
    const finalOrganicReach = organicReach > 0 ? organicReach : totalMediaViewsOrganic;
    const finalOrganicVideoViews = organicVideoViews > 0 ? organicVideoViews : Math.max(monthlyVideoViews - paidVideoViews, 0);

    // Paid reach: use page_impressions_paid as approximation (FB doesn't have page_impressions_paid_unique at page level)
    // We already have paidImpressions from page_impressions_paid
    const finalPaidReach = paidImpressions; // paid impressions serves as the paid reach proxy

    const metricsData = {
      // Organic-only (primary display metrics)
      impressions: organicImpressions,
      organic_impressions: organicImpressions,
      reach: finalOrganicReach,
      video_views: finalOrganicVideoViews,

      // Paid (stored for separate display — for boosted posts / ads run through FB)
      paid_impressions: paidImpressions,
      paid_reach: finalPaidReach,
      paid_video_views: paidVideoViews,

      // Totals (for reference / validation)
      total_impressions: totalImpressions,
      total_video_views: totalVideoViews > 0 ? totalVideoViews : monthlyVideoViews,

      // These are fine as-is (engagement includes all sources, which is acceptable)
      engagement: totalEngagement,
      page_views: totalPageViews,
      link_clicks: totalLinkClicks,
      follower_growth: metricsAccum.follower_growth || 0,
      total_followers: metricsAccum.total_fans || 0,
      likes: allTopPosts.reduce((s, p) => s + (p.likes || 0), 0),
      comments: allTopPosts.reduce((s, p) => s + (p.comments || 0), 0),
      shares: allTopPosts.reduce((s, p) => s + (p.shares || 0), 0),
      posts_published: allTopPosts.length,
      engagement_rate: finalOrganicReach > 0 ? (totalEngagement / finalOrganicReach) * 100 : 0,
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

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

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

    console.log(`Facebook sync complete. organic_reach=${finalOrganicReach}, organic_impressions=${organicImpressions}, paid_impressions=${paidImpressions}, organic_video_views=${finalOrganicVideoViews}, paid_video_views=${paidVideoViews}, posts=${allTopPosts.length}`);

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
