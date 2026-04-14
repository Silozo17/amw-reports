import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cron-only function — no CORS needed

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
  pinterest: "sync-pinterest",
};

const SYNC_TIMEOUT_MS = 60_000; // 60 seconds per sync
const BATCH_SIZE = 4; // Process 4 connections in parallel

interface SyncResult {
  connection_id: string;
  platform: string;
  month: number;
  year: number;
  success: boolean;
  error?: string;
}

/** Invoke a sync function with an AbortController timeout */
async function invokeWithTimeout(
  supabase: ReturnType<typeof createClient>,
  fnName: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<{ data?: any; error?: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { data, error } = await supabase.functions.invoke(fnName, {
      body,
      // @ts-ignore — AbortSignal support
    });
    clearTimeout(timer);
    return { data, error };
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === "AbortError") {
      return { error: { message: `Sync timed out after ${timeoutMs / 1000}s` } };
    }
    return { error: { message: e instanceof Error ? e.message : "Unknown error" } };
  }
}

/** Send a sync_failed email to the org owner (fire-and-forget) */
async function notifySyncFailure(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  clientId: string,
  platform: string,
  errorMsg: string,
  month: number,
  year: number
) {
  try {
    const { data: ownerMember } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (!ownerMember?.user_id) return;

    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", ownerMember.user_id)
      .maybeSingle();

    if (!ownerProfile?.email) return;

    const { data: clientData } = await supabase
      .from("clients")
      .select("company_name")
      .eq("id", clientId)
      .maybeSingle();

    await supabase.functions.invoke("send-branded-email", {
      body: {
        template_name: "sync_failed",
        recipient_email: ownerProfile.email,
        org_id: orgId,
        data: {
          platform,
          client_name: clientData?.company_name ?? "Unknown client",
          error_message: errorMsg,
          month,
          year,
        },
      },
    });
  } catch (emailErr) {
    console.error("Failed to send sync_failed email:", emailErr);
  }
}

Deno.serve(async (req) => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "scheduled-sync", method: req.method, connection_id: null }));
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
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

    // First 7 days: also sync previous month for late-reporting data
    if (dayOfMonth <= 7) {
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      monthsToSync.push({ month: prevMonth, year: prevYear });
    }

    // Fetch all active connections
    const { data: connections, error: connError } = await supabase
      .from("platform_connections")
      .select("id, platform, client_id, clients!inner(org_id)")
      .eq("is_connected", true)
      .not("account_id", "is", null);

    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active connections to sync", synced: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Build org plan map for schedule gating
    const orgIds = [...new Set(connections.map((c) => {
      const clientData = (c as Record<string, unknown>).clients as { org_id: string };
      return clientData.org_id;
    }))];
    const { data: subscriptions, error: subError } = await supabase
      .from("org_subscriptions")
      .select("org_id, subscription_plans!inner(slug)")
      .in("org_id", orgIds)
      .eq("status", "active");

    if (subError) throw subError;

    const orgPlanMap: Record<string, string> = {};
    for (const sub of subscriptions || []) {
      const subData = sub as Record<string, unknown>;
      orgPlanMap[subData.org_id as string] = ((subData.subscription_plans as { slug: string }).slug);
    }

    // Filter connections by plan schedule
    const eligibleTasks: Array<{
      conn: (typeof connections)[0];
      month: number;
      year: number;
    }> = [];

    let skippedCount = 0;

    for (const conn of connections) {
      const connClientData = (conn as Record<string, unknown>).clients as { org_id: string };
      const orgId = connClientData.org_id;
      const planSlug = orgPlanMap[orgId] || "creator";

      if (planSlug === "creator" && now.getDay() !== 1) {
        skippedCount++;
        continue;
      }
      if (planSlug === "freelance" && now.getDay() !== 1) {
        skippedCount++;
        continue;
      }

      const fnName = SYNC_FUNCTION_MAP[conn.platform];
      if (!fnName) continue;

      for (const { month, year } of monthsToSync) {
        eligibleTasks.push({ conn, month, year });
      }
    }

    // Process in parallel batches
    const results: SyncResult[] = [];

    for (let i = 0; i < eligibleTasks.length; i += BATCH_SIZE) {
      const batch = eligibleTasks.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async ({ conn, month, year }) => {
          const fnName = SYNC_FUNCTION_MAP[conn.platform];
          const { data, error } = await invokeWithTimeout(
            supabase,
            fnName,
            { connection_id: conn.id, month, year },
            SYNC_TIMEOUT_MS
          );

          if (error) throw new Error(error.message || "Unknown error");
          if (data?.error) throw new Error(data.error);

          return { connection_id: conn.id, platform: conn.platform, month, year, success: true } as SyncResult;
        })
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const task = batch[j];

        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          const errorMsg = result.reason instanceof Error ? result.reason.message : "Unknown error";

          // Cross-check sync_logs before treating as failure — the sync
          // function may have succeeded even if the invoke relay timed out.
          const { data: lastLog } = await supabase
            .from("sync_logs")
            .select("status")
            .eq("client_id", task.conn.client_id)
            .eq("platform", task.conn.platform)
            .eq("report_month", task.month)
            .eq("report_year", task.year)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastLog?.status === "success" || lastLog?.status === "partial") {
            // Sync actually succeeded — record as success, skip failure email
            results.push({
              connection_id: task.conn.id,
              platform: task.conn.platform,
              month: task.month,
              year: task.year,
              success: true,
            });
          } else {
            results.push({
              connection_id: task.conn.id,
              platform: task.conn.platform,
              month: task.month,
              year: task.year,
              success: false,
              error: errorMsg,
            });

            // Fire-and-forget failure notification
            const taskClientData = (task.conn as Record<string, unknown>).clients as { org_id: string };
            const orgId = taskClientData.org_id;
            notifySyncFailure(supabase, orgId, task.conn.client_id, task.conn.platform, errorMsg, task.month, task.year);
          }
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    // --- Weekly gap detection (runs on Sundays) ---
    let backfillTriggered = 0;
    const MAX_BACKFILLS_PER_RUN = 50;
    const BACKFILL_BATCH_SIZE = 2;

    if (now.getDay() === 0) {
      // Build list of months to check (last 12)
      const checkMonths: Array<{ month: number; year: number }> = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(currentYear, currentMonth - 1 - i, 1);
        checkMonths.push({ month: d.getMonth() + 1, year: d.getFullYear() });
      }

      // For each active connection, check for missing snapshots
      const connectionsToBackfill: string[] = [];

      for (const conn of connections) {
        if (connectionsToBackfill.length >= MAX_BACKFILLS_PER_RUN) break;

        const fnName = SYNC_FUNCTION_MAP[conn.platform];
        if (!fnName) continue;

        const { data: snapshots } = await supabase
          .from("monthly_snapshots")
          .select("report_month, report_year")
          .eq("client_id", conn.client_id)
          .eq("platform", conn.platform);

        const existingSet = new Set(
          (snapshots || []).map((s: { report_month: number; report_year: number }) =>
            `${s.report_month}-${s.report_year}`
          )
        );

        const hasMissing = checkMonths.some(
          ({ month, year }) => !existingSet.has(`${month}-${year}`)
        );

        if (hasMissing) {
          connectionsToBackfill.push(conn.id);
        }
      }

      // Invoke backfill-sync in small batches
      for (let i = 0; i < connectionsToBackfill.length; i += BACKFILL_BATCH_SIZE) {
        const batch = connectionsToBackfill.slice(i, i + BACKFILL_BATCH_SIZE);
        await Promise.allSettled(
          batch.map((connId) =>
            supabase.functions.invoke("backfill-sync", {
              body: { connection_id: connId, months: 12 },
            })
          )
        );
        backfillTriggered += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Scheduled sync complete: ${successCount} succeeded, ${failCount} failed, ${skippedCount} skipped (plan schedule)${backfillTriggered > 0 ? `, ${backfillTriggered} backfills triggered` : ""}`,
        months_synced: monthsToSync,
        total_connections: connections.length,
        skipped_count: skippedCount,
        backfill_triggered: backfillTriggered,
        results,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Scheduled sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
