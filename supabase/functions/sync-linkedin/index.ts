import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LI_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": "202401",
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

    if (!conn.is_connected || !conn.access_token) {
      throw new Error("Connection is not authenticated. Please connect via OAuth first.");
    }

    // Get org_id from client
    const { data: clientData } = await supabase.from("clients").select("org_id").eq("id", clientId).single();
    const orgId = clientData?.org_id;

    const { data: syncLog } = await supabase
      .from("sync_logs")
      .insert({ client_id: clientId, platform: "linkedin", status: "running", report_month: month, report_year: year, org_id: orgId })
      .select("id")
      .single();

    const accessToken = conn.access_token;
    const metadata = conn.metadata as any;
    const organizations = metadata?.organizations || [];

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

    // ── Fetch organic post engagement for each organization ──
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalImpressions = 0;
    let totalClicks = 0;

    for (const org of organizations) {
      try {
        const postsUrl = `https://api.linkedin.com/rest/ugcPosts?q=authors&authors=List(urn:li:organization:${org.id})&count=50`;
        const postsRes = await fetch(postsUrl, { headers: LI_HEADERS(accessToken) });
        const postsData = await postsRes.json();

        for (const post of postsData.elements || []) {
          try {
            const statsUrl = `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${org.id}&ugcPosts=List(${post.id})`;
            const statsRes = await fetch(statsUrl, { headers: LI_HEADERS(accessToken) });
            const statsData = await statsRes.json();

            for (const stat of statsData.elements || []) {
              const s = stat.totalShareStatistics || {};
              totalLikes += Number(s.likeCount || 0);
              totalComments += Number(s.commentCount || 0);
              totalShares += Number(s.shareCount || 0);
              totalImpressions += Number(s.impressionCount || 0);
              totalClicks += Number(s.clickCount || 0);
            }
          } catch {} // non-blocking per post
        }
      } catch (e) {
        console.warn(`LinkedIn org posts error for ${org.id}:`, e);
      }
    }

    const totalEngagement = totalLikes + totalComments + totalShares;

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
    };

    // Upsert monthly snapshot
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
      await supabase.from("monthly_snapshots").update({ metrics_data: metricsData, top_content: [], raw_data: {} }).eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({ client_id: clientId, platform: "linkedin", report_month: month, report_year: year, metrics_data: metricsData, top_content: [], raw_data: {} });
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
