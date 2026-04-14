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

    // ─── Fetch User Insights ───
    let totalViews = 0;
    let totalLikes = 0;
    let totalReplies = 0;
    let totalReposts = 0;
    let totalQuotes = 0;
    let totalClicks = 0;
    let followersCount = 0;

    try {
      const insightsUrl = `${THREADS_API}/${threadsUserId}/threads_insights?metric=views,likes,replies,reposts,quotes&since=${effectiveSince}&until=${untilTs}&access_token=${accessToken}`;
      const insightsRes = await fetch(insightsUrl);
      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        for (const metric of insightsData.data || []) {
          const total = (metric.values || []).reduce((sum: number, v: { value?: number }) => sum + (Number(v.value) || 0), 0);
          switch (metric.name) {
            case "views": totalViews = total; break;
            case "likes": totalLikes = total; break;
            case "replies": totalReplies = total; break;
            case "reposts": totalReposts = total; break;
            case "quotes": totalQuotes = total; break;
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

    // ─── Fetch Media (posts) ───
    const allPosts: Array<{
      text: string;
      timestamp: string;
      likes: number;
      comments: number;
      shares: number;
      quotes: number;
      views: number;
      permalink_url: string | null;
      media_type: string;
      total_engagement: number;
    }> = [];

    try {
      let mediaUrl: string | null = `${THREADS_API}/${threadsUserId}/threads?fields=id,text,timestamp,media_type,permalink,like_count,reply_count&since=${effectiveSince}&until=${untilTs}&limit=50&access_token=${accessToken}`;

      while (mediaUrl && (Date.now() - startTime) < SAFETY_DEADLINE_MS) {
        const mediaRes = await fetch(mediaUrl);
        if (!mediaRes.ok) break;
        const mediaData = await mediaRes.json();

        for (const post of mediaData.data || []) {
          let postViews = 0;
          let postReposts = 0;
          let postQuotes = 0;

          // Per-post insights (non-blocking)
          try {
            const postInsightsUrl = `${THREADS_API}/${post.id}/insights?metric=views,reposts,quotes&access_token=${accessToken}`;
            const piRes = await fetch(postInsightsUrl);
            if (piRes.ok) {
              const piData = await piRes.json();
              for (const m of piData.data || []) {
                const val = m.values?.[0]?.value || 0;
                if (m.name === "views") postViews = val;
                if (m.name === "reposts") postReposts = val;
                if (m.name === "quotes") postQuotes = val;
              }
            }
          } catch {} // non-blocking

          allPosts.push({
            text: (post.text || "").substring(0, 100),
            timestamp: post.timestamp,
            likes: post.like_count || 0,
            comments: post.reply_count || 0,
            shares: postReposts,
            quotes: postQuotes,
            views: postViews,
            permalink_url: post.permalink || null,
            media_type: post.media_type || "TEXT_POST",
            total_engagement: (post.like_count || 0) + (post.reply_count || 0) + postReposts + postQuotes,
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

    const totalEngagement = totalLikes + totalReplies + totalReposts + totalQuotes;
    const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

    const metricsData: Record<string, number> = {
      views: totalViews,
      likes: totalLikes,
      comments: totalReplies,
      shares: totalReposts,
      quotes: totalQuotes,
      clicks: totalClicks,
      engagement: totalEngagement,
      engagement_rate: engagementRate,
      posts_published: postsInMonth,
    };

    if (followersCount > 0) {
      metricsData.total_followers = followersCount;
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
        views: p.views,
        permalink_url: p.permalink_url,
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

    await supabaseClient.from("platform_connections").update({ last_sync_at: new Date().toISOString(), last_sync_status: "success", last_error: null }).eq("id", connectionId);

    if (syncLog?.id) {
      await supabaseClient.from("sync_logs").update({ status: "success", completed_at: new Date().toISOString() }).eq("id", syncLog.id);
    }

    console.log(`Threads sync complete. views=${totalViews}, posts=${allPosts.length}, followers=${followersCount}`);

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
