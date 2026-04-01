import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYNC_FUNCTION_MAP: Record<string, string> = {
  google_ads: "sync-google-ads",
  meta_ads: "sync-meta-ads",
  facebook: "sync-facebook-page",
  instagram: "sync-instagram",
  tiktok: "sync-tiktok-business",
  tiktok_ads: "sync-tiktok-ads",
  linkedin: "sync-linkedin",
  google_search_console: "sync-google-search-console",
  google_analytics: "sync-google-analytics",
  google_business_profile: "sync-google-business-profile",
  youtube: "sync-youtube",
  pinterest: "sync-pinterest",
};

const DELAY_BETWEEN_SYNCS_MS = 1_500;
const DEFAULT_MONTHS = 12;

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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

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

    // Get months range and check which already have snapshots
    const monthsRange = getMonthsRange(months);

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
