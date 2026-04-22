import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
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
  pinterest: "sync-pinterest",
  threads: "sync-threads",
};

const DELAY_BETWEEN_MONTHS_MS = 1_500;
const MAX_JOBS_PER_INVOCATION = 20;
const PARALLEL_BATCH_SIZE = 5;
const CLAIM_WINDOW_MS = 5_000;
// Reaped quickly because pg_cron also pokes us every minute.
const STALE_JOB_THRESHOLD_MS = 3 * 60 * 1000;
// Per platform-month watchdog — if a single sync invoke hangs longer than this,
// abort it, mark that month as failed-with-retry, and move on.
const MONTH_TIMEOUT_MS = 25_000;
// Total wall-clock budget for one queue invocation. If we approach the edge
// function's hard limit, hand the job back to `pending` cleanly so the next
// cron tick or self-continuation resumes it instead of dying mid-loop.
const INVOCATION_BUDGET_MS = 90_000;

const PLATFORM_MAX_MONTHS: Record<string, number> = {
  pinterest: 3,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMonthsRange(count: number): Array<{ month: number; year: number }> {
  const now = new Date();
  const result: Array<{ month: number; year: number }> = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }
  return result;
}

interface SyncJob {
  id: string;
  connection_id: string;
  client_id: string;
  org_id: string;
  platform: string;
  months: number;
  priority: number;
  force_resync: boolean;
  target_months: Array<{ month: number; year: number }> | null;
  progress_completed?: number;
}

// Race a promise against a timeout — used to bound a single sync invoke so a
// hung HTTP call cannot block the entire queue.
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function processJob(
  job: SyncJob,
  supabase: SupabaseClient,
  invocationStartedAt: number,
): Promise<{ handedBack: boolean }> {
  console.log(
    `Processing job ${job.id}: ${job.platform} for connection ${job.connection_id} (force_resync=${job.force_resync ?? false})`
  );

  // Verify connection is still active
  const { data: conn } = await supabase
    .from("platform_connections")
    .select("id, platform, client_id, is_connected, account_id")
    .eq("id", job.connection_id)
    .maybeSingle();

  if (!conn || !conn.is_connected || !conn.account_id) {
    await supabase
      .from("sync_jobs")
      .update({
        status: "failed",
        error_message: "Connection is no longer active",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { handedBack: false };
  }

  const fnName = SYNC_FUNCTION_MAP[job.platform];
  if (!fnName) {
    await supabase
      .from("sync_jobs")
      .update({
        status: "failed",
        error_message: `Unsupported platform: ${job.platform}`,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { handedBack: false };
  }

  // Determine months to sync: use target_months if provided, otherwise calculate from months count
  let monthsRange: Array<{ month: number; year: number }>;

  if (job.target_months && Array.isArray(job.target_months) && job.target_months.length > 0) {
    monthsRange = job.target_months;
    const maxMonths = PLATFORM_MAX_MONTHS[job.platform];
    if (maxMonths && monthsRange.length > maxMonths) {
      monthsRange = monthsRange.slice(0, maxMonths);
    }
  } else {
    const cappedMonths = Math.min(
      job.months,
      PLATFORM_MAX_MONTHS[job.platform] ?? job.months
    );
    monthsRange = getMonthsRange(cappedMonths);
  }

  // Filter out existing snapshots ONLY for backfill jobs (priority 0 or large month ranges).
  // This makes resuming a handed-back job cheap — completed months are skipped automatically.
  const isBackfillJob = job.priority === 0 || (!job.target_months && job.months > 2);
  let missingMonths = monthsRange;

  if (!job.force_resync && isBackfillJob) {
    const { data: existingSnapshots } = await supabase
      .from("monthly_snapshots")
      .select("report_month, report_year")
      .eq("client_id", conn.client_id)
      .eq("platform", job.platform);

    const existingSet = new Set(
      (existingSnapshots || []).map(
        (s: { report_month: number; report_year: number }) =>
          `${s.report_month}-${s.report_year}`
      )
    );

    missingMonths = monthsRange.filter(
      ({ month, year }) => !existingSet.has(`${month}-${year}`)
    );
  }

  const totalToSync = missingMonths.length;

  await supabase
    .from("sync_jobs")
    .update({ progress_total: totalToSync })
    .eq("id", job.id);

  let completed = 0;
  let lastError: string | null = null;
  let failCount = 0;

  for (const { month, year } of missingMonths) {
    // Budget guard — hand the job back to pending so the next invocation/cron
    // resumes it. progress_completed stays so the user sees no regression and
    // backfill skip-list keeps it cheap.
    if (Date.now() - invocationStartedAt > INVOCATION_BUDGET_MS) {
      console.log(
        `Job ${job.id}: invocation budget reached after ${completed}/${totalToSync} months — handing back to pending`
      );
      await supabase
        .from("sync_jobs")
        .update({
          status: "pending",
          started_at: null,
          progress_completed: completed,
          error_message: null,
        })
        .eq("id", job.id);
      return { handedBack: true };
    }

    await supabase
      .from("sync_jobs")
      .update({
        current_month: month,
        current_year: year,
        progress_completed: completed,
      })
      .eq("id", job.id);

    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke(fnName, {
          body: { connection_id: job.connection_id, month, year },
        }),
        MONTH_TIMEOUT_MS,
        `${job.platform} ${month}/${year}`
      );

      if (error) {
        lastError = error.message;
        failCount++;
        console.error(`Failed ${job.platform} ${month}/${year}: ${error.message}`);
      } else if (data?.error) {
        lastError = data.error;
        failCount++;
        console.error(`Failed ${job.platform} ${month}/${year}: ${data.error}`);
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Unknown error";
      failCount++;
      console.error(`Watchdog/error on ${job.platform} ${month}/${year}: ${lastError}`);
    }

    completed++;

    await supabase
      .from("sync_jobs")
      .update({ progress_completed: completed })
      .eq("id", job.id);

    if (completed < totalToSync) {
      await sleep(DELAY_BETWEEN_MONTHS_MS);
    }
  }

  const finalStatus = failCount === totalToSync && totalToSync > 0 ? "failed" : "completed";
  await supabase
    .from("sync_jobs")
    .update({
      status: finalStatus,
      progress_completed: completed,
      completed_at: new Date().toISOString(),
      error_message:
        failCount > 0
          ? `${failCount}/${totalToSync} months failed. Last error: ${lastError}`
          : null,
    })
    .eq("id", job.id);

  console.log(
    `Job ${job.id} ${finalStatus}: ${completed - failCount} synced, ${failCount} failed out of ${totalToSync}`
  );
  return { handedBack: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      fn: "process-sync-queue",
      method: req.method,
    })
  );

  const invocationStartedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Always self-continue at the end if pending jobs remain — even on errors.
  const triggerContinuation = () => {
    fetch(`${supabaseUrl}/functions/v1/process-sync-queue`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    }).catch((err) => console.warn("Self-continuation failed:", err));
  };

  try {
    // Reset stale processing jobs (now 3 min, paired with the 1-min cron).
    const staleThreshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS).toISOString();
    await supabase
      .from("sync_jobs")
      .update({
        status: "pending",
        started_at: null,
        error_message: "Reset: previous attempt timed out",
      })
      .eq("status", "processing")
      .lt("started_at", staleThreshold);

    // Fetch up to MAX_JOBS_PER_INVOCATION pending jobs
    const { data: candidateJobs, error: fetchErr } = await supabase
      .from("sync_jobs")
      .select("*")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(MAX_JOBS_PER_INVOCATION);

    if (fetchErr) {
      console.error("Failed to fetch jobs:", fetchErr);
      return new Response(
        JSON.stringify({ error: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!candidateJobs || candidateJobs.length === 0) {
      console.log("No pending jobs in queue");
      return new Response(
        JSON.stringify({ message: "No pending jobs", jobs_processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jobIds = candidateJobs.map((j) => j.id);
    const claimTimestamp = new Date().toISOString();
    const claimWindowStart = new Date(Date.now() - CLAIM_WINDOW_MS).toISOString();

    // Atomic bulk claim with status guard — only rows still 'pending' get flipped
    const { error: claimErr } = await supabase
      .from("sync_jobs")
      .update({ status: "processing", started_at: claimTimestamp })
      .in("id", jobIds)
      .eq("status", "pending");

    if (claimErr) {
      console.error("Failed to claim jobs:", claimErr);
      return new Response(
        JSON.stringify({ error: claimErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Re-fetch only the jobs we actually claimed (status=processing AND started_at within window)
    const { data: claimedJobs, error: confirmErr } = await supabase
      .from("sync_jobs")
      .select("*")
      .in("id", jobIds)
      .eq("status", "processing")
      .gte("started_at", claimWindowStart);

    if (confirmErr) {
      console.error("Failed to confirm claimed jobs:", confirmErr);
      return new Response(
        JSON.stringify({ error: confirmErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ourJobs = (claimedJobs ?? []) as SyncJob[];
    console.log(
      `Claimed ${ourJobs.length}/${candidateJobs.length} candidate jobs (others taken by concurrent invocation)`
    );

    // Process in parallel batches. If any job hands itself back, we still
    // continue — the budget guard will trip the rest as needed.
    let anyHandedBack = false;
    for (let i = 0; i < ourJobs.length; i += PARALLEL_BATCH_SIZE) {
      const batch = ourJobs.slice(i, i + PARALLEL_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((job) => processJob(job, supabase, invocationStartedAt))
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.handedBack) anyHandedBack = true;
      }
      // Stop launching new batches if we are over budget — they'd hand back immediately.
      if (Date.now() - invocationStartedAt > INVOCATION_BUDGET_MS) break;
    }

    // Self-continuation: if there are still pending jobs (or we handed any back),
    // trigger another invocation. The pg_cron schedule is the safety net if this fails.
    const { count } = await supabase
      .from("sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if ((count && count > 0) || anyHandedBack) {
      console.log(`${count ?? 0} pending jobs remain — triggering continuation...`);
      triggerContinuation();
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${ourJobs.length} job(s)`,
        jobs_processed: ourJobs.length,
        handed_back: anyHandedBack,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Process sync queue error:", e);
    // Always try to self-continue even on top-level errors so the queue
    // doesn't stall just because one invocation crashed.
    triggerContinuation();
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
