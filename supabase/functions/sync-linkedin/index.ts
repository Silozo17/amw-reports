import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken, decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LI_VERSION = "202603";

const liHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": LI_VERSION,
  "X-Restli-Protocol-Version": "2.0.0",
});

async function fetchLinkedIn(url: string, token: string, extraHeaders?: Record<string, string>) {
  const res = await fetch(url, { headers: { ...liHeaders(token), ...extraHeaders } });
  const body = await res.json();
  if (!res.ok) {
    console.error(`LinkedIn API error [${res.status}] for ${url}:`, JSON.stringify(body));
    throw new Error(`LinkedIn API ${res.status}: ${body.message || body.error || JSON.stringify(body)}`);
  }
  return body;
}

async function getFollowerCount(orgId: string, token: string): Promise<number> {
  try {
    const data = await fetchLinkedIn(
      `https://api.linkedin.com/rest/networkSizes/urn:li:organization:${orgId}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`,
      token
    );
    return Number(data.firstDegreeSize || 0);
  } catch (e) {
    console.warn(`Failed to get follower count for org ${orgId}:`, e);
    return 0;
  }
}

interface FollowerGains {
  organic: number;
  paid: number;
}

async function getFollowerGains(orgId: string, token: string, startMs: number, endMs: number): Promise<FollowerGains> {
  try {
    const timeIntervals = `(timeRange:(start:${startMs},end:${endMs}),timeGranularityType:MONTH)`;
    const url = `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${orgId}&timeIntervals=${timeIntervals}`;
    const data = await fetchLinkedIn(url, token);

    let organic = 0;
    let paid = 0;
    for (const el of data.elements || []) {
      organic += Number(el.followerGains?.organicFollowerGain || 0);
      paid += Number(el.followerGains?.paidFollowerGain || 0);
    }
    return { organic, paid };
  } catch (e) {
    console.warn(`Failed to get follower gains for org ${orgId}:`, e);
    return { organic: 0, paid: 0 };
  }
}

interface ShareStats {
  clicks: number;
  comments: number;
  likes: number;
  shares: number;
  impressions: number;
  uniqueImpressions: number;
  engagement: number;
}

async function getShareStatistics(orgId: string, token: string, startMs: number, endMs: number): Promise<ShareStats> {
  const result: ShareStats = { clicks: 0, comments: 0, likes: 0, shares: 0, impressions: 0, uniqueImpressions: 0, engagement: 0 };
  try {
    const timeIntervals = `(timeRange:(start:${startMs},end:${endMs}),timeGranularityType:MONTH)`;
    const url = `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${orgId}&timeIntervals=${timeIntervals}`;
    const data = await fetchLinkedIn(url, token);

    for (const el of data.elements || []) {
      const s = el.totalShareStatistics || {};
      result.clicks += Number(s.clickCount || 0);
      result.comments += Number(s.commentCount || 0);
      result.likes += Number(s.likeCount || 0);
      result.shares += Number(s.shareCount || 0);
      result.impressions += Number(s.impressionCount || 0);
      result.uniqueImpressions += Number(s.uniqueImpressionsCount || 0);
      result.engagement += Number(s.engagement || 0);
    }
  } catch (e) {
    console.warn(`Failed to get share stats for org ${orgId}:`, e);
  }
  return result;
}

interface PageViews {
  total: number;
  desktop: number;
  mobile: number;
}

async function getPageStatistics(orgId: string, token: string, startMs: number, endMs: number): Promise<PageViews> {
  const result: PageViews = { total: 0, desktop: 0, mobile: 0 };
  try {
    const timeIntervals = `(timeRange:(start:${startMs},end:${endMs}),timeGranularityType:MONTH)`;
    const url = `https://api.linkedin.com/rest/organizationPageStatistics?q=organization&organization=urn:li:organization:${orgId}&timeIntervals=${timeIntervals}`;
    const data = await fetchLinkedIn(url, token);

    for (const el of data.elements || []) {
      const views = el.totalPageStatistics?.views || {};
      result.total += Number(views.allPageViews || 0);
      result.desktop += Number(views.allDesktopPageViews || 0);
      result.mobile += Number(views.allMobilePageViews || 0);
    }
  } catch (e) {
    console.warn(`Failed to get page stats for org ${orgId}:`, e);
  }
  return result;
}

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

async function getTopContent(
  orgId: string,
  token: string,
  monthStartMs: number,
  monthEndMs: number
): Promise<LinkedInPost[]> {
  const posts: LinkedInPost[] = [];

  try {
    const url = `https://api.linkedin.com/rest/posts?author=urn:li:organization:${orgId}&q=author&count=100&sortBy=CREATED`;
    const data = await fetchLinkedIn(url, token, { "X-RestLi-Method": "FINDER" });

    const monthPosts: Array<{ id: string; text: string; createdAt: number }> = [];

    for (const post of data.elements || []) {
      const createdAt = post.publishedAt || post.createdAt;
      if (!createdAt) continue;
      const postTime = typeof createdAt === "number" ? createdAt : new Date(createdAt).getTime();
      if (postTime < monthStartMs || postTime > monthEndMs) continue;

      monthPosts.push({
        id: post.id,
        text: post.commentary || "",
        createdAt: postTime,
      });
    }

    if (monthPosts.length === 0) return posts;

    // Batch fetch stats for all posts using ugcPosts param (LinkedIn still accepts post URNs here)
    const postUrnList = monthPosts.map((p) => p.id).join(",");
    try {
      const statsUrl = `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${orgId}&ugcPosts=List(${postUrnList})`;
      const statsData = await fetchLinkedIn(statsUrl, token);

      const statsMap = new Map<string, { likes: number; comments: number; shares: number; impressions: number; clicks: number }>();
      for (const el of statsData.elements || []) {
        const postId = el.ugcPost || el.share;
        if (!postId) continue;
        const s = el.totalShareStatistics || {};
        statsMap.set(postId, {
          likes: Number(s.likeCount || 0),
          comments: Number(s.commentCount || 0),
          shares: Number(s.shareCount || 0),
          impressions: Number(s.impressionCount || 0),
          clicks: Number(s.clickCount || 0),
        });
      }

      for (const mp of monthPosts) {
        const s = statsMap.get(mp.id) || { likes: 0, comments: 0, shares: 0, impressions: 0, clicks: 0 };
        posts.push({
          id: mp.id,
          text: mp.text,
          permalink: `https://www.linkedin.com/feed/update/${mp.id}`,
          created_time: new Date(mp.createdAt).toISOString(),
          likes: s.likes,
          comments: s.comments,
          shares: s.shares,
          impressions: s.impressions,
          clicks: s.clicks,
          total_engagement: s.likes + s.comments + s.shares,
        });
      }
    } catch (e) {
      console.warn(`Failed to get per-post stats for org ${orgId}, returning posts without stats:`, e);
      for (const mp of monthPosts) {
        posts.push({
          id: mp.id,
          text: mp.text,
          permalink: `https://www.linkedin.com/feed/update/${mp.id}`,
          created_time: new Date(mp.createdAt).toISOString(),
          likes: 0, comments: 0, shares: 0, impressions: 0, clicks: 0, total_engagement: 0,
        });
      }
    }
  } catch (e) {
    console.warn(`Failed to fetch posts for org ${orgId}:`, e);
  }

  return posts;
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

    if (!conn.is_connected || !conn.access_token) {
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

    // ── Aggregate metrics across all organizations ──
    let totalFollowers = 0;
    let followerGainsOrganic = 0;
    let followerGainsPaid = 0;
    let totalClicks = 0;
    let totalComments = 0;
    let totalLikes = 0;
    let totalShares = 0;
    let totalImpressions = 0;
    let totalUniqueImpressions = 0;
    let totalEngagement = 0;
    let totalPageViews = 0;
    let totalPageViewsDesktop = 0;
    let totalPageViewsMobile = 0;
    const allPostsData: LinkedInPost[] = [];

    for (const org of organizations) {
      if (!org.id) continue;

      // All four data fetches are independent per org — run in parallel
      const [followers, gains, shareStats, pageStats] = await Promise.all([
        getFollowerCount(org.id, accessToken),
        getFollowerGains(org.id, accessToken, monthStartMs, monthEndMs),
        getShareStatistics(org.id, accessToken, monthStartMs, monthEndMs),
        getPageStatistics(org.id, accessToken, monthStartMs, monthEndMs),
      ]);

      totalFollowers += followers;
      followerGainsOrganic += gains.organic;
      followerGainsPaid += gains.paid;
      totalClicks += shareStats.clicks;
      totalComments += shareStats.comments;
      totalLikes += shareStats.likes;
      totalShares += shareStats.shares;
      totalImpressions += shareStats.impressions;
      totalUniqueImpressions += shareStats.uniqueImpressions;
      totalEngagement += shareStats.engagement;
      totalPageViews += pageStats.total;
      totalPageViewsDesktop += pageStats.desktop;
      totalPageViewsMobile += pageStats.mobile;

      // Fetch top content (separate call — Posts API)
      const orgPosts = await getTopContent(org.id, accessToken, monthStartMs, monthEndMs);
      allPostsData.push(...orgPosts);
    }

    const engagementRate = totalImpressions > 0
      ? (totalEngagement / totalImpressions) * 100
      : 0;

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
      follower_gains_organic: followerGainsOrganic,
      follower_gains_paid: followerGainsPaid,
      impressions: totalImpressions,
      unique_impressions: totalUniqueImpressions,
      clicks: totalClicks,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      engagement: totalEngagement,
      engagement_rate: engagementRate,
      page_views: totalPageViews,
      page_views_desktop: totalPageViewsDesktop,
      page_views_mobile: totalPageViewsMobile,
      posts_published: allPostsData.length,
      organizations_count: organizations.length,
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
