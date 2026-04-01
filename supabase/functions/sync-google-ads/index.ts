import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken, decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const body: SyncRequest = await req.json();
    connectionId = body.connection_id;
    const { month, year } = body;

    if (!connectionId || !month || !year) {
      return new Response(
        JSON.stringify({ error: "connection_id, month, and year are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get connection details
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

    if (!conn.is_connected || !conn.refresh_token) {
      return new Response(
        JSON.stringify({ error: "Connection is not authenticated. Please connect via OAuth first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Create sync log
    const { data: syncLog } = await supabase
      .from("sync_logs")
      .insert({
        client_id: clientId,
        platform: "google_ads",
        status: "running",
        report_month: month,
        report_year: year,
        org_id: orgId,
      })
      .select("id")
      .single();

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const devToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;

    // Refresh access token
    let accessToken = conn.access_token;
    const tokenExpiry = conn.token_expires_at ? new Date(conn.token_expires_at) : new Date(0);

    if (tokenExpiry <= new Date()) {
      const refreshed = await refreshAccessToken(conn.refresh_token, googleClientId, googleClientSecret);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      await supabase
        .from("platform_connections")
        .update({ access_token: accessToken, token_expires_at: newExpiry })
        .eq("id", connectionId);
    }

    // Determine the customer ID to query — auto-discover if missing
    let customerId = conn.account_id;
    if (!customerId) {
      const discoverRes = await fetch(
        "https://googleads.googleapis.com/v20/customers:listAccessibleCustomers",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": devToken,
          },
        }
      );
      if (!discoverRes.ok) {
        const errText = await discoverRes.text();
        throw new Error(
          `Failed to discover Google Ads customers (${discoverRes.status}): ${errText.substring(0, 200)}`
        );
      }
      const discoverData = await discoverRes.json();
      if (discoverData.resourceNames && discoverData.resourceNames.length > 0) {
        customerId = discoverData.resourceNames[0].replace("customers/", "");
        // Save discovered customer ID back to the connection
        await supabase
          .from("platform_connections")
          .update({
            account_id: customerId,
            account_name: `Google Ads (${customerId})`,
          })
          .eq("id", connectionId);
      } else {
        throw new Error(
          `No accessible Google Ads accounts found. Ensure this Google account has access to a Google Ads account.`
        );
      }
    }

    // Build date range for the requested month
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Query Google Ads API for campaign performance
    const query = `
      SELECT
        campaign.name,
        campaign.id,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm,
        metrics.search_impression_share,
        metrics.search_rank_lost_impression_share
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
    `;

    const searchUrl = `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:searchStream`;
    const adsRes = await fetch(searchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": devToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!adsRes.ok) {
      const errText = await adsRes.text();
      let errMsg = errText.substring(0, 500);
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson?.error?.message || errMsg;
      } catch { /* not JSON */ }
      throw new Error(`Google Ads API error (${adsRes.status}): ${errMsg}`);
    }

    const adsData = await adsRes.json();

    // Parse results - searchStream returns array of batches
    const results = adsData.flatMap((batch: any) => batch.results || []);

    // Aggregate metrics
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalCostMicros = 0;
    let totalConversions = 0;
    let totalConversionsValue = 0;
    let totalSearchImpressionShare = 0;

    const campaigns: any[] = [];

    for (const row of results) {
      const m = row.metrics || {};
      const impressions = Number(m.impressions || 0);
      const clicks = Number(m.clicks || 0);
      const costMicros = Number(m.costMicros || 0);
      const conversions = Number(m.conversions || 0);
      const conversionsValue = Number(m.conversionsValue || 0);

      totalImpressions += impressions;
      totalClicks += clicks;
      totalCostMicros += costMicros;
      totalConversions += conversions;
      totalConversionsValue += conversionsValue;
      totalSearchImpressionShare += Number(m.searchImpressionShare || 0);
      campaigns.push({
        name: row.campaign?.name || "Unknown",
        id: row.campaign?.id,
        status: row.campaign?.status,
        impressions,
        clicks,
        cost: costMicros / 1_000_000,
        conversions,
        conversions_value: conversionsValue,
        ctr: Number(m.ctr || 0),
        avg_cpc: Number(m.averageCpc || 0) / 1_000_000,
        avg_cpm: Number(m.averageCpm || 0) / 1_000_000,
      });
    }

    // Geographic breakdown query
    const geoQuery = `
      SELECT
        geographic_view.country_criterion_id,
        geographic_view.resource_name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM geographic_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.cost_micros DESC
      LIMIT 30
    `;

    let geoBreakdown: any[] = [];
    try {
      const geoRes = await fetch(searchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": devToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: geoQuery }),
      });

      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const geoResults = geoData.flatMap((batch: any) => batch.results || []);
        geoBreakdown = geoResults.map((row: any) => ({
          country_id: row.geographicView?.countryCriterionId || null,
          resource_name: row.geographicView?.resourceName || null,
          impressions: Number(row.metrics?.impressions || 0),
          clicks: Number(row.metrics?.clicks || 0),
          cost: Number(row.metrics?.costMicros || 0) / 1_000_000,
          conversions: Number(row.metrics?.conversions || 0),
        }));
      } else {
        console.warn("Geographic view query failed, skipping:", await geoRes.text().then(t => t.substring(0, 200)));
      }
    } catch (geoErr) {
      console.warn("Geographic breakdown fetch failed, skipping:", geoErr);
    }

    // Device breakdown query
    const deviceQuery = `
      SELECT
        segments.device,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'
    `;

    let deviceBreakdown: any[] = [];
    try {
      const deviceRes = await fetch(searchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": devToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: deviceQuery }),
      });

      if (deviceRes.ok) {
        const deviceData = await deviceRes.json();
        const deviceResults = deviceData.flatMap((batch: any) => batch.results || []);
        // Aggregate by device
        const deviceMap = new Map<string, { impressions: number; clicks: number; cost: number; conversions: number }>();
        for (const row of deviceResults) {
          const device = row.segments?.device || "UNKNOWN";
          const existing = deviceMap.get(device) || { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
          existing.impressions += Number(row.metrics?.impressions || 0);
          existing.clicks += Number(row.metrics?.clicks || 0);
          existing.cost += Number(row.metrics?.costMicros || 0) / 1_000_000;
          existing.conversions += Number(row.metrics?.conversions || 0);
          deviceMap.set(device, existing);
        }
        deviceBreakdown = Array.from(deviceMap.entries()).map(([device, metrics]) => ({
          device,
          ...metrics,
        })).sort((a, b) => b.cost - a.cost);
      } else {
        console.warn("Device breakdown query failed, skipping:", await deviceRes.text().then(t => t.substring(0, 200)));
      }
    } catch (devErr) {
      console.warn("Device breakdown fetch failed, skipping:", devErr);
    }

    const totalCost = totalCostMicros / 1_000_000;
    const overallCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const overallCpc = totalClicks > 0 ? totalCost / totalClicks : 0;
    const overallCpm = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0;
    const costPerConversion = totalConversions > 0 ? totalCost / totalConversions : 0;

    const metricsData = {
      impressions: totalImpressions,
      clicks: totalClicks,
      spend: totalCost,
      conversions: totalConversions,
      conversions_value: totalConversionsValue,
      ctr: overallCtr,
      cpc: overallCpc,
      cpm: overallCpm,
      cost_per_conversion: costPerConversion,
      roas: totalCost > 0 ? totalConversionsValue / totalCost : 0,
      reach: 0,
      conversion_rate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
      search_impression_share: totalSearchImpressionShare,
      campaign_count: campaigns.length,
    };

    // Top campaigns by spend
    const topContent = [
      ...campaigns
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10)
        .map((c) => ({
          type: "campaign",
          name: c.name,
          spend: c.cost,
          clicks: c.clicks,
          impressions: c.impressions,
          conversions: c.conversions,
          ctr: c.ctr,
        })),
      ...geoBreakdown.map((g) => ({ type: "geo", ...g })),
      ...deviceBreakdown.map((d) => ({ type: "device", ...d })),
    ];

    const rawData = { campaigns, geoBreakdown, deviceBreakdown };

    // Upsert monthly snapshot
    const { data: existing } = await supabase
      .from("monthly_snapshots")
      .select("id, snapshot_locked")
      .eq("client_id", clientId)
      .eq("platform", "google_ads")
      .eq("report_month", month)
      .eq("report_year", year)
      .single();

    if (existing?.snapshot_locked) {
      throw new Error("Snapshot for this period is locked and cannot be overwritten.");
    }

    if (existing) {
      await supabase
        .from("monthly_snapshots")
        .update({
          metrics_data: metricsData,
          top_content: topContent,
          raw_data: rawData,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("monthly_snapshots").insert({
        client_id: clientId,
        platform: "google_ads",
        report_month: month,
        report_year: year,
        metrics_data: metricsData,
        top_content: topContent,
        raw_data: rawData,
      });
    }

    // Update connection sync status
    await supabase
      .from("platform_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "success",
        last_error: null,
      })
      .eq("id", connectionId);

    // Update sync log
    if (syncLog?.id) {
      await supabase
        .from("sync_logs")
        .update({ status: "success", completed_at: new Date().toISOString() })
        .eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        metrics: metricsData,
        campaigns_synced: campaigns.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Sync error:", e);

    // Update connection with error
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
