import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken, decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

/** Refresh an expired Pinterest access token using Basic auth. */
async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const appId = Deno.env.get("PINTEREST_APP_ID")!;
  const appSecret = Deno.env.get("PINTEREST_APP_SECRET")!;
  const basicAuth = btoa(`${appId}:${appSecret}`);

  const res = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.code) {
    throw new Error(data.message || `Pinterest token refresh failed (${res.status})`);
  }
  return data;
}

/** Format a Date to YYYY-MM-DD */
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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
    const { data: clientData } = await supabase
      .from("clients")
      .select("org_id")
      .eq("id", clientId)
      .single();
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
      .insert({
        client_id: clientId,
        platform: "pinterest",
        status: "running",
        report_month: month,
        report_year: year,
        org_id: orgId,
      })
      .select("id")
      .single();

    let accessToken = conn.access_token;

    // Check if token is expired — refresh if needed
    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      if (!conn.refresh_token) {
        throw new Error("Access token expired and no refresh token available. Please reconnect.");
      }
      const refreshed = await refreshAccessToken(conn.refresh_token);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase
        .from("platform_connections")
        .update({
          access_token: await encryptToken(refreshed.access_token),
          refresh_token: await encryptToken(refreshed.refresh_token || conn.refresh_token),
          token_expires_at: newExpiry,
        })
        .eq("id", connectionId);
    }

    const headers = { Authorization: `Bearer ${accessToken}` };

    // Date range for the target month
    const startDate = fmtDate(new Date(year, month - 1, 1));
    const endDate = fmtDate(new Date(year, month, 0)); // last day of month

    // ── Fetch user account analytics ──
    const analyticsUrl = new URL("https://api.pinterest.com/v5/user_account/analytics");
    analyticsUrl.searchParams.set("start_date", startDate);
    analyticsUrl.searchParams.set("end_date", endDate);
    analyticsUrl.searchParams.set("content_type", "ORGANIC");
    analyticsUrl.searchParams.set("metric_types", "ENGAGEMENT,ENGAGEMENT_RATE,IMPRESSION,OUTBOUND_CLICK,PIN_CLICK,SAVE");

    let impressions = 0;
    let saves = 0;
    let pinClicks = 0;
    let outboundClicks = 0;
    let engagement = 0;
    let engagementRate = 0;
    let dayCount = 0;

    try {
      const analyticsRes = await fetch(analyticsUrl.toString(), { headers });
      const analyticsData = await analyticsRes.json();
      console.log("Pinterest analytics response:", JSON.stringify(analyticsData));

      if (!analyticsRes.ok) {
        throw new Error(analyticsData.message || `Analytics API error (${analyticsRes.status})`);
      }

      // Response is keyed by date, aggregate all days
      if (analyticsData.all) {
        const dailyEntries = analyticsData.all.daily_metrics || [];
        for (const day of dailyEntries) {
          impressions += Number(day.data_status === "READY" ? day.metrics?.IMPRESSION || 0 : 0);
          saves += Number(day.metrics?.SAVE || 0);
          pinClicks += Number(day.metrics?.PIN_CLICK || 0);
          outboundClicks += Number(day.metrics?.OUTBOUND_CLICK || 0);
          engagement += Number(day.metrics?.ENGAGEMENT || 0);
          if (day.metrics?.ENGAGEMENT_RATE) {
            engagementRate += Number(day.metrics.ENGAGEMENT_RATE);
            dayCount++;
          }
        }
      } else {
        // Flat keyed-by-date format
        for (const [key, val] of Object.entries(analyticsData)) {
          if (key === "code" || key === "message") continue;
          const v = val as Record<string, number>;
          impressions += Number(v.IMPRESSION || 0);
          saves += Number(v.SAVE || 0);
          pinClicks += Number(v.PIN_CLICK || 0);
          outboundClicks += Number(v.OUTBOUND_CLICK || 0);
          engagement += Number(v.ENGAGEMENT || 0);
          if (v.ENGAGEMENT_RATE) {
            engagementRate += Number(v.ENGAGEMENT_RATE);
            dayCount++;
          }
        }
      }
    } catch (e) {
      console.error("Pinterest analytics error:", e);
      throw e;
    }

    // Average engagement rate over the period
    if (dayCount > 0) {
      engagementRate = engagementRate / dayCount;
    }

    // ── Fetch user account for follower count and pin count ──
    let totalFollowers = 0;
    let totalPins = 0;
    try {
      const userRes = await fetch("https://api.pinterest.com/v5/user_account", { headers });
      const userData = await userRes.json();
      console.log("Pinterest user account:", JSON.stringify(userData));
      totalFollowers = Number(userData.follower_count || 0);
      totalPins = Number(userData.pin_count || 0);
    } catch (e) {
      console.warn("Could not fetch Pinterest user account:", e);
    }

    // ── Fetch boards for top boards breakdown ──
    interface BoardInfo {
      id: string;
      name: string;
      pin_count: number;
      description: string;
    }

    const boards: BoardInfo[] = [];
    let totalBoards = 0;
    try {
      let boardsUrl: string | null = "https://api.pinterest.com/v5/boards?page_size=25";
      while (boardsUrl) {
        const boardsRes = await fetch(boardsUrl, { headers });
        const boardsData = await boardsRes.json();

        if (boardsData.items) {
          for (const board of boardsData.items) {
            boards.push({
              id: board.id,
              name: board.name || "Untitled Board",
              pin_count: Number(board.pin_count || 0),
              description: board.description || "",
            });
          }
        }
        totalBoards = boards.length;
        boardsUrl = boardsData.bookmark
          ? `https://api.pinterest.com/v5/boards?page_size=25&bookmark=${boardsData.bookmark}`
          : null;
      }
    } catch (e) {
      console.warn("Could not fetch Pinterest boards:", e);
    }

    // Sort boards by pin count descending, keep top 10
    boards.sort((a, b) => b.pin_count - a.pin_count);
    const topBoards = boards.slice(0, 10).map((b) => ({
      id: b.id,
      name: b.name,
      pin_count: b.pin_count,
      description: b.description,
    }));

    const metricsData = {
      impressions,
      saves,
      pin_clicks: pinClicks,
      outbound_clicks: outboundClicks,
      engagement,
      engagement_rate: Math.round(engagementRate * 100) / 100,
      total_followers: totalFollowers,
      total_pins: totalPins,
      total_boards: totalBoards,
    };

    // Upsert snapshot
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "pinterest")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    if (existing) {
      await supabase
        .from("monthly_snapshots")
        .update({ metrics_data: metricsData, top_content: topBoards, raw_data: {} })
        .eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "pinterest",
        report_month: month,
        report_year: year,
        metrics_data: metricsData,
        top_content: topBoards,
        raw_data: {},
      });
    }

    await supabase
      .from("platform_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "success",
        last_error: null,
      })
      .eq("id", connectionId);

    if (syncLog?.id) {
      await supabase
        .from("sync_logs")
        .update({ status: "success", completed_at: new Date().toISOString() })
        .eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Pinterest sync error:", e);
    if (connectionId) {
      await supabase
        .from("platform_connections")
        .update({
          last_sync_status: "failed",
          last_error: e instanceof Error ? e.message : "Unknown error",
        })
        .eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
