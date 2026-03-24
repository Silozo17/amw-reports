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
      return new Response(
        JSON.stringify({ error: "connection_id, month, and year are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: conn, error: connError } = await supabaseClient
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

    // Token expiry check
    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      await supabaseClient.from("platform_connections")
        .update({ last_error: "Token expired. Please reconnect.", last_sync_status: "failed" })
        .eq("id", connectionId);
      return new Response(JSON.stringify({ error: "Token expired" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find meta_ads connection to get Instagram business account IDs
    const { data: metaConn } = await supabaseClient
      .from("platform_connections")
      .select("*")
      .eq("client_id", clientId)
      .eq("platform", "meta_ads")
      .eq("is_connected", true)
      .single();

    if (!metaConn?.access_token) {
      throw new Error("No connected Meta Ads account found. Connect Meta Ads first to enable Instagram sync.");
    }

    // Meta token expiry check
    if (metaConn.token_expires_at && new Date(metaConn.token_expires_at) < new Date()) {
      await supabaseClient.from("platform_connections")
        .update({ last_error: "Meta Ads token expired. Please reconnect Meta Ads.", last_sync_status: "failed" })
        .eq("id", connectionId);
      return new Response(JSON.stringify({ error: "Token expired" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const metadata = metaConn.metadata as any;
    const pages = metadata?.pages || [];
    const igAccounts = pages
      .filter((p: any) => p.instagram?.id)
      .map((p: any) => {
        if (!p.access_token) {
          console.error(`No Page token for IG account ${p.instagram?.id}. Reconnect Meta.`);
          return null;
        }
        return { ig_id: p.instagram.id, ig_username: p.instagram.username, page_token: p.access_token };
      })
      .filter(Boolean);

    if (igAccounts.length === 0) {
      throw new Error("No Instagram Business accounts found. Make sure your Facebook Pages have linked Instagram accounts.");
    }

    // Create sync log
    const { data: syncLog } = await supabaseClient
      .from("sync_logs")
      .insert({ client_id: clientId, platform: "instagram", status: "running", report_month: month, report_year: year })
      .select("id")
      .single();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Convert to unix timestamps for IG insights
    const sinceTs = Math.floor(new Date(startDate).getTime() / 1000);
    const untilTs = Math.floor(new Date(endDate + "T23:59:59Z").getTime() / 1000);

    let totalImpressions = 0;
    let totalReach = 0;
    let totalProfileViews = 0;
    let totalFollowerCount = 0;
    let totalMediaCount = 0;
    const allTopMedia: any[] = [];
    const globalMetricsMap: Record<string, number> = {};

    for (const ig of igAccounts) {
      const { ig_id, page_token } = ig;

      // Fetch IG User Insights (only non-deprecated metrics)
      const metricsMap: Record<string, number> = {};
      try {
        const insightsUrl = `${GRAPH_BASE}/${ig_id}/insights?metric=impressions,reach,profile_views&period=day&since=${sinceTs}&until=${untilTs}&access_token=${page_token}`;
        const insightsRes = await fetch(insightsUrl);
        if (!insightsRes.ok) {
          const errorBody = await insightsRes.text();
          throw new Error(`API error (${insightsRes.status}): ${errorBody}`);
        }
        const insightsData = await insightsRes.json();

        if (insightsData.data) {
          for (const metric of insightsData.data) {
            const total = (metric.values || []).reduce((sum: number, v: any) => sum + (Number(v.value) || 0), 0);
            metricsMap[metric.name] = (metricsMap[metric.name] || 0) + total;
          }
        }
        totalImpressions += metricsMap.impressions || 0;
        totalReach += metricsMap.reach || 0;
        totalProfileViews += metricsMap.profile_views || 0;
        // Accumulate per-account metrics into global map
        for (const [k, v] of Object.entries(metricsMap)) {
          globalMetricsMap[k] = (globalMetricsMap[k] || 0) + v;
        }
      } catch (pageError) {
        const errorMsg = pageError instanceof Error ? pageError.message : "Unknown error";
        console.error(`Sync error:`, errorMsg);
        await supabaseClient.from("platform_connections")
          .update({ last_error: errorMsg, last_sync_status: "partial" })
          .eq("id", connectionId);
      }

      // Fetch follower count and media count from user profile
      try {
        const userRes = await fetch(`${GRAPH_BASE}/${ig_id}?fields=followers_count,media_count,website&access_token=${page_token}`);
        if (!userRes.ok) {
          const errorBody = await userRes.text();
          throw new Error(`API error (${userRes.status}): ${errorBody}`);
        }
        const userData = await userRes.json();
        if (userData.followers_count) {
          totalFollowerCount += userData.followers_count;
        }
        if (userData.media_count) {
          totalMediaCount += userData.media_count;
        }
      } catch (pageError) {
        const errorMsg = pageError instanceof Error ? pageError.message : "Unknown error";
        console.error(`Sync error:`, errorMsg);
        await supabaseClient.from("platform_connections")
          .update({ last_error: errorMsg, last_sync_status: "partial" })
          .eq("id", connectionId);
      }

      // Fetch top media with expanded fields
      try {
        const mediaUrl = `${GRAPH_BASE}/${ig_id}/media?fields=caption,timestamp,like_count,comments_count,media_type,video_views,thumbnail_url&since=${sinceTs}&until=${untilTs}&limit=50&access_token=${page_token}`;
        const mediaRes = await fetch(mediaUrl);
        if (!mediaRes.ok) {
          const errorBody = await mediaRes.text();
          throw new Error(`API error (${mediaRes.status}): ${errorBody}`);
        }
        const mediaData = await mediaRes.json();

        if (mediaData.data) {
          // Batch fetch saves, video_views, and profile_activity for top 20 posts
          for (const mediaItem of mediaData.data.slice(0, 20)) {
            try {
              const mediaInsightsUrl = `${GRAPH_BASE}/${mediaItem.id}/insights?metric=saved,video_views,reach,profile_activity&access_token=${page_token}`;
              const mediaInsightsRes = await fetch(mediaInsightsUrl);
              if (mediaInsightsRes.ok) {
                const mediaInsightsData = await mediaInsightsRes.json();
                for (const insight of mediaInsightsData.data || []) {
                  if (insight.name === 'saved') mediaItem.saves = insight.values?.[0]?.value || 0;
                  if (insight.name === 'video_views') mediaItem.video_views_insight = insight.values?.[0]?.value || 0;
                  if (insight.name === 'profile_activity') mediaItem.profile_activity = insight.values?.[0]?.value || 0;
                }
              }
            } catch {} // non-blocking
          }

          for (const m of mediaData.data) {
            allTopMedia.push({
              caption: (m.caption || "").substring(0, 100),
              timestamp: m.timestamp,
              likes: m.like_count || 0,
              comments: m.comments_count || 0,
              saves: m.saves || 0,
              video_views: m.video_views || m.video_views_insight || 0,
              profile_activity: m.profile_activity || 0,
              media_type: m.media_type,
              total_engagement: (m.like_count || 0) + (m.comments_count || 0) + (m.saves || 0),
            });
          }
        }
      } catch (pageError) {
        const errorMsg = pageError instanceof Error ? pageError.message : "Unknown error";
        console.error(`Sync error:`, errorMsg);
        await supabaseClient.from("platform_connections")
          .update({ last_error: errorMsg, last_sync_status: "partial" })
          .eq("id", connectionId);
      }
    }

    // Aggregate media metrics
    const totalLikes = allTopMedia.reduce((sum, m) => sum + (m.likes || 0), 0);
    const totalComments = allTopMedia.reduce((sum, m) => sum + (m.comments || 0), 0);
    const totalSaves = allTopMedia.reduce((sum, m) => sum + (m.saves || 0), 0);
    const totalVideoViews = allTopMedia.reduce((sum, m) => sum + (m.video_views || 0), 0);
    const reelCount = allTopMedia.filter(m => m.media_type === 'VIDEO' || m.media_type === 'REELS').length;
    const imageCount = allTopMedia.filter(m => m.media_type === 'IMAGE').length;
    const carouselCount = allTopMedia.filter(m => m.media_type === 'CAROUSEL_ALBUM').length;

    const topContent = allTopMedia
      .sort((a, b) => b.total_engagement - a.total_engagement)
      .slice(0, 10);

    const metricsData: Record<string, number> = {
      impressions: totalImpressions,
      reach: totalReach,
      profile_visits: totalProfileViews,
      website_clicks: allTopMedia.reduce((sum, m) => sum + (m.profile_activity || 0), 0),
      engagement: totalLikes + totalComments + totalSaves,
      likes: totalLikes,
      comments: totalComments,
      saves: totalSaves,
      video_views: totalVideoViews,
      posts_published: allTopMedia.length,
      reel_count: reelCount,
      image_count: imageCount,
      carousel_count: carouselCount,
      engagement_rate: totalReach > 0 ? ((totalLikes + totalComments + totalSaves) / totalReach) * 100 : 0,
    };
    if (totalFollowerCount > 0) {
      metricsData.total_followers = totalFollowerCount;
    }

    // Upsert monthly snapshot
    const { data: existing } = await supabaseClient
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "instagram")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    if (existing) {
      await supabaseClient.from("monthly_snapshots").update({ metrics_data: metricsData, top_content: topContent }).eq("id", existing.id);
    } else {
      await supabaseClient.from("monthly_snapshots").insert({ client_id: clientId, platform: "instagram", report_month: month, report_year: year, metrics_data: metricsData, top_content: topContent });
    }

    await supabaseClient.from("platform_connections").update({ last_sync_at: new Date().toISOString(), last_sync_status: "success", last_error: null }).eq("id", connectionId);

    if (syncLog?.id) {
      await supabaseClient.from("sync_logs").update({ status: "success", completed_at: new Date().toISOString() }).eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData, accounts_synced: igAccounts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Instagram sync error:", e);
    if (connectionId) {
      await supabaseClient.from("platform_connections").update({ last_sync_status: "failed", last_error: e instanceof Error ? e.message : "Unknown error" }).eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});