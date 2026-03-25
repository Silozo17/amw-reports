import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { connection_id, month, year } = await req.json();
    connectionId = connection_id;

    if (!connectionId || !month || !year) {
      return new Response(
        JSON.stringify({ error: "connection_id, month, and year are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    if (!conn.is_connected || !conn.access_token) {
      throw new Error("Connection is not authenticated. Please connect via OAuth first.");
    }

    // Get org_id from client
    const { data: clientData } = await supabase.from("clients").select("org_id").eq("id", clientId).single();
    const orgId = clientData?.org_id;

    const { data: syncLog } = await supabase
      .from("sync_logs")
      .insert({ client_id: clientId, platform: "tiktok", status: "running", report_month: month, report_year: year, org_id: orgId })
      .select("id")
      .single();

    const accessToken = conn.access_token;

    // ── Fetch user info via TikTok Content API v2 ──
    let totalFollowers = 0;
    let totalFollowing = 0;
    let totalLikesReceived = 0;
    let totalVideoCount = 0;

    try {
      const userRes = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,likes_count,video_count",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const userData = await userRes.json();
      console.log("TikTok user info:", JSON.stringify(userData));

      if (userData.data?.user) {
        const u = userData.data.user;
        totalFollowers = Number(u.follower_count || 0);
        totalFollowing = Number(u.following_count || 0);
        totalLikesReceived = Number(u.likes_count || 0);
        totalVideoCount = Number(u.video_count || 0);
      }
    } catch (e) {
      console.warn("Could not fetch TikTok user info:", e);
    }

    // ── Fetch videos via TikTok Content API v2 ──
    const allVideos: any[] = [];
    let cursor: number | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const body: any = {
        max_count: 20,
      };
      if (cursor !== undefined) {
        body.cursor = cursor;
      }

      const videoRes = await fetch(
        "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,duration,cover_image_url,view_count,like_count,comment_count,share_count,create_time",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const videoData = await videoRes.json();
      console.log("TikTok video list response (page):", videoData.data?.videos?.length || 0, "videos");

      if (videoData.error?.code) {
        console.error("TikTok video list error:", JSON.stringify(videoData.error));
        break;
      }

      const videos = videoData.data?.videos || [];
      if (videos.length === 0) {
        hasMore = false;
        break;
      }

      // Filter videos to the requested month/year
      for (const v of videos) {
        const createDate = new Date(v.create_time * 1000);
        const vMonth = createDate.getMonth() + 1;
        const vYear = createDate.getFullYear();

        if (vYear === year && vMonth === month) {
          allVideos.push(v);
        }
      }

      hasMore = videoData.data?.has_more || false;
      cursor = videoData.data?.cursor;

      // Safety: stop if we've gone past the target month
      if (videos.length > 0) {
        const oldestVideo = videos[videos.length - 1];
        const oldestDate = new Date(oldestVideo.create_time * 1000);
        if (oldestDate.getFullYear() < year || (oldestDate.getFullYear() === year && oldestDate.getMonth() + 1 < month)) {
          break;
        }
      }
    }

    // ── Aggregate metrics from videos ──
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    const videoBreakdown: any[] = [];

    for (const v of allVideos) {
      const views = Number(v.view_count || 0);
      const likes = Number(v.like_count || 0);
      const comments = Number(v.comment_count || 0);
      const shares = Number(v.share_count || 0);

      totalViews += views;
      totalLikes += likes;
      totalComments += comments;
      totalShares += shares;

      videoBreakdown.push({
        id: v.id,
        title: v.title || v.video_description?.substring(0, 80) || "Untitled",
        description: v.video_description || "",
        duration: v.duration || 0,
        cover_image_url: v.cover_image_url || "",
        views,
        likes,
        comments,
        shares,
        create_time: v.create_time,
      });
    }

    const totalEngagement = totalLikes + totalComments + totalShares;
    const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

    const metricsData = {
      total_followers: totalFollowers,
      reach: totalViews,
      video_views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      engagement: totalEngagement,
      engagement_rate: engagementRate,
      videos_published: allVideos.length,
      total_video_count: totalVideoCount,
      total_likes_received: totalLikesReceived,
      following: totalFollowing,
    };

    // Top videos sorted by views
    const topContent = videoBreakdown
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    // Upsert monthly snapshot
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "tiktok")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    if (existing) {
      await supabase.from("monthly_snapshots").update({
        metrics_data: metricsData,
        top_content: topContent,
        raw_data: { videos: videoBreakdown },
      }).eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "tiktok",
        report_month: month,
        report_year: year,
        metrics_data: metricsData,
        top_content: topContent,
        raw_data: { videos: videoBreakdown },
      });
    }

    await supabase.from("platform_connections").update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: "success",
      last_error: null,
    }).eq("id", connectionId);

    if (syncLog?.id) {
      await supabase.from("sync_logs").update({
        status: "success",
        completed_at: new Date().toISOString(),
      }).eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData, videos_synced: allVideos.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("TikTok sync error:", e);
    if (connectionId) {
      await supabase.from("platform_connections").update({
        last_sync_status: "failed",
        last_error: e instanceof Error ? e.message : "Unknown error",
      }).eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
