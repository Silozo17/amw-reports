import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken, decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "sync-youtube", method: req.method, connection_id: null }));

  try {
    const { connection_id, month, year } = await req.json();

    if (!connection_id || !month || !year) {
      return new Response(
        JSON.stringify({ error: "connection_id, month, and year are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: conn, error: connError } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("id", connection_id)
      .single();

    if (connError || !conn) {
      return new Response(
        JSON.stringify({ error: "Connection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt tokens
    if (conn.access_token) conn.access_token = await decryptToken(conn.access_token);
    if (conn.refresh_token) conn.refresh_token = await decryptToken(conn.refresh_token);

    // Get org_id from client
    const { data: client } = await supabase.from("clients").select("org_id").eq("id", conn.client_id).single();
    const orgId = client?.org_id;

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
        client_id: conn.client_id,
        platform: "youtube",
        status: "running",
        report_month: month,
        report_year: year,
        org_id: orgId,
      })
      .select("id")
      .single();

    try {
      let accessToken = conn.access_token;

      // Refresh token if expired
      if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
        const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
        const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: conn.refresh_token!,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.error) throw new Error(refreshData.error_description || refreshData.error);

        accessToken = refreshData.access_token;
        const expiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();

        await supabase
          .from("platform_connections")
          .update({ access_token: await encryptToken(accessToken), token_expires_at: expiresAt })
          .eq("id", connection_id);
      }

      const channelId = conn.account_id;
      if (!channelId) throw new Error("No YouTube channel selected");

      // Date range for the month
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const rawEndDate = new Date(year, month - 1, lastDay);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const effectiveEnd = rawEndDate < yesterday ? rawEndDate : yesterday;
      const endDate = effectiveEnd.toISOString().split("T")[0];

      // Query YouTube Analytics API
      const metricsParam = "views,estimatedMinutesWatched,likes,comments,shares,subscribersGained,subscribersLost,averageViewDuration";
      const analyticsUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${channelId}&startDate=${startDate}&endDate=${endDate}&metrics=${metricsParam}`;

      const analyticsRes = await fetch(analyticsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const analyticsData = await analyticsRes.json();
      console.log("YouTube Analytics response:", JSON.stringify(analyticsData));

      if (analyticsData.error) {
        throw new Error(analyticsData.error.message || "YouTube Analytics API error");
      }

      const row = analyticsData.rows?.[0] || [];
      const metricsData: Record<string, number> = {
        views: row[0] || 0,
        watch_time: row[1] || 0,
        likes: row[2] || 0,
        comments: row[3] || 0,
        shares: row[4] || 0,
        subscribers: (row[5] || 0) - (row[6] || 0),
        avg_view_duration: row[7] || 0,
      };

      // Optionally fetch impressions/CTR (not available for all channels)
      try {
        const impUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${channelId}&startDate=${startDate}&endDate=${endDate}&metrics=impressions,impressionClickThroughRate`;
        const impRes = await fetch(impUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        const impData = await impRes.json();
        if (!impData.error && impData.rows?.[0]) {
          metricsData.impressions = impData.rows[0][0] || 0;
          metricsData.ctr = (impData.rows[0][1] || 0) * 100;
        }
      } catch {} // non-blocking

      // Always set video_views from monthly analytics (not lifetime channel stats)
      metricsData.video_views = metricsData.views;

      try {
        const channelRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const channelData = await channelRes.json();
        if (channelData.items?.[0]?.statistics) {
          metricsData.total_followers = parseInt(channelData.items[0].statistics.subscriberCount || "0", 10);
          metricsData.videos_published = parseInt(channelData.items[0].statistics.videoCount || "0", 10);
        }
      } catch (e) {
        console.warn("Could not fetch channel stats:", e);
      }

      // Fetch top videos for the period
      let topContent: any[] = [];
      try {
        const topVideosUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${channelId}&startDate=${startDate}&endDate=${endDate}&metrics=views,likes,comments&dimensions=video&sort=-views&maxResults=5`;
        const topRes = await fetch(topVideosUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const topData = await topRes.json();
        if (topData.rows?.length > 0) {
          const videoIds = topData.rows.map((r: any[]) => r[0]).join(",");
          const videosRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoIds}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const videosData = await videosRes.json();
          const titleMap: Record<string, string> = {};
          for (const item of videosData.items || []) {
            titleMap[item.id] = item.snippet?.title || item.id;
          }

          topContent = topData.rows.map((r: any[]) => ({
            id: r[0],
            title: titleMap[r[0]] || r[0],
            views: r[1],
            likes: r[2],
            comments: r[3],
          }));
        }
      } catch (e) {
        console.warn("Could not fetch top videos:", e);
      }

      // Select-then-update/insert (same pattern as other syncs) to prevent duplicates
      const { data: existing } = await supabase
        .from("monthly_snapshots")
        .select("id, snapshot_locked")
        .eq("client_id", conn.client_id)
        .eq("platform", "youtube")
        .eq("report_month", month)
        .eq("report_year", year)
        .single();

      if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

      if (existing) {
        await supabase
          .from("monthly_snapshots")
          .update({ metrics_data: metricsData, top_content: topContent })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("monthly_snapshots")
          .insert({
            client_id: conn.client_id,
            platform: "youtube",
            report_month: month,
            report_year: year,
            metrics_data: metricsData,
            top_content: topContent,
          });
      }

      // Update sync log
      await supabase
        .from("sync_logs")
        .update({ status: "success", completed_at: new Date().toISOString() })
        .eq("id", syncLog?.id);

      // Update connection
      await supabase
        .from("platform_connections")
        .update({ last_sync_at: new Date().toISOString(), last_sync_status: "success", last_error: null })
        .eq("id", connection_id);

      return new Response(
        JSON.stringify({ success: true, metrics: metricsData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (syncError) {
      console.error("YouTube sync error:", syncError);

      if (syncLog?.id) {
        await supabase
          .from("sync_logs")
          .update({
            status: "failed",
            error_message: syncError instanceof Error ? syncError.message : "Unknown error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncLog.id);
      }

      await supabase
        .from("platform_connections")
        .update({
          last_sync_status: "failed",
          last_error: syncError instanceof Error ? syncError.message : "Unknown error",
        })
        .eq("id", connection_id);

      throw syncError;
    }
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
