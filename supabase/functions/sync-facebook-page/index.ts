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
    let totalImpressions = 0;
    let totalVideoViews = 0;
    let totalEngagement = 0;
    let totalPageViews = 0;
    let totalLinkClicks = 0;
    let paidImpressions = 0;
    let paidVideoViews = 0;

    let coreInsightsFetched = false;

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

      // ── Call A: Totals (stable, always-supported metrics) ──
      try {
        const totalMetrics = await fetchPageInsights(pageId, pageToken, [
          "page_post_engagements",
          "page_follows",
          "page_impressions",
          "page_views_total",
          "page_consumptions",
          "page_video_views",
        ], startDate, endDate);

        totalEngagement += sumDailyValues(totalMetrics, "page_post_engagements");
        totalImpressions += sumDailyValues(totalMetrics, "page_impressions");
        totalVideoViews += sumDailyValues(totalMetrics, "page_video_views");
        totalPageViews += sumDailyValues(totalMetrics, "page_views_total");
        totalLinkClicks += sumDailyValues(totalMetrics, "page_consumptions");

        // page_follows: get growth from first to last day
        for (const metric of totalMetrics) {
          if (metric.name === "page_follows") {
            const values = metric.values || [];
            const lastValue = values.at(-1)?.value || 0;
            const firstValue = values.at(0)?.value || 0;
            metricsAccum.total_fans = (metricsAccum.total_fans || 0) + Number(lastValue);
            metricsAccum.follower_growth = (metricsAccum.follower_growth || 0) + (Number(lastValue) - Number(firstValue));
          }
        }

        coreInsightsFetched = true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Core totals error page ${pageId}:`, errorMsg);
        await supabaseClient.from("platform_connections")
          .update({ last_error: `Core insights failed: ${errorMsg}`, last_sync_status: "partial" })
          .eq("id", connectionId);
      }

      // ── Call B: Paid breakdown (separate, non-blocking) ──
      try {
        const paidMetrics = await fetchPageInsights(pageId, pageToken, [
          "page_impressions_paid",
          "page_video_views_paid",
        ], startDate, endDate);

        paidImpressions += sumDailyValues(paidMetrics, "page_impressions_paid");
        paidVideoViews += sumDailyValues(paidMetrics, "page_video_views_paid");
      } catch (err) {
        // Non-blocking: if paid metrics fail, paid = 0, so organic = total (safe)
        console.warn(`Paid metrics unavailable for page ${pageId}:`, err instanceof Error ? err.message : err);
      }

      // ── Posts: fetch all with per-post insights ──
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

    // ── Organic = Total - Paid ──
    const organicImpressions = Math.max(totalImpressions - paidImpressions, 0);
    const organicVideoViews = Math.max(totalVideoViews - paidVideoViews, 0);

    // Fallback: if page-level video views are 0, aggregate from posts
    const monthlyVideoViewsFromPosts = allTopPosts.reduce((sum, p) => sum + (p.video_views || 0), 0);
    const finalOrganicVideoViews = organicVideoViews > 0 ? organicVideoViews : monthlyVideoViewsFromPosts;

    const metricsData = {
      // Organic (Total - Paid)
      impressions: organicImpressions,
      reach: organicImpressions, // organic impressions = organic reach proxy
      video_views: finalOrganicVideoViews,

      // Paid (stored separately for boosted sub-section)
      paid_impressions: paidImpressions,
      paid_reach: paidImpressions, // paid impressions = paid reach proxy
      paid_video_views: paidVideoViews,

      // Totals (for reference, hidden from cards)
      total_impressions: totalImpressions,
      total_video_views: totalVideoViews > 0 ? totalVideoViews : monthlyVideoViewsFromPosts,

      // Engagement & other metrics (fine as totals)
      engagement: totalEngagement,
      page_views: totalPageViews,
      link_clicks: totalLinkClicks,
      follower_growth: metricsAccum.follower_growth || 0,
      total_followers: metricsAccum.total_fans || 0,
      likes: allTopPosts.reduce((s, p) => s + (p.likes || 0), 0),
      comments: allTopPosts.reduce((s, p) => s + (p.comments || 0), 0),
      shares: allTopPosts.reduce((s, p) => s + (p.shares || 0), 0),
      posts_published: allTopPosts.length,
      engagement_rate: organicImpressions > 0 ? (totalEngagement / organicImpressions) * 100 : 0,
      pages_count: pages.length,
    };

    // ── Overwrite protection ──
    // If core insights failed AND we have posts with likes, don't wipe existing data
    const hasPostActivity = allTopPosts.some(p => (p.likes || 0) > 0);
    const allCoreZero = metricsData.impressions === 0 && metricsData.engagement === 0 && metricsData.total_followers === 0;

    const { data: existing } = await supabaseClient
      .from("monthly_snapshots")
      .select("id, snapshot_locked, metrics_data")
      .eq("client_id", clientId)
      .eq("platform", "facebook")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    // If new data is all zeros but posts have activity AND existing snapshot has real data, skip overwrite
    if (allCoreZero && hasPostActivity && existing) {
      const existingMetrics = existing.metrics_data as Record<string, number>;
      if ((existingMetrics?.impressions || 0) > 0 || (existingMetrics?.engagement || 0) > 0) {
        console.warn("Skipping overwrite: new data is all zeros but existing snapshot has real values. Core insights likely failed.");
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

    // Save snapshot
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

    console.log(`Facebook sync complete. organic_impressions=${organicImpressions}, paid_impressions=${paidImpressions}, organic_video_views=${finalOrganicVideoViews}, paid_video_views=${paidVideoViews}, posts=${allTopPosts.length}`);

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
