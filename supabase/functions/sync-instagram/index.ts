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

    if (!conn.is_connected || !conn.access_token) {
      throw new Error("Instagram connection is not authenticated. Please connect via OAuth first.");
    }

    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      await supabaseClient.from("platform_connections")
        .update({ last_error: "Token expired. Please reconnect.", last_sync_status: "failed" })
        .eq("id", connectionId);
      return new Response(JSON.stringify({ error: "Token expired" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const metadata = conn.metadata as any;
    const igAccounts = (metadata?.ig_accounts || [])
      .filter((ig: any) => ig.id && ig.page_token)
      .map((ig: any) => ({ ig_id: ig.id, ig_username: ig.username, page_token: ig.page_token }));

    const targetIgId = conn.account_id;
    const filteredAccounts = targetIgId ? igAccounts.filter((ig: any) => ig.ig_id === targetIgId) : igAccounts;

    if (filteredAccounts.length === 0) {
      throw new Error("No Instagram Business accounts found. Please reconnect Instagram and ensure your Facebook Pages have linked Instagram accounts.");
    }

    const { data: clientData } = await supabaseClient.from("clients").select("org_id").eq("id", clientId).single();
    const orgId = clientData?.org_id;

    const { data: syncLog } = await supabaseClient
      .from("sync_logs")
      .insert({ client_id: clientId, platform: "instagram", status: "running", report_month: month, report_year: year, org_id: orgId })
      .select("id")
      .single();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Split month into two halves for IG insights (API limit: ≤30 days)
    const midDay = Math.min(15, lastDay);
    const midDate = `${year}-${String(month).padStart(2, "0")}-${String(midDay).padStart(2, "0")}`;
    const dateRanges = [
      { since: Math.floor(new Date(startDate + "T00:00:00Z").getTime() / 1000), until: Math.floor(new Date(midDate + "T23:59:59Z").getTime() / 1000) },
      { since: Math.floor(new Date(midDate + "T00:00:00Z").getTime() / 1000) + 86400, until: Math.floor(new Date(endDate + "T23:59:59Z").getTime() / 1000) },
    ].filter(r => r.since <= r.until);

    let totalReach = 0;
    let totalProfileViews = 0;
    let totalFollowerCount = 0;
    let totalMediaCount = 0;
    const allTopMedia: any[] = [];
    const globalMetricsMap: Record<string, number> = {};

    for (const ig of filteredAccounts) {
      const { ig_id, page_token } = ig;

      // Fetch IG User Insights: reach (day period)
      try {
        for (const range of dateRanges) {
          const insightsUrl = `${GRAPH_BASE}/${ig_id}/insights?metric=reach&period=day&since=${range.since}&until=${range.until}&access_token=${page_token}`;
          const insightsRes = await fetch(insightsUrl);
          if (!insightsRes.ok) {
            const errorBody = await insightsRes.text();
            throw new Error(`API error (${insightsRes.status}): ${errorBody}`);
          }
          const insightsData = await insightsRes.json();
          if (insightsData.data) {
            for (const metric of insightsData.data) {
              const total = (metric.values || []).reduce((sum: number, v: any) => sum + (Number(v.value) || 0), 0);
              globalMetricsMap[metric.name] = (globalMetricsMap[metric.name] || 0) + total;
            }
          }
        }
        totalReach += globalMetricsMap.reach || 0;
      } catch (pageError) {
        const errorMsg = pageError instanceof Error ? pageError.message : "Unknown error";
        console.error(`IG insights sync error:`, errorMsg);
        await supabaseClient.from("platform_connections")
          .update({ last_error: errorMsg, last_sync_status: "partial" })
          .eq("id", connectionId);
      }

      // Fetch profile_views (metric_type=total_value)
      try {
        for (const range of dateRanges) {
          const pvUrl = `${GRAPH_BASE}/${ig_id}/insights?metric=profile_views&period=day&metric_type=total_value&since=${range.since}&until=${range.until}&access_token=${page_token}`;
          const pvRes = await fetch(pvUrl);
          if (pvRes.ok) {
            const pvData = await pvRes.json();
            const pvValue = pvData?.data?.[0]?.total_value?.value || 0;
            totalProfileViews += pvValue;
            globalMetricsMap['profile_views'] = (globalMetricsMap['profile_views'] || 0) + pvValue;
          }
        }
      } catch {} // non-blocking

      // Fetch website_clicks (metric_type=total_value)
      try {
        for (const range of dateRanges) {
          const wcUrl = `${GRAPH_BASE}/${ig_id}/insights?metric=website_clicks&period=day&metric_type=total_value&since=${range.since}&until=${range.until}&access_token=${page_token}`;
          const wcRes = await fetch(wcUrl);
          if (wcRes.ok) {
            const wcData = await wcRes.json();
            const wcValue = wcData?.data?.[0]?.total_value?.value || 0;
            globalMetricsMap['website_clicks'] = (globalMetricsMap['website_clicks'] || 0) + wcValue;
          }
        }
      } catch {} // non-blocking

      // Fetch follower count and media count
      try {
        const userRes = await fetch(`${GRAPH_BASE}/${ig_id}?fields=followers_count,media_count&access_token=${page_token}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.followers_count) totalFollowerCount += userData.followers_count;
          if (userData.media_count) totalMediaCount += userData.media_count;
        }
      } catch (e) {
        console.error("IG profile fetch error:", e instanceof Error ? e.message : e);
      }

      // Fetch media posted in the month
      try {
        const mediaUrl = `${GRAPH_BASE}/${ig_id}/media?fields=caption,timestamp,like_count,comments_count,media_type,media_url,thumbnail_url,permalink,media_product_type&since=${dateRanges[0].since}&until=${dateRanges[dateRanges.length - 1].until}&limit=50&access_token=${page_token}`;
        const mediaRes = await fetch(mediaUrl);
        if (!mediaRes.ok) {
          const errorBody = await mediaRes.text();
          throw new Error(`Media API error (${mediaRes.status}): ${errorBody}`);
        }
        const mediaData = await mediaRes.json();

        if (mediaData.data) {
          for (const mediaItem of mediaData.data.slice(0, 25)) {
            const isVideo = mediaItem.media_type === 'VIDEO' || mediaItem.media_product_type === 'REELS';

            // Fetch per-media insights with correct metrics per type
            let postReach = 0;
            let postViews = 0;
            let postSaves = 0;

            try {
              // For REELS: use plays (views), reach, saved
              // For VIDEO: use views, reach, saved
              // For IMAGE/CAROUSEL: use reach, saved
              const metricsToFetch = isVideo
                ? 'plays,reach,saved'
                : 'reach,saved';

              const mediaInsightsUrl = `${GRAPH_BASE}/${mediaItem.id}/insights?metric=${metricsToFetch}&access_token=${page_token}`;
              const mediaInsightsRes = await fetch(mediaInsightsUrl);

              if (mediaInsightsRes.ok) {
                const mediaInsightsData = await mediaInsightsRes.json();
                for (const insight of mediaInsightsData.data || []) {
                  const val = insight.values?.[0]?.value || 0;
                  if (insight.name === 'reach') postReach = val;
                  if (insight.name === 'saved') postSaves = val;
                  if (insight.name === 'plays') postViews = val;
                }
              } else {
                // Fallback: try older metric names
                const fallbackUrl = `${GRAPH_BASE}/${mediaItem.id}/insights?metric=reach,saved&access_token=${page_token}`;
                const fallbackRes = await fetch(fallbackUrl);
                if (fallbackRes.ok) {
                  const fallbackData = await fallbackRes.json();
                  for (const insight of fallbackData.data || []) {
                    const val = insight.values?.[0]?.value || 0;
                    if (insight.name === 'reach') postReach = val;
                    if (insight.name === 'saved') postSaves = val;
                  }
                }
              }
            } catch {} // non-blocking per-post

            allTopMedia.push({
              caption: (mediaItem.caption || "").substring(0, 100),
              timestamp: mediaItem.timestamp,
              likes: mediaItem.like_count || 0,
              comments: mediaItem.comments_count || 0,
              saves: postSaves,
              video_views: postViews,
              reach: postReach,
              media_type: mediaItem.media_type,
              full_picture: mediaItem.media_url || mediaItem.thumbnail_url || null,
              permalink_url: mediaItem.permalink || null,
              total_engagement: (mediaItem.like_count || 0) + (mediaItem.comments_count || 0) + postSaves,
            });
          }
        }
      } catch (pageError) {
        const errorMsg = pageError instanceof Error ? pageError.message : "Unknown error";
        console.error(`IG media sync error:`, errorMsg);
        await supabaseClient.from("platform_connections")
          .update({ last_error: errorMsg, last_sync_status: "partial" })
          .eq("id", connectionId);
      }
    }

    // Aggregate metrics from posts
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

    const postsInMonth = allTopMedia.filter(m => {
      const d = new Date(m.timestamp);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    }).length;

    const metricsData: Record<string, number> = {
      impressions: totalReach, // IG reach ≈ impressions for organic
      reach: totalReach,
      profile_visits: totalProfileViews,
      website_clicks: globalMetricsMap['website_clicks'] || 0,
      engagement: totalLikes + totalComments + totalSaves,
      likes: totalLikes,
      comments: totalComments,
      saves: totalSaves,
      video_views: totalVideoViews,
      posts_published: postsInMonth,
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

    console.log(`Instagram sync complete. video_views=${totalVideoViews}, reach=${totalReach}, posts=${allTopMedia.length}`);

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData, accounts_synced: filteredAccounts.length }),
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
