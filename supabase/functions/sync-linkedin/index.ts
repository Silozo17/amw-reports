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

/**
 * Fetch from LinkedIn API with a single 429 retry after 3s.
 * Throws on any non-OK response.
 */
async function fetchLinkedIn(url: string, token: string, extraHeaders?: Record<string, string>): Promise<Record<string, unknown>> {
  const doFetch = async () => {
    const res = await fetch(url, { headers: { ...liHeaders(token), ...extraHeaders } });
    const body = await res.json();
    if (!res.ok) return { _ok: false, _status: res.status, _body: body };
    return { _ok: true, ...body };
  };

  const first = await doFetch();
  if (!first._ok) {
    if (first._status === 429) {
      console.warn(`LinkedIn 429 for ${url}, retrying after 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
      const retry = await doFetch();
      if (!retry._ok) throw new Error(`LinkedIn API ${retry._status}: ${JSON.stringify(retry._body)}`);
      return retry;
    }
    throw new Error(`LinkedIn API ${first._status}: ${JSON.stringify(first._body)}`);
  }
  return first;
}

/** Get total follower count via networkSizes endpoint. */
async function getFollowerCount(orgUrn: string, token: string): Promise<number> {
  const encodedUrn = encodeURIComponent(orgUrn);
  const data = await fetchLinkedIn(
    `https://api.linkedin.com/rest/networkSizes/${encodedUrn}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`,
    token
  );
  return Number(data.firstDegreeSize || 0);
}

/** Get follower gains (organic + paid) for a time period. Optional — won't fail sync. */
async function getFollowerGains(orgUrn: string, token: string, startMs: number, endMs: number): Promise<{ organic: number; paid: number }> {
  try {
    const encodedUrn = encodeURIComponent(orgUrn);
    const url = `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodedUrn}&timeIntervals.timeGranularityType=MONTH&timeIntervals.timeRange.start=${startMs}&timeIntervals.timeRange.end=${endMs}`;
    const data = await fetchLinkedIn(url, token);

    let organic = 0;
    let paid = 0;
    for (const el of (data.elements || []) as Array<Record<string, unknown>>) {
      const gains = el.followerGains as Record<string, number> | undefined;
      organic += Number(gains?.organicFollowerGain || 0);
      paid += Number(gains?.paidFollowerGain || 0);
    }
    return { organic, paid };
  } catch (e) {
    console.warn(`Follower gains unavailable (expected for months >12mo ago):`, e);
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

/** Get share/post statistics for a time period — CRITICAL, will throw on failure. */
async function getShareStatistics(orgUrn: string, token: string, startMs: number, endMs: number): Promise<ShareStats> {
  const result: ShareStats = { clicks: 0, comments: 0, likes: 0, shares: 0, impressions: 0, uniqueImpressions: 0, engagement: 0 };
  const encodedUrn = encodeURIComponent(orgUrn);
  const url = `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodedUrn}&timeIntervals.timeGranularityType=MONTH&timeIntervals.timeRange.start=${startMs}&timeIntervals.timeRange.end=${endMs}`;
  const data = await fetchLinkedIn(url, token);

  for (const el of (data.elements || []) as Array<Record<string, unknown>>) {
    const s = (el.totalShareStatistics || {}) as Record<string, number>;
    result.clicks += Number(s.clickCount || 0);
    result.comments += Number(s.commentCount || 0);
    result.likes += Number(s.likeCount || 0);
    result.shares += Number(s.shareCount || 0);
    result.impressions += Number(s.impressionCount || 0);
    result.uniqueImpressions += Number(s.uniqueImpressionsCount || 0);
    result.engagement += Number(s.engagement || 0);
  }

  return result;
}

interface PageViews { total: number; desktop: number; mobile: number }

/** Get page view statistics — CRITICAL, will throw on failure. */
async function getPageStatistics(orgUrn: string, token: string, startMs: number, endMs: number): Promise<PageViews> {
  const result: PageViews = { total: 0, desktop: 0, mobile: 0 };
  const encodedUrn = encodeURIComponent(orgUrn);
  const url = `https://api.linkedin.com/rest/organizationPageStatistics?q=organization&organization=${encodedUrn}&timeIntervals.timeGranularityType=MONTH&timeIntervals.timeRange.start=${startMs}&timeIntervals.timeRange.end=${endMs}`;
  const data = await fetchLinkedIn(url, token);

  for (const el of (data.elements || []) as Array<Record<string, unknown>>) {
    const totalStats = el.totalPageStatistics as Record<string, unknown> | undefined;
    const views = (totalStats?.views || {}) as Record<string, { pageViews?: number } | undefined>;
    result.total += Number(views.allPageViews?.pageViews || 0);
    result.desktop += Number(views.allDesktopPageViews?.pageViews || 0);
    result.mobile += Number(views.allMobilePageViews?.pageViews || 0);
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

/** Get top content (posts) — best-effort, won't fail the sync. */
async function getTopContent(orgUrn: string, token: string, monthStartMs: number, monthEndMs: number): Promise<LinkedInPost[]> {
  const posts: LinkedInPost[] = [];
  try {
    const authorUrn = encodeURIComponent(orgUrn);
    const url = `https://api.linkedin.com/rest/posts?author=${authorUrn}&q=author&count=100&sortBy=LAST_MODIFIED`;
    const data = await fetchLinkedIn(url, token, { "X-RestLi-Method": "FINDER" });

    const monthPosts: Array<{ id: string; text: string; createdAt: number }> = [];
    for (const post of (data.elements || []) as Array<Record<string, unknown>>) {
      const createdAt = post.publishedAt || post.createdAt;
      if (!createdAt) continue;
      const postTime = typeof createdAt === "number" ? createdAt : new Date(createdAt as string).getTime();
      if (postTime < monthStartMs || postTime > monthEndMs) continue;
      monthPosts.push({ id: post.id as string, text: (post.commentary || "") as string, createdAt: postTime });
    }

    if (monthPosts.length === 0) return posts;

    // Per-post stats (best-effort)
    try {
      const encodedPostUrns = monthPosts.map((p) => encodeURIComponent(p.id)).join(",");
      const encodedOrgUrn = encodeURIComponent(orgUrn);
      const statsUrl = `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodedOrgUrn}&ugcPosts=List(${encodedPostUrns})`;
      const statsData = await fetchLinkedIn(statsUrl, token);

      const statsMap = new Map<string, { likes: number; comments: number; shares: number; impressions: number; clicks: number }>();
      for (const el of (statsData.elements || []) as Array<Record<string, unknown>>) {
        const postId = (el.ugcPost || el.share) as string | undefined;
        if (!postId) continue;
        const s = (el.totalShareStatistics || {}) as Record<string, number>;
        statsMap.set(postId, {
          likes: Number(s.likeCount || 0), comments: Number(s.commentCount || 0),
          shares: Number(s.shareCount || 0), impressions: Number(s.impressionCount || 0),
          clicks: Number(s.clickCount || 0),
        });
      }

      for (const mp of monthPosts) {
        const s = statsMap.get(mp.id) || { likes: 0, comments: 0, shares: 0, impressions: 0, clicks: 0 };
        posts.push({
          id: mp.id, text: mp.text, permalink: `https://www.linkedin.com/feed/update/${mp.id}`,
          created_time: new Date(mp.createdAt).toISOString(),
          likes: s.likes, comments: s.comments, shares: s.shares,
          impressions: s.impressions, clicks: s.clicks,
          total_engagement: s.likes + s.comments + s.shares,
        });
      }
    } catch (e) {
      console.warn(`Per-post stats failed, returning posts without stats:`, e);
      for (const mp of monthPosts) {
        posts.push({
          id: mp.id, text: mp.text, permalink: `https://www.linkedin.com/feed/update/${mp.id}`,
          created_time: new Date(mp.createdAt).toISOString(),
          likes: 0, comments: 0, shares: 0, impressions: 0, clicks: 0, total_engagement: 0,
        });
      }
    }
  } catch (e) {
    console.warn(`Failed to fetch posts:`, e);
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

    // ── Resolve the selected organization URN ──
    const metadata = conn.metadata as Record<string, unknown> | null;
    const selectedOrg = metadata?.selected_organization as { id?: string; name?: string; urn?: string; entityType?: string } | undefined;
    const selectedOrgId = conn.account_id;

    if (!selectedOrgId) {
      throw new Error("No LinkedIn organization selected. Please select a company page in the connections settings.");
    }

    // Use the stored URN if available, otherwise reconstruct for backward compat
    const orgUrn = selectedOrg?.urn || `urn:li:organization:${selectedOrgId}`;
    const orgName = selectedOrg?.name || conn.account_name || selectedOrgId;

    console.log(`LinkedIn sync: urn=${orgUrn}, name=${orgName}, month=${month}/${year}`);

    // Date range for the target month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    const monthStartMs = monthStart.getTime();
    const monthEndMs = monthEnd.getTime();

    // ── Fetch all data — critical endpoints fail-fast ──
    const [followers, shareStats, pageStats] = await Promise.all([
      getFollowerCount(orgUrn, accessToken),
      getShareStatistics(orgUrn, accessToken, monthStartMs, monthEndMs),
      getPageStatistics(orgUrn, accessToken, monthStartMs, monthEndMs),
    ]);

    // Non-critical — won't fail the sync
    const [gains, topContentRaw] = await Promise.all([
      getFollowerGains(orgUrn, accessToken, monthStartMs, monthEndMs),
      getTopContent(orgUrn, accessToken, monthStartMs, monthEndMs),
    ]);

    console.log(`LinkedIn sync results: followers=${followers}, impressions=${shareStats.impressions}, pageViews=${pageStats.total}, posts=${topContentRaw.length}`);

    const engagementRate = shareStats.impressions > 0
      ? (shareStats.engagement / shareStats.impressions) * 100
      : 0;

    // Sort top content by engagement descending, keep top 10
    topContentRaw.sort((a, b) => b.total_engagement - a.total_engagement);
    const topContent = topContentRaw.slice(0, 10).map((p) => ({
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

    // Metric keys aligned with dashboard expectations (PLATFORM_AVAILABLE_METRICS in database.ts)
    const metricsData = {
      total_followers: followers,
      follower_growth: gains.organic + gains.paid,
      impressions: shareStats.impressions,
      unique_impressions: shareStats.uniqueImpressions,
      clicks: shareStats.clicks,
      likes: shareStats.likes,
      comments: shareStats.comments,
      shares: shareStats.shares,
      engagement: shareStats.engagement,
      engagement_rate: engagementRate,
      page_views: pageStats.total,
      posts_published: topContentRaw.length,
      // Detailed breakdowns (available via extraMetrics in PlatformSection)
      follower_gains_organic: gains.organic,
      follower_gains_paid: gains.paid,
      page_views_desktop: pageStats.desktop,
      page_views_mobile: pageStats.mobile,
    };

    // Preserve raw response summary for diagnostics
    const rawData = {
      _sync_ts: new Date().toISOString(),
      _org_urn: orgUrn,
      follower_count_raw: followers,
      share_stats_raw: shareStats,
      page_stats_raw: pageStats,
      gains_raw: gains,
      posts_count: topContentRaw.length,
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
      await supabase.from("monthly_snapshots").update({ metrics_data: metricsData, top_content: topContent, raw_data: rawData }).eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({ client_id: clientId, platform: "linkedin", report_month: month, report_year: year, metrics_data: metricsData, top_content: topContent, raw_data: rawData });
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
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    if (connectionId) {
      await supabase.from("platform_connections").update({ last_sync_status: "failed", last_error: errorMsg }).eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
