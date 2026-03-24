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

    // Get the meta_ads connection for this client (pages are stored in meta_ads metadata)
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

    // For facebook platform connections, we need the meta_ads connection's page tokens
    // Find the meta_ads connection for the same client
    const { data: metaConn } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("client_id", clientId)
      .eq("platform", "meta_ads")
      .eq("is_connected", true)
      .single();

    if (!metaConn?.access_token) {
      throw new Error("No connected Meta Ads account found. Connect Meta Ads first to enable Facebook Page sync.");
    }

    const metadata = metaConn.metadata as any;
    const pages = metadata?.pages || [];

    if (pages.length === 0) {
      throw new Error("No Facebook Pages discovered. Reconnect Meta Ads to grant page permissions.");
    }

    // Create sync log
    const { data: syncLog } = await supabase
      .from("sync_logs")
      .insert({ client_id: clientId, platform: "facebook", status: "running", report_month: month, report_year: year })
      .select("id")
      .single();

    // Build date range
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Aggregate across all pages
    let totalImpressions = 0;
    let totalEngagement = 0;
    let totalPageViews = 0;
    let totalFollowerAdds = 0;
    const allTopPosts: any[] = [];

    for (const page of pages) {
      const pageToken = page.access_token || metaConn.access_token;
      const pageId = page.id;

      // Fetch Page Insights
      try {
        const insightsUrl = `${GRAPH_BASE}/${pageId}/insights?metric=page_impressions,page_post_engagements,page_views_total,page_fan_adds&period=day&since=${startDate}&until=${endDate}&access_token=${pageToken}`;
        const insightsRes = await fetch(insightsUrl);
        const insightsData = await insightsRes.json();

        if (insightsData.data) {
          for (const metric of insightsData.data) {
            const total = (metric.values || []).reduce((sum: number, v: any) => sum + (Number(v.value) || 0), 0);
            switch (metric.name) {
              case "page_impressions": totalImpressions += total; break;
              case "page_post_engagements": totalEngagement += total; break;
              case "page_views_total": totalPageViews += total; break;
              case "page_fan_adds": totalFollowerAdds += total; break;
            }
          }
        }
      } catch (e) {
        console.warn(`Could not fetch insights for page ${pageId}:`, e);
      }

      // Fetch top posts
      try {
        const postsUrl = `${GRAPH_BASE}/${pageId}/published_posts?fields=message,created_time,likes.summary(true),comments.summary(true),shares&since=${startDate}&until=${endDate}&limit=10&access_token=${pageToken}`;
        const postsRes = await fetch(postsUrl);
        const postsData = await postsRes.json();

        if (postsData.data) {
          for (const post of postsData.data) {
            const likes = post.likes?.summary?.total_count || 0;
            const comments = post.comments?.summary?.total_count || 0;
            const shares = post.shares?.count || 0;
            allTopPosts.push({
              page_name: page.name,
              message: (post.message || "").substring(0, 100),
              created_time: post.created_time,
              likes,
              comments,
              shares,
              total_engagement: likes + comments + shares,
            });
          }
        }
      } catch (e) {
        console.warn(`Could not fetch posts for page ${pageId}:`, e);
      }
    }

    // Sort top posts by engagement
    const topContent = allTopPosts
      .sort((a, b) => b.total_engagement - a.total_engagement)
      .slice(0, 10);

    const metricsData = {
      impressions: totalImpressions,
      engagement: totalEngagement,
      page_views: totalPageViews,
      follower_growth: totalFollowerAdds,
      engagement_rate: totalImpressions > 0 ? totalEngagement / totalImpressions : 0,
      pages_count: pages.length,
    };

    // Upsert monthly snapshot
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "facebook")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) {
      throw new Error("Snapshot for this period is locked.");
    }

    if (existing) {
      await supabase.from("monthly_snapshots").update({ metrics_data: metricsData, top_content: topContent }).eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({ client_id: clientId, platform: "facebook", report_month: month, report_year: year, metrics_data: metricsData, top_content: topContent });
    }

    // Update connection sync status
    await supabase.from("platform_connections").update({ last_sync_at: new Date().toISOString(), last_sync_status: "success", last_error: null }).eq("id", connectionId);

    if (syncLog?.id) {
      await supabase.from("sync_logs").update({ status: "success", completed_at: new Date().toISOString() }).eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData, pages_synced: pages.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Facebook Page sync error:", e);
    if (connectionId) {
      await supabase.from("platform_connections").update({ last_sync_status: "failed", last_error: e instanceof Error ? e.message : "Unknown error" }).eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
