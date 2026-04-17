import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Scheduled-sync: lightweight scheduler that enqueues sync_jobs
 * instead of invoking sync functions inline. Completes in <5s
 * regardless of connection count.
 *
 * Cron: 0 4,5 * * * (covers GMT & BST)
 * Gate: only proceeds when UK hour === 5
 *
 * Plan frequency:
 *   - Agency: daily at 5 AM UK
 *   - Creator / Freelancer: Mondays only at 5 AM UK
 *
 * Reconciliation: on the 7th of every month, enqueues force_resync
 * for the previous month to capture delayed platform reporting data.
 */

const SUPPORTED_PLATFORMS = new Set([
  "google_ads", "meta_ads", "facebook", "instagram", "tiktok",
  "tiktok_ads", "linkedin", "linkedin_ads", "google_search_console",
  "google_analytics", "google_business_profile", "youtube", "pinterest", "threads",
]);

const MAX_BACKFILLS_PER_RUN = 50;

/** Parse UK time components from a UTC Date */
function getUkTime(now: Date) {
  const ukStr = now.toLocaleString("en-GB", { timeZone: "Europe/London" });
  const [datePart, timePart] = ukStr.split(", ");
  const [day, month, year] = datePart.split("/").map(Number);
  const [hour] = timePart.split(":").map(Number);
  const ukDate = new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${timePart}`
  );
  return {
    ukHour: hour,
    ukDay: ukDate.getDay(), // 0=Sun … 6=Sat
    ukDayOfMonth: day,
    ukMonth: month,
    ukYear: year,
  };
}

/** Build target months array for a sync job */
function buildTargetMonths(
  uk: ReturnType<typeof getUkTime>,
  isReconciliation: boolean
): Array<{ month: number; year: number }> {
  const months: Array<{ month: number; year: number }> = [
    { month: uk.ukMonth, year: uk.ukYear },
  ];

  // First 7 days of month OR reconciliation day: also sync previous month
  if (uk.ukDayOfMonth <= 7 || isReconciliation) {
    const prevMonth = uk.ukMonth === 1 ? 12 : uk.ukMonth - 1;
    const prevYear = uk.ukMonth === 1 ? uk.ukYear - 1 : uk.ukYear;
    months.push({ month: prevMonth, year: prevYear });
  }

  return months;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  console.log(
    JSON.stringify({ ts: new Date().toISOString(), fn: "scheduled-sync", method: req.method })
  );

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const uk = getUkTime(now);

    // Gate: only proceed at 5 AM UK
    if (uk.ukHour !== 5) {
      return new Response(
        JSON.stringify({ message: `Skipped: UK hour is ${uk.ukHour}, not 5` }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const isReconciliationDay = uk.ukDayOfMonth === 7;
    const isMonday = uk.ukDay === 1;

    // Fetch all active connections with org info
    const { data: connections, error: connError } = await supabase
      .from("platform_connections")
      .select("id, platform, client_id, clients!inner(org_id)")
      .eq("is_connected", true)
      .not("account_id", "is", null);

    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active connections", enqueued: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Build org → plan map
    const orgIds = [
      ...new Set(
        connections.map((c) => ((c as Record<string, unknown>).clients as { org_id: string }).org_id)
      ),
    ];
    const { data: subscriptions } = await supabase
      .from("org_subscriptions")
      .select("org_id, subscription_plans!inner(slug)")
      .in("org_id", orgIds)
      .eq("status", "active");

    const orgPlanMap: Record<string, string> = {};
    for (const sub of subscriptions || []) {
      const s = sub as Record<string, unknown>;
      orgPlanMap[s.org_id as string] = (s.subscription_plans as { slug: string }).slug;
    }

    // Fetch existing pending/processing jobs to deduplicate
    const { data: existingJobs } = await supabase
      .from("sync_jobs")
      .select("connection_id, platform")
      .in("status", ["pending", "processing"]);

    const activeJobSet = new Set(
      (existingJobs || []).map(
        (j: { connection_id: string; platform: string }) => `${j.connection_id}:${j.platform}`
      )
    );

    // Build jobs to enqueue
    const jobsToInsert: Array<Record<string, unknown>> = [];
    let skippedPlan = 0;
    let skippedDuplicate = 0;

    for (const conn of connections) {
      if (!SUPPORTED_PLATFORMS.has(conn.platform)) continue;

      const orgId = ((conn as Record<string, unknown>).clients as { org_id: string }).org_id;
      const planSlug = orgPlanMap[orgId] || "creator";

      // Weekly plans: only sync on Mondays
      const isWeeklyPlan = planSlug === "creator" || planSlug === "freelance";
      if (isWeeklyPlan && !isMonday && !isReconciliationDay) {
        skippedPlan++;
        continue;
      }

      // Deduplicate
      const jobKey = `${conn.id}:${conn.platform}`;
      if (activeJobSet.has(jobKey)) {
        skippedDuplicate++;
        continue;
      }

      const targetMonths = buildTargetMonths(uk, isReconciliationDay);
      const forceResync = isReconciliationDay;

      jobsToInsert.push({
        connection_id: conn.id,
        client_id: conn.client_id,
        org_id: orgId,
        platform: conn.platform,
        months: targetMonths.length,
        priority: forceResync ? 5 : 1,
      });

      // Mark as in-flight for dedup within this loop
      activeJobSet.add(jobKey);
    }

    // Insert all jobs in one batch
    let enqueuedCount = 0;
    if (jobsToInsert.length > 0) {
      const { error: insertErr } = await supabase.from("sync_jobs").insert(jobsToInsert);
      if (insertErr) {
        console.error("Failed to insert sync jobs:", insertErr);
        throw insertErr;
      }
      enqueuedCount = jobsToInsert.length;
    }

    // --- Weekly gap detection (Sundays) ---
    let backfillTriggered = 0;

    if (uk.ukDay === 0) {
      const checkMonths: Array<{ month: number; year: number }> = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(uk.ukYear, uk.ukMonth - 1 - i, 1);
        checkMonths.push({ month: d.getMonth() + 1, year: d.getFullYear() });
      }

      const backfillJobs: Array<Record<string, unknown>> = [];

      for (const conn of connections) {
        if (backfillJobs.length >= MAX_BACKFILLS_PER_RUN) break;
        if (!SUPPORTED_PLATFORMS.has(conn.platform)) continue;

        const jobKey = `${conn.id}:${conn.platform}`;
        if (activeJobSet.has(jobKey)) continue;

        const { data: snapshots } = await supabase
          .from("monthly_snapshots")
          .select("report_month, report_year")
          .eq("client_id", conn.client_id)
          .eq("platform", conn.platform);

        const existingSet = new Set(
          (snapshots || []).map(
            (s: { report_month: number; report_year: number }) => `${s.report_month}-${s.report_year}`
          )
        );

        const hasMissing = checkMonths.some(
          ({ month, year }) => !existingSet.has(`${month}-${year}`)
        );

        if (hasMissing) {
          const orgId = ((conn as Record<string, unknown>).clients as { org_id: string }).org_id;
          backfillJobs.push({
            connection_id: conn.id,
            client_id: conn.client_id,
            org_id: orgId,
            platform: conn.platform,
            months: 12,
            priority: 0,
          });
          activeJobSet.add(jobKey);
        }
      }

      if (backfillJobs.length > 0) {
        await supabase.from("sync_jobs").insert(backfillJobs);
        backfillTriggered = backfillJobs.length;
      }
    }

    // Reset stale processing jobs (stuck > 10 minutes)
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase
      .from("sync_jobs")
      .update({ status: "pending", started_at: null, error_message: "Reset: previous attempt timed out" })
      .eq("status", "processing")
      .lt("started_at", staleThreshold);

    // Trigger the queue processor (fire-and-forget)
    if (enqueuedCount > 0 || backfillTriggered > 0) {
      supabase.functions.invoke("process-sync-queue").catch((err: unknown) => {
        console.warn("Failed to trigger process-sync-queue:", err);
      });
    }

    const summary = `Enqueued ${enqueuedCount} sync jobs, ${skippedPlan} skipped (plan), ${skippedDuplicate} skipped (duplicate)${backfillTriggered > 0 ? `, ${backfillTriggered} backfills` : ""}${isReconciliationDay ? " [RECONCILIATION DAY]" : ""}`;
    console.log(JSON.stringify({ fn: "scheduled-sync", summary }));

    return new Response(
      JSON.stringify({
        message: summary,
        enqueued: enqueuedCount,
        skipped_plan: skippedPlan,
        skipped_duplicate: skippedDuplicate,
        backfill_triggered: backfillTriggered,
        is_reconciliation: isReconciliationDay,
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
