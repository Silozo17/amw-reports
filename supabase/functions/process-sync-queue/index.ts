import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
const MAX_JOBS_PER_INVOCATION = 25;

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let jobsProcessed = 0;

  try {
    // Reset stale processing jobs (stuck > 10 minutes)
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase
      .from("sync_jobs")
      .update({ status: "pending", started_at: null, error_message: "Reset: previous attempt timed out" })
      .eq("status", "processing")
      .lt("started_at", staleThreshold);

    // Process jobs sequentially
    while (jobsProcessed < MAX_JOBS_PER_INVOCATION) {
      // Claim the next pending job using service role (bypasses RLS)
      const { data: jobs, error: fetchErr } = await supabase
        .from("sync_jobs")
        .select("*")
        .eq("status", "pending")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1);

      if (fetchErr) {
        console.error("Failed to fetch jobs:", fetchErr);
        break;
      }

      if (!jobs || jobs.length === 0) {
        console.log("No pending jobs in queue");
        break;
      }

      const job = jobs[0];

      // Mark as processing
      const { error: claimErr } = await supabase
        .from("sync_jobs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("status", "pending"); // Optimistic lock

      if (claimErr) {
        console.error("Failed to claim job:", claimErr);
        break;
      }

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
        jobsProcessed++;
        continue;
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
        jobsProcessed++;
        continue;
      }

      // Determine months to sync: use target_months if provided, otherwise calculate from months count
      let monthsRange: Array<{ month: number; year: number }>;

      if (job.target_months && Array.isArray(job.target_months) && job.target_months.length > 0) {
        monthsRange = job.target_months as Array<{ month: number; year: number }>;
        // Apply platform cap
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

      // Filter out existing snapshots unless force_resync is enabled
      // Filter out existing snapshots ONLY for backfill jobs (priority 0 or large month ranges)
      // Daily/weekly jobs (1-2 target months) must always re-sync to get updated data
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

      // Update progress_total
      await supabase
        .from("sync_jobs")
        .update({ progress_total: totalToSync })
        .eq("id", job.id);

      let completed = 0;
      let lastError: string | null = null;
      let failCount = 0;

      for (const { month, year } of missingMonths) {
        // Update current month/year
        await supabase
          .from("sync_jobs")
          .update({
            current_month: month,
            current_year: year,
            progress_completed: completed,
          })
          .eq("id", job.id);

        try {
          const { data, error } = await supabase.functions.invoke(fnName, {
            body: { connection_id: job.connection_id, month, year },
          });

          if (error) {
            lastError = error.message;
            failCount++;
            console.error(
              `Failed ${job.platform} ${month}/${year}: ${error.message}`
            );
          } else if (data?.error) {
            lastError = data.error;
            failCount++;
            console.error(
              `Failed ${job.platform} ${month}/${year}: ${data.error}`
            );
          }
        } catch (e) {
          lastError =
            e instanceof Error ? e.message : "Unknown error";
          failCount++;
        }

        completed++;

        // Update progress
        await supabase
          .from("sync_jobs")
          .update({ progress_completed: completed })
          .eq("id", job.id);

        // Delay between months
        if (completed < totalToSync) {
          await sleep(DELAY_BETWEEN_MONTHS_MS);
        }
      }

      // Mark complete
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

      jobsProcessed++;
    }

    // Self-continuation: if there are still pending jobs, trigger another run
    const { data: remaining } = await supabase
      .from("sync_jobs")
      .select("id")
      .eq("status", "pending")
      .limit(1);

    if (remaining && remaining.length > 0) {
      console.log("More pending jobs remain — triggering continuation...");
      fetch(`${supabaseUrl}/functions/v1/process-sync-queue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
      }).catch((err) => console.warn("Self-continuation failed:", err));
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${jobsProcessed} job(s)`,
        jobs_processed: jobsProcessed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Process sync queue error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
