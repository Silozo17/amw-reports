import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken, decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LI_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": "202503",
  "X-Restli-Protocol-Version": "2.0.0",
});

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

    // Decrypt tokens
    if (conn.access_token) conn.access_token = await decryptToken(conn.access_token);
    if (conn.refresh_token) conn.refresh_token = await decryptToken(conn.refresh_token);
      throw new Error("Connection is not authenticated. Please connect via OAuth first.");
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


    const { data: syncLog } = await supabase
      .from("sync_logs")
      .insert({ client_id: clientId, platform: "linkedin", status: "running", report_month: month, report_year: year, org_id: orgId })
      .select("id")
      .single();

    // ── Auto-refresh token if expired ──
    let accessToken = conn.access_token;
    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      if (!conn.refresh_token) {
        throw new Error("LinkedIn token expired and no refresh token available. Please reconnect.");
      }
      console.log("LinkedIn token expired, refreshing...");
      const liClientId = Deno.env.get("LINKEDIN_CLIENT_ID")!;
      const liClientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET")!;

      const refreshRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: conn.refresh_token,
          client_id: liClientId,
          client_secret: liClientSecret,
        }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.error || !refreshData.access_token) {
        throw new Error(`LinkedIn token refresh failed: ${refreshData.error_description || refreshData.error || "Unknown error"}. Please reconnect.`);
      }

      accessToken = refreshData.access_token;
      const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 5184000) * 1000).toISOString();
      await supabase.from("platform_connections").update({
        access_token: await encryptToken(accessToken),
        refresh_token: await encryptToken(refreshData.refresh_token || conn.refresh_token),
        token_expires_at: newExpiresAt,
        last_error: null,
      }).eq("id", connectionId);
      console.log("LinkedIn token refreshed successfully.");
    }

    const metadata = conn.metadata as Record<string, unknown> | null;
    const organizations = ((metadata?.organizations) as Array<{ id?: string; name?: string }>) || [];

    // Date range for the target month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    const monthStartMs = monthStart.getTime();
    const monthEndMs = monthEnd.getTime();

    // ── Fetch follower stats for each organization ──
    let totalFollowers = 0;

    for (const org of organizations) {
      try {
        const followerUrl = `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${org.id}`;
        const followerRes = await fetch(followerUrl, { headers: LI_HEADERS(accessToken) });
        const followerData = await followerRes.json();

        if (followerData.elements?.[0]) {
          const el = followerData.elements[0];
          totalFollowers += Number(el.followerCounts?.organicFollowerCount || 0) + Number(el.followerCounts?.paidFollowerCount || 0);
        }
      } catch (e) {
        console.warn(`LinkedIn follower stats error for org ${org.id}:`, e);
      }
    }

    // ── Fetch organic post engagement for each organization (filtered by month) ──
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalImpressions = 0;
    let totalClicks = 0;

    interface LinkedInPost {
      id: string;
      text: string;
      permalink: string;
      created_time: string;
      likes: number;
      comments: number;
      shares: number;
      impressions: number;
      clicks: number;
      total_engagement: number;
    }

    const allPostsData: LinkedInPost[] = [];

    for (const org of organizations) {
      try {
        const postsUrl = `https://api.linkedin.com/rest/ugcPosts?q=authors&authors=List(urn:li:organization:${org.id})&count=100`;
        const postsRes = await fetch(postsUrl, { headers: LI_HEADERS(accessToken) });
        const postsData = await postsRes.json();

        for (const post of postsData.elements || []) {
          // Filter by creation date — only include posts from the target month
          const createdAt = post.created?.time || post.firstPublishedAt;
          if (!createdAt) continue;
          const postTime = typeof createdAt === "number" ? createdAt : new Date(createdAt).getTime();
          if (postTime < monthStartMs || postTime > monthEndMs) continue;

          // Fetch stats for this post
          try {
            const statsUrl = `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${org.id}&ugcPosts=List(${post.id})`;
            const statsRes = await fetch(statsUrl, { headers: LI_HEADERS(accessToken) });
            const statsData = await statsRes.json();

            let postLikes = 0, postComments = 0, postShares = 0, postImpressions = 0, postClicks = 0;

            for (const stat of statsData.elements || []) {
              const s = stat.totalShareStatistics || {};
              postLikes += Number(s.likeCount || 0);
              postComments += Number(s.commentCount || 0);
              postShares += Number(s.shareCount || 0);
              postImpressions += Number(s.impressionCount || 0);
              postClicks += Number(s.clickCount || 0);
            }

            totalLikes += postLikes;
            totalComments += postComments;
            totalShares += postShares;
            totalImpressions += postImpressions;
            totalClicks += postClicks;

            // Extract post text
            const specificContent = post.specificContent?.["com.linkedin.ugc.ShareContent"];
            const postText = specificContent?.shareCommentary?.text || "";
            const postPermalink = `https://www.linkedin.com/feed/update/${post.id}`;

            allPostsData.push({
              id: post.id,
              text: postText,
              permalink: postPermalink,
              created_time: new Date(postTime).toISOString(),
              likes: postLikes,
              comments: postComments,
              shares: postShares,
              impressions: postImpressions,
              clicks: postClicks,
              total_engagement: postLikes + postComments + postShares,
            });
          } catch {} // non-blocking per post
        }
      } catch (e) {
        console.warn(`LinkedIn org posts error for ${org.id}:`, e);
      }
    }

    const totalEngagement = totalLikes + totalComments + totalShares;

    // Sort top content by engagement descending, keep top 10
    allPostsData.sort((a, b) => b.total_engagement - a.total_engagement);
    const topContent = allPostsData.slice(0, 10).map((p) => ({
      message: p.text,
      permalink_url: p.permalink,
      created_time: p.created_time,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      impressions: p.impressions,
      clicks: p.clicks,
      total_engagement: p.total_engagement,
    }));

    const metricsData = {
      total_followers: totalFollowers,
      impressions: totalImpressions,
      clicks: totalClicks,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      engagement: totalEngagement,
      engagement_rate: totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0,
      organizations_count: organizations.length,
      posts_published: allPostsData.length,
    };

    // Select-then-update/insert pattern
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "linkedin")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    if (existing) {
      await supabase.from("monthly_snapshots").update({ metrics_data: metricsData, top_content: topContent, raw_data: {} }).eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({ client_id: clientId, platform: "linkedin", report_month: month, report_year: year, metrics_data: metricsData, top_content: topContent, raw_data: {} });
    }

    await supabase.from("platform_connections").update({ last_sync_at: new Date().toISOString(), last_sync_status: "success", last_error: null }).eq("id", connectionId);

    if (syncLog?.id) {
      await supabase.from("sync_logs").update({ status: "success", completed_at: new Date().toISOString() }).eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("LinkedIn sync error:", e);
    if (connectionId) {
      await supabase.from("platform_connections").update({ last_sync_status: "failed", last_error: e instanceof Error ? e.message : "Unknown error" }).eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
