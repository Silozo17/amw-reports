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
  tiktok: "sync-tiktok-ads",
  linkedin: "sync-linkedin",
  google_search_console: "sync-google-search-console",
  google_analytics: "sync-google-analytics",
  google_business_profile: "sync-google-business-profile",
  youtube: "sync-youtube",
  pinterest: "sync-pinterest",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Determine which months to sync
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const dayOfMonth = now.getDate();

    const monthsToSync: Array<{ month: number; year: number }> = [
      { month: currentMonth, year: currentYear },
    ];

    // If we're in the first 7 days of a new month, also sync the previous month
    // to catch late-reporting data from platforms
    if (dayOfMonth <= 7) {
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      monthsToSync.push({ month: prevMonth, year: prevYear });
    }

    // Fetch all active connections with their org's plan slug
    const { data: connections, error: connError } = await supabase
      .from("platform_connections")
      .select("id, platform, client_id, clients!inner(org_id)")
      .eq("is_connected", true)
      .not("account_id", "is", null);

    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active connections to sync", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gather unique org IDs and fetch their plan slugs
    const orgIds = [...new Set(connections.map((c: any) => c.clients.org_id))];
    const { data: subscriptions, error: subError } = await supabase
      .from("org_subscriptions")
      .select("org_id, subscription_plans!inner(slug)")
      .in("org_id", orgIds)
      .eq("status", "active");

    if (subError) throw subError;

    // Build org_id → plan_slug map
    const orgPlanMap: Record<string, string> = {};
    for (const sub of subscriptions || []) {
      orgPlanMap[(sub as any).org_id] = (sub as any).subscription_plans.slug;
    }

    const results: Array<{
      connection_id: string;
      platform: string;
      month: number;
      year: number;
      success: boolean;
      error?: string;
    }> = [];

    let skippedStarter = 0;

    // Process connections sequentially to avoid rate limits
    for (const conn of connections) {
      const orgId = (conn as any).clients.org_id;
      const planSlug = orgPlanMap[orgId] || "starter";

      // Creator/Starter plan: only sync on the 4th of the month
      if (planSlug === "starter" && dayOfMonth !== 4) {
        skippedStarter++;
        continue;
      }

      const fnName = SYNC_FUNCTION_MAP[conn.platform];
      if (!fnName) continue;

      for (const { month, year } of monthsToSync) {
        try {
          const { data, error } = await supabase.functions.invoke(fnName, {
            body: { connection_id: conn.id, month, year },
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          results.push({
            connection_id: conn.id,
            platform: conn.platform,
            month,
            year,
            success: true,
          });
        } catch (e) {
          results.push({
            connection_id: conn.id,
            platform: conn.platform,
            month,
            year,
            success: false,
            error: e instanceof Error ? e.message : "Unknown error",
          });
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        message: `Scheduled sync complete: ${successCount} succeeded, ${failCount} failed, ${skippedStarter} skipped (Creator plan, not 4th)`,
        months_synced: monthsToSync,
        total_connections: connections.length,
        skipped_starter: skippedStarter,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Scheduled sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
