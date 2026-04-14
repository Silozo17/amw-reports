import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken, decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

interface SyncRequest {
  connection_id: string;
  month: number;
  year: number;
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  return data;
}

/** Fetch a single daily metric time series and return the total */
async function fetchDailyMetricTotal(
  locationId: string,
  metric: string,
  year: number,
  month: number,
  lastDay: number,
  accessToken: string
): Promise<number> {
  try {
    const res = await fetch(
      `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries?dailyMetric=${metric}&dailyRange.startDate.year=${year}&dailyRange.startDate.month=${month}&dailyRange.startDate.day=1&dailyRange.endDate.year=${year}&dailyRange.endDate.month=${month}&dailyRange.endDate.day=${lastDay}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`GBP metric ${metric} failed (${res.status}):`, errBody);
      return 0;
    }
    const data = await res.json();
    const dataPoints = data.timeSeries?.datedValues || [];
    return dataPoints.reduce((sum: number, dp: any) => sum + Number(dp.value || 0), 0);
  } catch (e) {
    console.warn(`Could not fetch GBP metric ${metric}:`, e);
    return 0;
  }
}

/** Fetch reviews count, rating, and latest reviews */
async function fetchReviewsData(
  locationId: string,
  accessToken: string,
  apiKey: string
): Promise<{
  reviewsCount: number | null;
  averageRating: number | null;
  latestReviews: Array<{ type: string; author: string; rating: number; text: string; relative_time: string }>;
}> {
  // Fetch rating and count from Places API (New) — still best source for these
  let reviewsCount: number | null = null;
  let averageRating: number | null = null;

  if (apiKey) {
    try {
      // Get placeId for rating/count only
      const placeRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?readMask=metadata`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (placeRes.ok) {
        const placeData = await placeRes.json();
        const placeId = placeData.metadata?.placeId;
        if (placeId) {
          const ratingRes = await fetch(
            `https://places.googleapis.com/v1/places/${placeId}?fields=rating,userRatingCount`,
            {
              headers: {
                "X-Goog-Api-Key": apiKey,
                "Content-Type": "application/json",
              },
            }
          );
          if (ratingRes.ok) {
            const ratingData = await ratingRes.json();
            reviewsCount = ratingData.userRatingCount ?? null;
            averageRating = ratingData.rating ?? null;
          }
        }
      }
    } catch (e) {
      console.warn("Could not fetch rating/count from Places API:", e);
    }
  }

  // Fetch reviews sorted by newest using GMB API
  const latestReviews: Array<{ type: string; author: string; rating: number; text: string; relative_time: string }> = [];
  try {
    const reviewsUrl = `https://mybusiness.googleapis.com/v4/${locationId}/reviews?pageSize=5&orderBy=updateTime+desc`;
    console.log(`GMB reviews URL: ${reviewsUrl}`);
    const reviewsRes = await fetch(reviewsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!reviewsRes.ok) {
      const errText = await reviewsRes.text();
      console.warn(`GMB reviews failed (${reviewsRes.status}):`, errText);
    } else {
      const reviewsData = await reviewsRes.json();
      for (const r of (reviewsData.reviews || []).slice(0, 5)) {
        const starMap: Record<string, number> = {
          ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
        };
        latestReviews.push({
          type: "review",
          author: r.reviewer?.displayName || "Anonymous",
          rating: starMap[r.starRating] ?? 0,
          text: (r.comment || "").slice(0, 300),
          relative_time: r.updateTime
            ? new Date(r.updateTime).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
            : "",
        });
      }
    }
  } catch (e) {
    console.warn("Could not fetch GMB reviews:", e);
  }

  return { reviewsCount, averageRating, latestReviews };
}

/** Fetch top search keywords for the location */
async function fetchSearchKeywords(
  locationId: string,
  year: number,
  month: number,
  accessToken: string
): Promise<Array<{ keyword: string; impressions: number }>> {
  try {
    const res = await fetch(
      `https://businessprofileperformance.googleapis.com/v1/${locationId}/searchkeywords/impressions/monthly?monthlyRange.startMonth.year=${year}&monthlyRange.startMonth.month=${month}&monthlyRange.endMonth.year=${year}&monthlyRange.endMonth.month=${month}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      console.warn(`Search keywords failed (${res.status}):`, await res.text());
      return [];
    }
    const data = await res.json();
    const keywords = data.searchKeywordsCounts || [];
    return keywords
      .map((k: any) => ({
        keyword: k.searchKeyword || "",
        impressions: Number(k.insightsValue?.value || 0),
      }))
      .sort((a: any, b: any) => b.impressions - a.impressions)
      .slice(0, 10);
  } catch (e) {
    console.warn("Could not fetch search keywords:", e);
    return [];
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "sync-google-business-profile", method: req.method, connection_id: null }));

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let connectionId = "";
  let clientId = "";

  try {
    const body: SyncRequest = await req.json();
    connectionId = body.connection_id;
    const { month, year } = body;

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
    if (!conn.is_connected || !conn.refresh_token) {
      return new Response(
        JSON.stringify({ error: "Connection is not authenticated." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get org_id from client
    const { data: clientData } = await supabase.from("clients").select("org_id").eq("id", clientId).single();
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
        platform: "google_business_profile",
        status: "running",
        report_month: month,
        report_year: year,
        org_id: orgId,
      })
      .select("id")
      .single();

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const googleApiKey = Deno.env.get("GOOGLE_API_KEY") || "";

    let accessToken = conn.access_token;
    const tokenExpiry = conn.token_expires_at ? new Date(conn.token_expires_at) : new Date(0);
    if (tokenExpiry <= new Date()) {
      const refreshed = await refreshAccessToken(conn.refresh_token, googleClientId, googleClientSecret);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase.from("platform_connections").update({ access_token: await encryptToken(accessToken), token_expires_at: newExpiry }).eq("id", connectionId);
    }

    const locationId = conn.account_id;
    if (!locationId) {
      throw new Error("No location selected. Please select a business location in the Account Picker.");
    }

    const lastDay = new Date(year, month, 0).getDate();

    // ── Fetch all daily metrics ──────────────────────────────────
    const dailyMetrics = [
      "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
      "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
      "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
      "CALL_CLICKS",
      "WEBSITE_CLICKS",
      "BUSINESS_DIRECTION_REQUESTS",
      "BUSINESS_CONVERSATIONS",
      "BUSINESS_BOOKINGS",
    ];

    const metricTotals: Record<string, number> = {};
    for (const metric of dailyMetrics) {
      metricTotals[metric] = await fetchDailyMetricTotal(locationId, metric, year, month, lastDay, accessToken);
    }

    // Granular breakdown
    const gbpMapsDesktop = metricTotals["BUSINESS_IMPRESSIONS_DESKTOP_MAPS"];
    const gbpMapsLobile = metricTotals["BUSINESS_IMPRESSIONS_MOBILE_MAPS"];
    const gbpSearchDesktop = metricTotals["BUSINESS_IMPRESSIONS_DESKTOP_SEARCH"];
    const gbpSearchMobile = metricTotals["BUSINESS_IMPRESSIONS_MOBILE_SEARCH"];
    const totalSearches = gbpSearchDesktop + gbpSearchMobile;
    const totalMaps = gbpMapsDesktop + gbpMapsLobile;
    const gbpViews = totalMaps + totalSearches;

    // ── Fetch reviews via GMB API + Places API ─────────────────
    const reviews = await fetchReviewsData(locationId, accessToken, googleApiKey);
    const reviewsCount = reviews.reviewsCount;
    const avgRating = reviews.averageRating;
    const latestReviews = reviews.latestReviews;

    // ── Fetch search keywords ────────────────────────────────────
    const searchKeywords = await fetchSearchKeywords(locationId, year, month, accessToken);

    // ── Compute new reviews (diff from previous snapshot) ──────
    let gbpNewReviews: number | null = null;
    if (reviewsCount !== null) {
      const { data: prevSnap } = await supabase
        .from("monthly_snapshots")
        .select("metrics_data")
        .eq("client_id", clientId)
        .eq("platform", "google_business_profile")
        .lt("report_year", year)
        .order("report_year", { ascending: false })
        .order("report_month", { ascending: false })
        .limit(1)
        .maybeSingle();
      const prevCount = (prevSnap?.metrics_data as any)?.gbp_reviews_count;
      if (typeof prevCount === "number") {
        gbpNewReviews = Math.max(0, reviewsCount - prevCount);
      }
    }

    // ── Build metrics data ───────────────────────────────────────
    const metricsData: Record<string, number | null> = {
      gbp_views: gbpViews,
      gbp_searches: totalSearches,
      gbp_calls: metricTotals["CALL_CLICKS"],
      gbp_direction_requests: metricTotals["BUSINESS_DIRECTION_REQUESTS"],
      gbp_website_clicks: metricTotals["WEBSITE_CLICKS"],
      gbp_reviews_count: reviewsCount,
      gbp_average_rating: avgRating,
      gbp_new_reviews: gbpNewReviews,
      gbp_conversations: metricTotals["BUSINESS_CONVERSATIONS"],
      gbp_bookings: metricTotals["BUSINESS_BOOKINGS"],
      gbp_maps_desktop: gbpMapsDesktop,
      gbp_maps_mobile: gbpMapsLobile,
      gbp_search_desktop: gbpSearchDesktop,
      gbp_search_mobile: gbpSearchMobile,
    };

    // ── Build top_content with typed entries ──────────────────────
    const topContentItems: any[] = [];
    for (const r of latestReviews) {
      topContentItems.push(r);
    }
    for (const k of searchKeywords) {
      topContentItems.push({ type: "keyword", keyword: k.keyword, impressions: k.impressions });
    }
    const topContent = topContentItems.length > 0 ? topContentItems : null;

    // ── Upsert snapshot ──────────────────────────────────────────
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "google_business_profile")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) throw new Error("Snapshot for this period is locked.");

    if (existing) {
      await supabase.from("monthly_snapshots")
        .update({ metrics_data: metricsData, raw_data: { dailyMetrics: metricTotals }, top_content: topContent })
        .eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "google_business_profile",
        report_month: month,
        report_year: year,
        metrics_data: metricsData,
        raw_data: { dailyMetrics: metricTotals },
        top_content: topContent,
      });
    }

    await supabase.from("platform_connections").update({
      last_sync_at: new Date().toISOString(), last_sync_status: "success", last_error: null,
    }).eq("id", connectionId);

    if (syncLog?.id) {
      await supabase.from("sync_logs").update({ status: "success", completed_at: new Date().toISOString() }).eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ success: true, metrics: metricsData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Sync error:", e);
    if (connectionId) {
      await supabase.from("platform_connections").update({
        last_sync_status: "failed", last_error: e instanceof Error ? e.message : "Unknown error",
      }).eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
