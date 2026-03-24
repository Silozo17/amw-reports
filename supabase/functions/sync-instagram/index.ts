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

    // Find meta_ads connection to get Instagram business account IDs
    const { data: metaConn } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("client_id", clientId)
      .eq("platform", "meta_ads")
      .eq("is_connected", true)
      .single();

    if (!metaConn?.access_token) {
      throw new Error("No connected Meta Ads account found. Connect Meta Ads first to enable Instagram sync.");
    }

    const metadata = metaConn.metadata as any;
    const pages = metadata?.pages || [];
    const igAccounts = pages
      .filter((p: any) => p.instagram?.id)
      .map((p: any) => ({ ig_id: p.instagram.id, ig_username: p.instagram.username, page_token: p.access_token || metaConn.access_token }));

    if (igAccounts.length === 0) {
      throw new Error("No Instagram Business accounts found. Make sure your Facebook Pages have linked Instagram accounts.");
    }

    // Create sync log
    const { data: syncLog } = await supabase
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
    const allTopMedia: any[] = [];

    for (const ig of igAccounts) {
      const { ig_id, page_token } = ig;

      // Fetch IG User Insights (impressions, reach, profile_views)
      try {
        const insightsUrl = `${GRAPH_BASE}/${ig_id}/insights?metric=impressions,reach,profile_views&period=day&since=${sinceTs}&until=${untilTs}&access_token=${page_token}`;
        const insightsRes = await fetch(insightsUrl);
        const insightsData = await insightsRes.json();

        if (insightsData.data) {
          for (const metric of insightsData.data) {
            const total = (metric.values || []).reduce((sum: number, v: any) => sum + (Number(v.value) || 0), 0);
            switch (metric.name) {
              case "impressions": totalImpressions += total; break;
              case "reach": totalReach += total; break;
              case "profile_views": totalProfileViews += total; break;
            }
          }
        }
      } catch (e) {
        console.warn(`Could not fetch IG insights for ${ig_id}:`, e);
      }

      // Fetch follower count (current snapshot)
      try {
        const userRes = await fetch(`${GRAPH_BASE}/${ig_id}?fields=followers_count&access_token=${page_token}`);
        const userData = await userRes.json();
        if (userData.followers_count) {
          totalFollowerCount += userData.followers_count;
        }
      } catch (e) {
        console.warn(`Could not fetch follower count for ${ig_id}:`, e);
      }

      // Fetch top media
      try {
        const mediaUrl = `${GRAPH_BASE}/${ig_id}/media?fields=caption,timestamp,like_count,comments_count,media_type&since=${sinceTs}&until=${untilTs}&limit=25&access_token=${page_token}`;
        const mediaRes = await fetch(mediaUrl);
        const mediaData = await mediaRes.json();

        if (mediaData.data) {
          for (const m of mediaData.data) {
            allTopMedia.push({
              caption: (m.caption || "").substring(0, 100),
              timestamp: m.timestamp,
              likes: m.like_count || 0,
              comments: m.comments_count || 0,
              media_type: m.media_type,
              total_engagement: (m.like_count || 0) + (m.comments_count || 0),
            });
          }
        }
      } catch (e) {
        console.warn(`Could not fetch media for ${ig_id}:`, e);
      }
    }

    const topContent = allTopMedia
      .sort((a, b) => b.total_engagement - a.total_engagement)
      .slice(0, 10);

    const metricsData = {
      impressions: totalImpressions,
      reach: totalReach,
      profile_visits: totalProfileViews,
      total_followers: totalFollowerCount,
      engagement: allTopMedia.reduce((sum, m) => sum + m.total_engagement, 0),
      engagement_rate: totalImpressions > 0 ? allTopMedia.reduce((sum, m) => sum + m.total_engagement, 0) / totalImpressions : 0,
      posts_published: allTopMedia.length,
    };

    // Upsert monthly snapshot
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "instagram")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    if (existing) {
      await supabase.from("monthly_snapshots").update({ metrics_data: metricsData, top_content: topContent }).eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({ client_id: clientId, platform: "instagram", report_month: month, report_year: year, metrics_data: metricsData, top_content: topContent });
    }

    await supabase.from("platform_connections").update({ last_sync_at: new Date().toISOString(), last_sync_status: "success", last_error: null }).eq("id", connectionId);

    if (syncLog?.id) {
      await supabase.from("sync_logs").update({ status: "success", completed_at: new Date().toISOString() }).eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData, accounts_synced: igAccounts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Instagram sync error:", e);
    if (connectionId) {
      await supabase.from("platform_connections").update({ last_sync_status: "failed", last_error: e instanceof Error ? e.message : "Unknown error" }).eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
