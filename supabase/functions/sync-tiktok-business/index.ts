import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken, decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

const VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/";
const TOKEN_REFRESH_URL = "https://open.tiktokapis.com/v2/oauth/token/";

interface SyncRequest {
  connection_id: string;
  month: number;
  year: number;
}

async function refreshAccessToken(
  refreshToken: string,
  clientKey: string,
  clientSecret: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const res = await fetch(TOKEN_REFRESH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (data.access_token) return data;
  if (data.data?.access_token) return data.data;
  console.error("Token refresh failed:", JSON.stringify(data));
  return null;
}

async function fetchVideos(accessToken: string, cursor?: number): Promise<{ videos: unknown[]; cursor: number; has_more: boolean }> {
  const body: Record<string, unknown> = { max_count: 20 };
  if (cursor) body.cursor = cursor;

  const res = await fetch(`${VIDEO_LIST_URL}?fields=id,title,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count,duration`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.error?.code === "access_token_invalid") {
    throw new Error("TOKEN_EXPIRED");
  }
  if (data.error?.code && data.error.code !== "ok") {
    throw new Error(`TikTok API error: ${data.error.code} — ${data.error.message ?? ""}`);
  }
  return {
    videos: data.data?.videos ?? [],
    cursor: data.data?.cursor ?? 0,
    has_more: data.data?.has_more ?? false,
  };
}

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
    const body: SyncRequest = await req.json();
    connectionId = body.connection_id;
    const { month, year } = body;

    if (!connectionId || !month || !year) {
      return new Response(
        JSON.stringify({ error: "connection_id, month, and year are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get connection details
    const { data: conn, error: connError } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !conn) {
      return new Response(
        JSON.stringify({ error: "Connection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    clientId = conn.client_id;

    // Decrypt tokens
    if (conn.access_token) conn.access_token = await decryptToken(conn.access_token);
    if (conn.refresh_token) conn.refresh_token = await decryptToken(conn.refresh_token);

    if (!conn.is_connected || !conn.access_token) {
      return new Response(
        JSON.stringify({ error: "Connection is not authenticated. Please connect via OAuth first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get org_id from client
    const { data: clientData } = await supabase.from("clients").select("org_id").eq("id", clientId).single();
    const orgId = clientData?.org_id;

    // Verify requesting user belongs to the client's org
    const authHeader = req.headers.get("Authorization");
    if (authHeader && orgId) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabase.auth.getUser(token);
      if (caller) {
        const { data: membership } = await supabase.from("org_members").select("id").eq("user_id", caller.id).eq("org_id", orgId).limit(1).single();
        if (!membership) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // Create sync log
    const { data: syncLog } = await supabase
      .from("sync_logs")
      .insert({
        client_id: clientId,
        platform: "tiktok",
        status: "running",
        report_month: month,
        report_year: year,
        org_id: orgId,
      })
      .select("id")
      .single();

    let accessToken = conn.access_token;

    // Build date range for target month
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    const startTs = Math.floor(startOfMonth.getTime() / 1000);
    const endTs = Math.floor(endOfMonth.getTime() / 1000);

    // Fetch all videos, paginating, and filter by create_time within target month
    let allVideos: Record<string, unknown>[] = [];
    let cursor: number | undefined;
    let hasMore = true;
    let reachedOlderThanMonth = false;

    const fetchWithRetry = async () => {
      while (hasMore && !reachedOlderThanMonth) {
        try {
          const result = await fetchVideos(accessToken, cursor);
          const videos = result.videos as Record<string, unknown>[];

          for (const video of videos) {
            const createTime = Number(video.create_time ?? 0);
            if (createTime >= startTs && createTime <= endTs) {
              allVideos.push(video);
            }
            if (createTime < startTs) {
              reachedOlderThanMonth = true;
              break;
            }
          }

          hasMore = result.has_more;
          cursor = result.cursor;

          if (videos.length === 0) break;
        } catch (e) {
          if (e instanceof Error && e.message === "TOKEN_EXPIRED" && conn.refresh_token) {
            console.log("Access token expired, attempting refresh...");
            const clientKey = Deno.env.get("TIKTOK_APP_ID") ?? "";
            const clientSecret = Deno.env.get("TIKTOK_APP_SECRET") ?? "";
            const refreshed = await refreshAccessToken(conn.refresh_token, clientKey, clientSecret);
            if (!refreshed) throw new Error("Failed to refresh TikTok access token");

            accessToken = refreshed.access_token;
            await supabase.from("platform_connections").update({
              access_token: await encryptToken(refreshed.access_token),
              refresh_token: await encryptToken(refreshed.refresh_token),
              token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            }).eq("id", connectionId);

            // Retry this page
            continue;
          }
          throw e;
        }
      }
    };

    await fetchWithRetry();
    console.log(`Found ${allVideos.length} TikTok videos for ${year}-${month}`);

    // Aggregate metrics
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    const topContent: Record<string, unknown>[] = [];

    for (const video of allVideos) {
      const views = Number(video.view_count ?? 0);
      const likes = Number(video.like_count ?? 0);
      const comments = Number(video.comment_count ?? 0);
      const shares = Number(video.share_count ?? 0);

      totalViews += views;
      totalLikes += likes;
      totalComments += comments;
      totalShares += shares;

      topContent.push({
        id: video.id,
        title: video.title || "(No caption)",
        message: video.title || "(No caption)",
        permalink_url: video.share_url,
        full_picture: video.cover_image_url,
        created_time: video.create_time ? new Date(Number(video.create_time) * 1000).toISOString() : undefined,
        likes,
        comments,
        shares,
        engagement: likes + comments + shares,
        views,
      });
    }

    // Sort top content by engagement descending
    topContent.sort((a, b) => (Number(b.engagement) || 0) - (Number(a.engagement) || 0));

    const totalEngagement = totalLikes + totalComments + totalShares;
    const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

    const metricsData = {
      video_views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      engagement: totalEngagement,
      engagement_rate: engagementRate,
      posts_published: allVideos.length,
    };

    // Upsert monthly snapshot
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "tiktok")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) {
      throw new Error("Snapshot for this period is locked and cannot be overwritten.");
    }

    if (existing) {
      await supabase
        .from("monthly_snapshots")
        .update({
          metrics_data: metricsData,
          top_content: topContent.slice(0, 10),
          raw_data: { videos: allVideos },
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "tiktok",
        report_month: month,
        report_year: year,
        metrics_data: metricsData,
        top_content: topContent.slice(0, 10),
        raw_data: { videos: allVideos },
      });
    }

    // Update connection sync status
    await supabase
      .from("platform_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "success",
        last_error: null,
      })
      .eq("id", connectionId);

    // Update sync log
    if (syncLog?.id) {
      await supabase
        .from("sync_logs")
        .update({ status: "success", completed_at: new Date().toISOString() })
        .eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("TikTok organic sync error:", e);

    if (connectionId) {
      await supabase
        .from("platform_connections")
        .update({
          last_sync_status: "failed",
          last_error: e instanceof Error ? e.message : "Unknown error",
        })
        .eq("id", connectionId);
    }

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
