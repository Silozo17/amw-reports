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

const DELAY_BETWEEN_MONTHS_MS = 1_500;
const DELAY_BETWEEN_CONNECTIONS_MS = 3_000;

/** Pinterest API limits analytics to ~90 days. */
const PLATFORM_MAX_MONTHS: Record<string, number> = {
  pinterest: 3
};

type SyncMode = "single_month" | "date_range" | "full";

interface ConnectionTarget {
  id: string;
  platform: string;
}

interface MonthYear {
  month: number;
  year: number;
}

interface SyncResult {
  connection_id: string;
  platform: string;
  month: number;
  year: number;
  action: "synced" | "failed";
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Build the list of months to sync based on mode. */
function buildMonthsList(
  mode: SyncMode,
  opts: {
    month?: number;
    year?: number;
    start_month?: number;
    start_year?: number;
    end_month?: number;
    end_year?: number;
    months?: number;
  },
  platform: string
): MonthYear[] {
  const now = new Date();
  let months: MonthYear[] = [];

  if (mode === "single_month" && opts.month && opts.year) {
    months = [{ month: opts.month, year: opts.year }];
  } else if (
    mode === "date_range" &&
    opts.start_month &&
    opts.start_year &&
    opts.end_month &&
    opts.end_year
  ) {
    let d = new Date(opts.start_year, opts.start_month - 1, 1);
    const end = new Date(opts.end_year, opts.end_month - 1, 1);
    while (d <= end) {
      months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  } else {
    // full mode — go back N months from current
    const count = opts.months ?? 24;
    for (let i = 0; i < count; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }
  }

  // Cap to platform limits
  const maxMonths = PLATFORM_MAX_MONTHS[platform];
  if (maxMonths && months.length > maxMonths) {
    months = months.slice(0, maxMonths);
  }

  return months;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "admin-sync", method: req.method, connection_id: null }));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate caller is a platform admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub as string;

    // Verify platform admin
    const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden — platform admin required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      connections,
      mode = "full",
      month,
      year,
      start_month,
      start_year,
      end_month,
      end_year,
      months = 24,
    } = body as {
      connections: ConnectionTarget[];
      mode?: SyncMode;
      month?: number;
      year?: number;
      start_month?: number;
      start_year?: number;
      end_month?: number;
      end_year?: number;
      months?: number;
    };

    if (!connections || !Array.isArray(connections) || connections.length === 0) {
      return new Response(
        JSON.stringify({ error: "connections array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `Admin sync started: ${connections.length} connection(s), mode=${mode}`
    );

    const results: SyncResult[] = [];

    // Process each connection sequentially (queue)
    for (let ci = 0; ci < connections.length; ci++) {
      const conn = connections[ci];
      const fnName = SYNC_FUNCTION_MAP[conn.platform];
      if (!fnName) {
        results.push({
          connection_id: conn.id,
          platform: conn.platform,
          month: 0,
          year: 0,
          action: "failed",
          error: `Unsupported platform: ${conn.platform}`,
        });
        continue;
      }

      const monthsList = buildMonthsList(
        mode as SyncMode,
        { month, year, start_month, start_year, end_month, end_year, months },
        conn.platform
      );

      console.log(
        `Syncing connection ${ci + 1}/${connections.length}: ${conn.platform} (${conn.id}), ${monthsList.length} month(s)`
      );

      // Process each month sequentially (queue within queue)
      for (let mi = 0; mi < monthsList.length; mi++) {
        const { month: m, year: y } = monthsList[mi];

        try {
          const { data, error } = await supabase.functions.invoke(fnName, {
            body: { connection_id: conn.id, month: m, year: y },
          });

          if (error) {
            console.error(`Failed ${conn.platform} ${m}/${y}: ${error.message}`);
            results.push({
              connection_id: conn.id,
              platform: conn.platform,
              month: m,
              year: y,
              action: "failed",
              error: error.message,
            });
          } else if (data?.error) {
            console.error(`Failed ${conn.platform} ${m}/${y}: ${data.error}`);
            results.push({
              connection_id: conn.id,
              platform: conn.platform,
              month: m,
              year: y,
              action: "failed",
              error: data.error,
            });
          } else {
            results.push({
              connection_id: conn.id,
              platform: conn.platform,
              month: m,
              year: y,
              action: "synced",
            });
          }
        } catch (e) {
          results.push({
            connection_id: conn.id,
            platform: conn.platform,
            month: m,
            year: y,
            action: "failed",
            error: e instanceof Error ? e.message : "Unknown error",
          });
        }

        // Delay between months
        if (mi < monthsList.length - 1) {
          await sleep(DELAY_BETWEEN_MONTHS_MS);
        }
      }

      // Delay between connections
      if (ci < connections.length - 1) {
        await sleep(DELAY_BETWEEN_CONNECTIONS_MS);
      }
    }

    const synced = results.filter((r) => r.action === "synced").length;
    const failed = results.filter((r) => r.action === "failed").length;

    console.log(`Admin sync complete: ${synced} synced, ${failed} failed`);

    return new Response(
      JSON.stringify({
        summary: { synced, failed, total: results.length },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Admin sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
