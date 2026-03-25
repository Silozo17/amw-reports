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

    // Get the meta_ads connection for this client (pages are stored in meta_ads metadata)
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

    // Token expiry check
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

    // For facebook platform connections, we need the meta_ads connection's page tokens
    const { data: metaConn } = await supabaseClient
      .from("platform_connections")
      .select("*")
      .eq("client_id", clientId)
      .eq("platform", "meta_ads")
      .eq("is_connected", true)
      .single();

    if (!metaConn?.access_token) {
      throw new Error("No connected Meta Ads account found. Connect Meta Ads first to enable Facebook Page sync.");
    }

    // Meta token expiry check
    if (metaConn.token_expires_at && new Date(metaConn.token_expires_at) < new Date()) {
      await supabaseClient
        .from("platform_connections")
        .update({ last_error: "Meta Ads token expired. Please reconnect Meta Ads.", last_sync_status: "failed" })
        .eq("id", connectionId);
      return new Response(JSON.stringify({ error: "Token expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = metaConn.metadata as any;
    const pages = metadata?.pages || [];

    if (pages.length === 0) {
      throw new Error("No Facebook Pages discovered. Reconnect Meta Ads to grant page permissions.");
    }

    // Get org_id from client
    const { data: clientData } = await supabaseClient.from("clients").select("org_id").eq("id", clientId).single();
    const orgId = clientData?.org_id;

    // Create sync log
    const { data: syncLog } = await supabaseClient
      .from("sync_logs")
      .insert({ client_id: clientId, platform: "facebook", status: "running", report_month: month, report_year: year, org_id: orgId })
      .select("id")
      .single();

    // Build date range
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Aggregate across all pages
    let totalImpressions = 0;
    let totalEngagement = 0;
    let totalPageViews = 0;
    let totalFollowerAdds = 0;
    const metricsAccum: Record<string, number> = {};
    const allTopPosts: any[] = [];

    for (const page of pages) {
      const pageToken = page.access_token;
      if (!pageToken) {
        const errorMsg = `No Page Access Token for page ${page.id}. Reconnect Meta Ads.`;
        console.error(errorMsg);
        await supabaseClient
          .from("platform_connections")
          .update({ last_error: errorMsg, last_sync_status: "failed" })
          .eq("id", connectionId);
        continue;
      }
      const pageId = page.id;

      // Fetch Page Insights (v25-valid metrics only)
      try {
        const insightsUrl = `${GRAPH_BASE}/${pageId}/insights?metric=page_impressions,page_impressions_paid,page_post_engagements,page_media_view,page_daily_follows_unique,page_daily_unfollows_unique,page_follows&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`;
        const insightsRes = await fetch(insightsUrl);
        if (!insightsRes.ok) {
          const errorBody = await insightsRes.text();
          throw new Error(`API error (${insightsRes.status}): ${errorBody}`);
        }
        const insightsData = await insightsRes.json();

        if (insightsData.error) {
          const errMsg = insightsData.error.message || "Unknown Graph API error";
          console.error(`Facebook Insights API error for page ${pageId}:`, errMsg);
          await supabaseClient
            .from("platform_connections")
            .update({
              last_error: `Page ${page.name || pageId}: ${errMsg}`,
              last_sync_status: "partial",
            })
            .eq("id", connectionId);
        }

        if (insightsData.data) {
          for (const metric of insightsData.data) {
            const total = (metric.values || []).reduce((sum: number, v: any) => sum + (Number(v.value) || 0), 0);
            switch (metric.name) {
              case "page_impressions":
                totalImpressions += total;
                break;
              case "page_impressions_paid":
                metricsAccum.paid_impressions = (metricsAccum.paid_impressions || 0) + total;
                break;
              case "page_post_engagements":
                totalEngagement += total;
                break;
              case "page_media_view":
                totalPageViews += total;
                break;
              case "page_daily_follows_unique":
                totalFollowerAdds += total;
                break;
              case "page_daily_unfollows_unique":
                metricsAccum.follower_removes = (metricsAccum.follower_removes || 0) + total;
                break;
              case "page_follows": {
                // page_follows returns the running total — take the last day's value
                const lastValue = (metric.values || []).at(-1)?.value || 0;
                metricsAccum.total_fans = (metricsAccum.total_fans || 0) + Number(lastValue);
                break;
              }
            }
          }
        }
      } catch (pageError) {
        const errorMsg = pageError instanceof Error ? pageError.message : "Unknown error";
        console.error(`Sync error for page ${pageId}:`, errorMsg);
        await supabaseClient
          .from("platform_connections")
          .update({ last_error: errorMsg, last_sync_status: "partial" })
          .eq("id", connectionId);
      }

      // Fetch video stats separately
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

      // Fetch top posts with reactions and shares
      try {
        const postsUrl = `${GRAPH_BASE}/${pageId}/published_posts?fields=message,created_time,likes.summary(true),comments.summary(true),shares,reactions.summary(true),full_picture&since=${startDate}&until=${endDate}&limit=25&access_token=${pageToken}`;
        const postsRes = await fetch(postsUrl);
        if (!postsRes.ok) {
          const errorBody = await postsRes.text();
          throw new Error(`API error (${postsRes.status}): ${errorBody}`);
        }
        const postsData = await postsRes.json();

        if (postsData.data) {
          for (const post of postsData.data) {
            const likes = post.likes?.summary?.total_count || 0;
            const comments = post.comments?.summary?.total_count || 0;
            const shares = post.shares?.count || 0;
            allTopPosts.push({
              page_name: page.name,
              message: (post.message || "").substring(0, 100),
              created_time: post.created_time,
              likes,
              comments,
              shares,
              total_engagement: likes + comments + shares,
            });
          }
        }
      } catch (pageError) {
        const errorMsg = pageError instanceof Error ? pageError.message : "Unknown error";
        console.error(`Sync error:`, errorMsg);
        await supabaseClient
          .from("platform_connections")
          .update({ last_error: errorMsg, last_sync_status: "partial" })
          .eq("id", connectionId);
      }
    }

    // Sort top posts by engagement
    const topContent = allTopPosts.sort((a, b) => b.total_engagement - a.total_engagement).slice(0, 10);

    const metricsData = {
      impressions: totalImpressions,
      organic_impressions: Math.max(totalImpressions - (metricsAccum.paid_impressions || 0), 0),
      paid_impressions: metricsAccum.paid_impressions || 0,
      reach: totalImpressions,
      engagement: totalEngagement,
      page_views: totalPageViews,
      follower_growth: totalFollowerAdds,
      follower_removes: metricsAccum.follower_removes || 0,
      total_followers: metricsAccum.total_fans || 0,
      video_views: metricsAccum.video_views || 0,
      likes: allTopPosts.reduce((s, p) => s + (p.likes || 0), 0),
      comments: allTopPosts.reduce((s, p) => s + (p.comments || 0), 0),
      shares: allTopPosts.reduce((s, p) => s + (p.shares || 0), 0),
      posts_published: allTopPosts.length,
      engagement_rate: totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0,
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

    // Update connection sync status
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

    return new Response(JSON.stringify({ success: true, metrics: metricsData, pages_synced: pages.length }), {
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
