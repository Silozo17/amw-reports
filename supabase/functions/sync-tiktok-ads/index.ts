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

    const { data: clientData } = await supabase.from("clients").select("org_id").eq("id", clientId).single();
    const orgId = clientData?.org_id;

    const { data: syncLog } = await supabase
      .from("sync_logs")
      .insert({ client_id: clientId, platform: "tiktok", status: "running", report_month: month, report_year: year, org_id: orgId })
      .select("id")
      .single();

    const accessToken = conn.access_token;

    // ── Fetch user info ──
    const accountMetrics = await fetchUserInfo(accessToken);

    // ── Fetch videos for the period ──
    const allVideos = await fetchVideosForPeriod(accessToken, month, year);

    // ── Map videos to enriched format (no insights scope available yet) ──
    const enrichedVideos: EnrichedVideo[] = allVideos.map((v) => {
      const views = Number(v.view_count || 0);
      const likes = Number(v.like_count || 0);
      const comments = Number(v.comment_count || 0);
      const shares = Number(v.share_count || 0);
      return {
        id: v.id,
        title: v.title || v.video_description?.substring(0, 80) || "Untitled",
        description: v.video_description || "",
        duration: v.duration || 0,
        cover_image_url: v.cover_image_url || "",
        permalink_url: v.share_url || "",
        views,
        reach: views,
        likes,
        comments,
        shares,
        total_engagement: likes + comments + shares,
        create_time: v.create_time,
        avg_time_watched: 0,
        completion_rate: 0,
      };
    });

    // ── Aggregate metrics ──
    const aggregated = aggregateVideoMetrics(enrichedVideos);

    const totalEngagement = aggregated.likes + aggregated.comments + aggregated.shares;
    const engagementRate = aggregated.views > 0 ? (totalEngagement / aggregated.views) * 100 : 0;

    const metricsData = {
      total_followers: accountMetrics.followers,
      following: accountMetrics.following,
      reach: aggregated.views,
      video_views: aggregated.views,
      likes: aggregated.likes,
      comments: aggregated.comments,
      shares: aggregated.shares,
      engagement: totalEngagement,
      engagement_rate: engagementRate,
      videos_published: allVideos.length,
      total_video_count: accountMetrics.videoCount,
      total_likes_received: accountMetrics.likesReceived,
      completion_rate: aggregated.avgCompletionRate,
      average_time_watched: aggregated.avgTimeWatched,
    };

    const topContent = enrichedVideos
      .sort((a, b) => b.total_engagement - a.total_engagement)
      .slice(0, 20);

    // ── Upsert monthly snapshot ──
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "tiktok")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    const snapshotPayload = {
      metrics_data: metricsData,
      top_content: topContent,
      raw_data: { videos: enrichedVideos },
    };

    if (existing) {
      await supabase.from("monthly_snapshots").update(snapshotPayload).eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "tiktok",
        report_month: month,
        report_year: year,
        ...snapshotPayload,
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

// ── Helper functions ──

interface AccountMetrics {
  followers: number;
  following: number;
  likesReceived: number;
  videoCount: number;
}

async function fetchUserInfo(accessToken: string): Promise<AccountMetrics> {
  const result: AccountMetrics = {
    followers: 0, following: 0, likesReceived: 0, videoCount: 0,
  };

  try {
    const res = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,likes_count,video_count",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    console.log("TikTok user info:", JSON.stringify(data));

    if (data.data?.user) {
      const u = data.data.user;
      result.followers = Number(u.follower_count || 0);
      result.following = Number(u.following_count || 0);
      result.likesReceived = Number(u.likes_count || 0);
      result.videoCount = Number(u.video_count || 0);
    }
  } catch (e) {
    console.warn("Could not fetch TikTok user info:", e);
  }

  return result;
}

interface RawVideo {
  id: string;
  title?: string;
  video_description?: string;
  duration?: number;
  cover_image_url?: string;
  share_url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  create_time: number;
}

interface EnrichedVideo {
  id: string;
  title: string;
  description: string;
  duration: number;
  cover_image_url: string;
  permalink_url: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  total_engagement: number;
  create_time: number;
  avg_time_watched: number;
  completion_rate: number;
}

async function fetchVideosForPeriod(accessToken: string, month: number, year: number): Promise<RawVideo[]> {
  const allVideos: RawVideo[] = [];
  let cursor: number | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const body: Record<string, unknown> = { max_count: 20 };
    if (cursor !== undefined) body.cursor = cursor;

    const res = await fetch(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,duration,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();
    console.log("TikTok video list page:", data.data?.videos?.length || 0, "videos");

    if (data.error?.code) {
      console.error("TikTok video list error:", JSON.stringify(data.error));
      break;
    }

    const videos: RawVideo[] = data.data?.videos || [];
    if (videos.length === 0) break;

    for (const v of videos) {
      const d = new Date(v.create_time * 1000);
      if (d.getFullYear() === year && d.getMonth() + 1 === month) {
        allVideos.push(v);
      }
    }

    hasMore = data.data?.has_more || false;
    cursor = data.data?.cursor;

    // Stop if we've passed the target month
    const oldest = videos[videos.length - 1];
    const oldestDate = new Date(oldest.create_time * 1000);
    if (oldestDate.getFullYear() < year || (oldestDate.getFullYear() === year && oldestDate.getMonth() + 1 < month)) {
      break;
    }
  }

  return allVideos;
}


interface AggregatedMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  avgCompletionRate: number;
  avgTimeWatched: number;
}

function aggregateVideoMetrics(videos: EnrichedVideo[]): AggregatedMetrics {
  let views = 0, likes = 0, comments = 0, shares = 0;
  let totalCompletionRate = 0, totalTimeWatched = 0;
  let videosWithInsights = 0;

  for (const v of videos) {
    views += v.views;
    likes += v.likes;
    comments += v.comments;
    shares += v.shares;

    if (v.avg_time_watched > 0) {
      totalTimeWatched += v.avg_time_watched;
      totalCompletionRate += v.completion_rate;
      videosWithInsights++;
    }
  }

  return {
    views,
    likes,
    comments,
    shares,
    avgCompletionRate: videosWithInsights > 0 ? totalCompletionRate / videosWithInsights : 0,
    avgTimeWatched: videosWithInsights > 0 ? totalTimeWatched / videosWithInsights : 0,
  };
}
