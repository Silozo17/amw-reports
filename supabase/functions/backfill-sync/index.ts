import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

const SYNC_FUNCTION_MAP: Record<string, string> = {
  google_ads: "sync-google-ads",
  meta_ads: "sync-meta-ads",
  facebook: "sync-facebook-page",
  instagram: "sync-instagram",
  tiktok: "sync-tiktok-business",
  tiktok_ads: "sync-tiktok-ads",
  linkedin: "sync-linkedin",
  linkedin_ads: "sync-linkedin-ads",
  google_search_console: "sync-google-search-console",
  google_analytics: "sync-google-analytics",
  google_business_profile: "sync-google-business-profile",
  youtube: "sync-youtube",
  pinterest: "sync-pinterest"
};

const DELAY_BETWEEN_SYNCS_MS = 1_500;
const DEFAULT_MONTHS = 12;

/** Platform-specific caps — Pinterest API limits analytics to 90 days. */
const PLATFORM_MAX_MONTHS: Record<string, number> = {
  pinterest: 3
};

interface BackfillResult {
  month: number;
  year: number;
  action: "synced" | "skipped" | "failed";
  error?: string;
}

function getMonthsRange(count: number, startOffset = 0): Array<{ month: number; year: number }> {
  const now = new Date();
  const result: Array<{ month: number; year: number }> = [];
  for (let i = startOffset; i < startOffset + count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "backfill-sync", method: req.method, connection_id: null }));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Authentication ──
    // Allow service-role calls (e.g. from scheduled-sync) to bypass user auth.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    let callerUserId: string | null = null;

    if (!isServiceRole) {
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Missing authorization" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
      if (claimsError || !claimsData?.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      callerUserId = claimsData.user.id;
    }

    const { connection_id, months = DEFAULT_MONTHS, start_offset = 0 } = await req.json();

    if (!connection_id) {
      return new Response(
        JSON.stringify({ error: "connection_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch connection details
    const { data: conn, error: connError } = await supabase
      .from("platform_connections")
      .select("id, platform, client_id, is_connected, account_id")
      .eq("id", connection_id)
      .maybeSingle();

    if (connError || !conn) {
      return new Response(
        JSON.stringify({ error: "Connection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Authorisation: verify caller belongs to the org that owns the connection ──
    if (!isServiceRole && callerUserId) {
      const { data: client } = await supabase
        .from("clients")
        .select("org_id")
        .eq("id", conn.client_id)
        .single();

      if (!client) {
        return new Response(
          JSON.stringify({ error: "Client not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: membership } = await supabase
        .from("org_members")
        .select("id")
        .eq("org_id", client.org_id)
        .eq("user_id", callerUserId)
        .maybeSingle();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: "Forbidden — you do not belong to this organisation" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!conn.is_connected || !conn.account_id) {
      return new Response(
        JSON.stringify({ error: "Connection is not active", connection_id }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fnName = SYNC_FUNCTION_MAP[conn.platform];
    if (!fnName) {
      return new Response(
        JSON.stringify({ error: `Unsupported platform: ${conn.platform}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cap months to platform-specific limit
    const cappedMonths = Math.min(months, PLATFORM_MAX_MONTHS[conn.platform] ?? months);

    // Get months range and check which already have snapshots
    const monthsRange = getMonthsRange(cappedMonths, start_offset);

    const { data: existingSnapshots } = await supabase
      .from("monthly_snapshots")
      .select("report_month, report_year")
      .eq("client_id", conn.client_id)
      .eq("platform", conn.platform);

    const existingSet = new Set(
      (existingSnapshots || []).map((s) => `${s.report_month}-${s.report_year}`)
    );

    // Process each missing month sequentially with delay
    const results: BackfillResult[] = [];

    for (const { month, year } of monthsRange) {
      const key = `${month}-${year}`;

      if (existingSet.has(key)) {
        results.push({ month, year, action: "skipped" });
        continue;
      }

      try {
        const { data, error } = await supabase.functions.invoke(fnName, {
          body: { connection_id: conn.id, month, year },
        });

        if (error) {
          results.push({ month, year, action: "failed", error: error.message });
        } else if (data?.error) {
          results.push({ month, year, action: "failed", error: data.error });
        } else {
          results.push({ month, year, action: "synced" });
        }
      } catch (e) {
        results.push({
          month,
          year,
          action: "failed",
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }

      // Rate-limit between sync calls
      await sleep(DELAY_BETWEEN_SYNCS_MS);
    }

    const synced = results.filter((r) => r.action === "synced").length;
    const skipped = results.filter((r) => r.action === "skipped").length;
    const failed = results.filter((r) => r.action === "failed").length;

    return new Response(
      JSON.stringify({
        connection_id,
        platform: conn.platform,
        client_id: conn.client_id,
        summary: { synced, skipped, failed, total: results.length },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Backfill sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
