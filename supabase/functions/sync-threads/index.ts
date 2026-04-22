import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

const THREADS_API = "https://graph.threads.net/v1.0";
const SAFETY_DEADLINE_MS = 50_000;
const MIN_FOLLOWERS_FOR_DEMOGRAPHICS = 100;
const DEMO_BREAKDOWNS = ["country", "city", "age", "gender"] as const;

type DemoBreakdown = typeof DEMO_BREAKDOWNS[number];

interface PostRow {
  id: string;
  text: string;
  timestamp: string;
  likes: number;
  comments: number;
  reposts: number;
  shares: number;
  quotes: number;
  views: number;
  permalink_url: string | null;
  media_url: string | null;
  media_type: string;
  is_quote_post: boolean;
  username: string | null;
  total_engagement: number;
}

async function fetchDemographicBreakdown(
  threadsUserId: string,
  accessToken: string,
  breakdown: DemoBreakdown,
): Promise<Record<string, number>> {
  try {
    const url = `${THREADS_API}/${threadsUserId}/threads_insights?metric=follower_demographics&breakdown=${breakdown}&access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const json = await res.json();
    const metric = (json.data || []).find((m: { name: string }) => m.name === "follower_demographics");
    const breakdowns = metric?.total_value?.breakdowns?.[0];
    if (!breakdowns?.results) return {};
    const out: Record<string, number> = {};
    for (const r of breakdowns.results) {
      const key = (r.dimension_values || []).join("|");
      if (key) out[key] = Number(r.value) || 0;
    }
    return out;
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "sync-threads", method: req.method, connection_id: null }));

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

  let connectionId = "";
  let clientId = "";
  const startTime = Date.now();

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

    if (!conn.is_connected || !conn.access_token) {
      throw new Error("Threads connection is not authenticated. Please connect via OAuth first.");
    }

    const accessToken = await decryptToken(conn.access_token);
    const threadsUserId = conn.account_id;

    if (!threadsUserId) {
      throw new Error("No Threads user ID found. Please reconnect.");
    }

    const { data: clientData } = await supabaseClient.from("clients").select("org_id").eq("id", clientId).single();
    const orgId = clientData?.org_id;
    if (!orgId) {
      throw new Error("Could not resolve org_id for client — sync aborted");
    }

    // Require authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (orgId) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabaseClient.auth.getUser(token);
      if (caller) {
        const { data: membership } = await supabaseClient.from("org_members").select("id").eq("user_id", caller.id).eq("org_id", orgId).limit(1).single();
        if (!membership) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    const { data: syncLog } = await supabaseClient
      .from("sync_logs")
      .insert({ client_id: clientId, platform: "threads", status: "running", report_month: month, report_year: year, org_id: orgId })
      .select("id")
      .single();

    // Date range
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const sinceTs = Math.floor(startDate.getTime() / 1000);
    const untilTs = Math.floor(endDate.getTime() / 1000);

    // Threads API minimum date: April 13, 2024
    const minTimestamp = 1712991600;
    if (untilTs < minTimestamp) {
      throw new Error("Threads API only supports data from April 13, 2024 onwards.");
    }

    const effectiveSince = Math.max(sinceTs, minTimestamp);

    // ─── Fetch Profile Metadata (once per sync) ───
    let profileMeta: {
      username?: string;
      display_name?: string;
      profile_picture_url?: string;
      biography?: string;
      is_verified?: boolean;
    } = {};
    try {
      const profileUrl = `${THREADS_API}/${threadsUserId}?fields=id,username,name,threads_profile_picture_url,threads_biography,is_verified&access_token=${accessToken}`;
      const profileRes = await fetch(profileUrl);
      if (profileRes.ok) {
        const p = await profileRes.json();
        profileMeta = {
          username: p.username,
          display_name: p.name,
          profile_picture_url: p.threads_profile_picture_url,
          biography: p.threads_biography,
          is_verified: !!p.is_verified,
        };
      }
    } catch (e) {
      console.error("Threads profile fetch failed:", e);
    }

    // ─── Fetch User Insights ───
    let totalProfileViews = 0;
    let totalLikes = 0;
    let totalReplies = 0;
    let totalReposts = 0;
    let totalQuotes = 0;
    let totalClicks = 0;
    let followersCount = 0;

    try {
      const insightsUrl = `${THREADS_API}/${threadsUserId}/threads_insights?metric=views,likes,replies,reposts,quotes,clicks&since=${effectiveSince}&until=${untilTs}&access_token=${accessToken}`;
      const insightsRes = await fetch(insightsUrl);
      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        for (const metric of insightsData.data || []) {
          // `clicks` uses `link_total_values`; others use `values`.
          let total = 0;
          if (Array.isArray(metric.link_total_values)) {
            total = metric.link_total_values.reduce(
              (sum: number, v: { value?: number }) => sum + (Number(v.value) || 0),
              0,
            );
          } else if (typeof metric.total_value?.value === "number") {
            total = metric.total_value.value;
          } else {
            total = (metric.values || []).reduce(
              (sum: number, v: { value?: number }) => sum + (Number(v.value) || 0),
              0,
            );
          }
          switch (metric.name) {
            case "views": totalProfileViews = total; break;
            case "likes": totalLikes = total; break;
            case "replies": totalReplies = total; break;
            case "reposts": totalReposts = total; break;
            case "quotes": totalQuotes = total; break;
            case "clicks": totalClicks = total; break;
          }
        }
      } else {
        const errBody = await insightsRes.text();
        console.error("Threads user insights error:", insightsRes.status, errBody);
      }
    } catch (e) {
      console.error("Threads user insights fetch failed:", e);
    }

    // Fetch followers_count separately (it's a total_value metric)
    try {
      const followerUrl = `${THREADS_API}/${threadsUserId}/threads_insights?metric=followers_count&since=${effectiveSince}&until=${untilTs}&access_token=${accessToken}`;
      const followerRes = await fetch(followerUrl);
      if (followerRes.ok) {
        const followerData = await followerRes.json();
        const fcMetric = (followerData.data || []).find((m: { name: string }) => m.name === "followers_count");
        if (fcMetric?.total_value?.value) {
          followersCount = fcMetric.total_value.value;
        } else if (fcMetric?.values?.length) {
          followersCount = fcMetric.values[fcMetric.values.length - 1]?.value || 0;
        }
      }
    } catch (e) {
      console.error("Threads followers_count fetch failed:", e);
    }

    // ─── Fetch Follower Demographics (best-effort, only if ≥100 followers) ───
    let followerDemographics: Record<DemoBreakdown, Record<string, number>> | null = null;
    if (followersCount >= MIN_FOLLOWERS_FOR_DEMOGRAPHICS) {
      const demos = await Promise.all(
        DEMO_BREAKDOWNS.map((b) => fetchDemographicBreakdown(threadsUserId, accessToken, b)),
      );
      followerDemographics = {
        country: demos[0],
        city: demos[1],
        age: demos[2],
        gender: demos[3],
      };
    }

    // ─── Fetch Media (posts) ───
    const allPosts: PostRow[] = [];

    try {
      let mediaUrl: string | null = `${THREADS_API}/${threadsUserId}/threads?fields=id,text,timestamp,media_type,permalink,media_url,username,is_quote_post,like_count,reply_count&since=${effectiveSince}&until=${untilTs}&limit=50&access_token=${accessToken}`;

      while (mediaUrl && (Date.now() - startTime) < SAFETY_DEADLINE_MS) {
        const mediaRes = await fetch(mediaUrl);
        if (!mediaRes.ok) break;
        const mediaData = await mediaRes.json();

        for (const post of mediaData.data || []) {
          let postViews = 0;
          let postLikes = post.like_count || 0;
          let postReplies = post.reply_count || 0;
          let postReposts = 0;
          let postShares = 0;
          let postQuotes = 0;

          // Per-post insights (non-blocking) — full metric set
          try {
            const postInsightsUrl = `${THREADS_API}/${post.id}/insights?metric=views,likes,replies,reposts,quotes,shares&access_token=${accessToken}`;
            const piRes = await fetch(postInsightsUrl);
            if (piRes.ok) {
              const piData = await piRes.json();
              for (const m of piData.data || []) {
                const val = Number(m.values?.[0]?.value ?? m.total_value?.value ?? 0) || 0;
                switch (m.name) {
                  case "views": postViews = val; break;
                  case "likes": postLikes = val || postLikes; break;
                  case "replies": postReplies = val || postReplies; break;
                  case "reposts": postReposts = val; break;
                  case "shares": postShares = val; break;
                  case "quotes": postQuotes = val; break;
                }
              }
            }
          } catch {} // non-blocking

          const totalEngagement = postLikes + postReplies + postReposts + postShares + postQuotes;

          allPosts.push({
            id: post.id,
            text: (post.text || "").substring(0, 140),
            timestamp: post.timestamp,
            likes: postLikes,
            comments: postReplies,
            reposts: postReposts,
            shares: postShares,
            quotes: postQuotes,
            views: postViews,
            permalink_url: post.permalink || null,
            media_url: post.media_url || null,
            media_type: post.media_type || "TEXT_POST",
            is_quote_post: !!post.is_quote_post,
            username: post.username || null,
            total_engagement: totalEngagement,
          });
        }

        mediaUrl = mediaData.paging?.next || null;
      }
    } catch (e) {
      console.error("Threads media fetch error:", e);
    }

    // ─── Compute Metrics ───
    const postsInMonth = allPosts.filter(p => {
      const d = new Date(p.timestamp);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    }).length;

    const sumPostViews = allPosts.reduce((s, p) => s + (p.views || 0), 0);
    // user-insights `views` is profile views; engagement-rate denominator
    // should be the larger of (profile views, sum of post views) so brand-new
    // accounts with low profile views still get a meaningful rate.
    const totalPostShares = allPosts.reduce((s, p) => s + (p.shares || 0), 0);
    const totalEngagement = totalLikes + totalReplies + totalReposts + totalQuotes + totalPostShares;
    const engagementDenominator = Math.max(totalProfileViews, sumPostViews);
    const engagementRate = engagementDenominator > 0 ? (totalEngagement / engagementDenominator) * 100 : 0;

    const metricsData: Record<string, number | Record<string, unknown>> = {
      // Back-compat: keep `views` populated with the largest available view count.
      views: Math.max(totalProfileViews, sumPostViews),
      profile_views: totalProfileViews,
      likes: totalLikes,
      comments: totalReplies,
      shares: totalPostShares,
      reposts: totalReposts,
      quotes: totalQuotes,
      clicks: totalClicks,
      engagement: totalEngagement,
      engagement_rate: engagementRate,
      posts_published: postsInMonth,
    };

    if (followersCount > 0) {
      metricsData.total_followers = followersCount;
    }
    if (followerDemographics) {
      metricsData.follower_demographics = followerDemographics;
    }

    // Top content
    const topContent = allPosts
      .sort((a, b) => b.total_engagement - a.total_engagement)
      .slice(0, 10)
      .map(p => ({
        caption: p.text,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        reposts: p.reposts,
        quotes: p.quotes,
        views: p.views,
        permalink_url: p.permalink_url,
        media_url: p.media_url,
        is_quote_post: p.is_quote_post,
        username: p.username,
        total_engagement: p.total_engagement,
        type: p.media_type,
      }));

    // Upsert snapshot
    const { data: existing } = await supabaseClient
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "threads")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    if (existing) {
      await supabaseClient.from("monthly_snapshots").update({ metrics_data: metricsData, top_content: topContent }).eq("id", existing.id);
    } else {
      await supabaseClient.from("monthly_snapshots").insert({ client_id: clientId, platform: "threads", report_month: month, report_year: year, metrics_data: metricsData, top_content: topContent });
    }

    // Update connection metadata + account_name with refreshed profile info
    const mergedMetadata = {
      ...(conn.metadata || {}),
      ...(profileMeta.username ? { username: profileMeta.username } : {}),
      ...(profileMeta.display_name ? { display_name: profileMeta.display_name } : {}),
      ...(profileMeta.profile_picture_url ? { profile_picture_url: profileMeta.profile_picture_url } : {}),
      ...(profileMeta.biography !== undefined ? { biography: profileMeta.biography } : {}),
      ...(profileMeta.is_verified !== undefined ? { is_verified: profileMeta.is_verified } : {}),
    };
    const connectionUpdate: Record<string, unknown> = {
      last_sync_at: new Date().toISOString(),
      last_sync_status: "success",
      last_error: null,
      metadata: mergedMetadata,
    };
    if (profileMeta.display_name && profileMeta.display_name !== conn.account_name) {
      connectionUpdate.account_name = profileMeta.display_name;
    } else if (profileMeta.username && !conn.account_name) {
      connectionUpdate.account_name = profileMeta.username;
    }

    await supabaseClient.from("platform_connections").update(connectionUpdate).eq("id", connectionId);

    if (syncLog?.id) {
      await supabaseClient.from("sync_logs").update({ status: "success", completed_at: new Date().toISOString() }).eq("id", syncLog.id);
    }

    console.log(`Threads sync complete. profile_views=${totalProfileViews}, post_views_sum=${sumPostViews}, posts=${allPosts.length}, followers=${followersCount}, clicks=${totalClicks}, demo=${followerDemographics ? "yes" : "no"}`);

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Threads sync error:", e);
    if (connectionId) {
      await supabaseClient.from("platform_connections").update({ last_sync_status: "failed", last_error: e instanceof Error ? e.message : "Unknown error" }).eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
