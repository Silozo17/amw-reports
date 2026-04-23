// content-lab-step-runner: state-machine runner. Reads `status` on a run, executes
// exactly ONE step, writes the next status, then re-invokes itself for the next step.
// This avoids the ~400s background-task ceiling that previously left runs stuck in
// `ideating` even though all platform ideation calls succeeded.
//
// Flow:
//   pending     -> scrape   (then analysing)
//   scraping    -> scrape   (idempotent re-entry)
//   analysing   -> analyse  (then ideating)
//   ideating    -> ideate-one-platform
//                  - if more platforms remain, re-invoke (ideating)
//                  - else, complete + notify
//
// Each invocation returns 202 immediately and runs work in EdgeRuntime.waitUntil so
// no single function call ever exceeds the per-request budget.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logStepStart } from "../_shared/contentLabStepLog.ts";
import { runLimitForTier } from "../_shared/contentLabTiers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CHAIN_RETRY_DELAYS_MS = [250, 1000, 4000];
const MAX_PLATFORM_IDEATE_ATTEMPTS = 3;
const MAX_ANALYSE_ATTEMPTS = 2;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-step-runner", method: req.method }));

  try {
    const body = await req.json().catch(() => ({}));
    const { run_id, mode } = body as { run_id?: string; mode?: "fresh" | "resume" | "rescrape" };
    if (!run_id) return json({ error: "run_id is required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Schedule the actual step asynchronously. Returning 202 keeps the HTTP response fast.
    const task = runOneStep(admin, run_id, mode ?? "fresh").catch((e) => {
      console.error(`[step-runner] ${run_id} crashed:`, e);
    });
    // @ts-expect-error EdgeRuntime is provided by Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-expect-error see above
      EdgeRuntime.waitUntil(task);
    }

    return json({ ok: true, run_id }, 202);
  } catch (e) {
    console.error("content-lab-step-runner error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function runOneStep(
  admin: ReturnType<typeof createClient>,
  runId: string,
  mode: "fresh" | "resume" | "rescrape",
): Promise<void> {
  const { data: run, error } = await admin
    .from("content_lab_runs")
    .select("id, status, org_id, niche_id, summary")
    .eq("id", runId)
    .single();
  if (error || !run) {
    console.error(`[step-runner] run not found ${runId}`);
    return;
  }
  const status = (run as { status: string }).status;
  const orgId = (run as { org_id: string }).org_id;
  const summary = ((run as { summary?: Record<string, unknown> }).summary ?? {}) as Record<string, unknown>;

  // Terminal states — nothing to do
  if (status === "completed" || status === "failed") return;

  // Heartbeat: touch updated_at so the stale-run reaper doesn't false-positive
  // a slow LLM call as a stuck run.
  await admin.from("content_lab_runs")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", runId);

  // Cost circuit breakers — abort run if platform is frozen or this run has spent >£2
  try {
    const { assertPlatformNotFrozen, assertRunWithinKillSwitch, recordCost, estimateApify, estimateAnthropic } = await import("../_shared/costGuard.ts");
    await assertPlatformNotFrozen();
    await assertRunWithinKillSwitch(runId);
    // Record an estimated cost for the upcoming step (refunded conceptually if step fails, but we keep ledger append-only).
    if (status === "pending" || status === "scraping") {
      await recordCost({ orgId, service: "apify", operation: "scrape", pence: estimateApify("scrape"), runId });
    } else if (status === "analysing") {
      await recordCost({ orgId, service: "anthropic", operation: "analyse", pence: estimateAnthropic("sonnet", 8000, 3000), runId });
    } else if (status === "ideating") {
      await recordCost({ orgId, service: "anthropic", operation: "ideate", pence: estimateAnthropic("sonnet", 6000, 4000), runId });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "cost guard tripped";
    console.error(`[step-runner] ${runId} cost guard aborted: ${msg}`);
    await admin.from("content_lab_runs").update({
      status: "failed", error_message: msg, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", runId);
    return;
  }

  try {
    if (status === "pending" || status === "scraping") {
      await runScrapeStep(admin, runId, orgId, mode);
      return;
    }
    if (status === "analysing") {
      await runAnalyseStep(admin, runId);
      return;
    }
    if (status === "ideating") {
      await runOneIdeatePlatformStep(admin, runId, summary);
      return;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(`[step-runner] ${runId} ${status} step failed:`, msg);
    await failRun(admin, runId, msg);
  }
}

// ───────── helpers ─────────

async function setStatus(
  admin: ReturnType<typeof createClient>,
  runId: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  await admin.from("content_lab_runs").update({
    status, updated_at: new Date().toISOString(), ...extra,
  }).eq("id", runId);
}

async function failRun(admin: ReturnType<typeof createClient>, runId: string, message: string) {
  await admin.from("content_lab_runs").update({
    status: "failed",
    error_message: message,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", runId);
}

async function chainNext(runId: string, mode: "fresh" | "resume" | "rescrape") {
  // Retries with exponential backoff. The stale-run reaper still acts as a
  // final safety net if all retries fail.
  for (let attempt = 0; attempt < CHAIN_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/content-lab-step-runner`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ run_id: runId, mode }),
      });
      if (res.ok) return;
      console.error(`[step-runner] chainNext attempt ${attempt + 1} non-OK: ${res.status}`);
    } catch (e) {
      console.error(`[step-runner] chainNext attempt ${attempt + 1} failed for ${runId}:`, e);
    }
    if (attempt < CHAIN_RETRY_DELAYS_MS.length - 1) {
      await new Promise((r) => setTimeout(r, CHAIN_RETRY_DELAYS_MS[attempt]));
    }
  }
  // All in-process attempts failed: schedule a deferred re-dispatch via a fresh
  // background invocation. The stale-run reaper still acts as the ultimate safety net
  // but the run will keep self-healing instead of dying after one chain hop drop.
  console.error(`[step-runner] chainNext exhausted in-process retries for ${runId}, deferring`);
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    await admin.from("content_lab_runs").update({
      error_message: "Step chain dropped (network). Auto-recovery will retry shortly.",
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
    const handle = await logStepStart({ runId, step: "chain", message: "chainNext deferring re-dispatch" });
    await handle.finish({ status: "ok", message: "chainNext deferred — will be picked up by reaper resume" });
  } catch (e) {
    console.error(`[step-runner] chainNext breadcrumb write failed for ${runId}:`, e);
  }
  // Fire-and-forget one last detached call. If even this fails, the pipeline reaper
  // will resume the run on the next pipeline invocation.
  setTimeout(() => {
    fetch(`${SUPABASE_URL}/functions/v1/content-lab-step-runner`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId, mode }),
    }).catch(() => {});
  }, 8000);
}

async function callFn(name: string, body: unknown): Promise<{ ok: boolean; error?: string; payload?: unknown; timedOut?: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 140_000);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `${res.status} ${text.slice(0, 500)}` };
    let payload: unknown = null;
    try { payload = JSON.parse(text); } catch { /* non-JSON */ }
    return { ok: true, payload };
  } catch (e) {
    clearTimeout(timeout);
    const isTimeout = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      error: isTimeout ? "TIMEOUT_140S" : (e instanceof Error ? e.message : "fetch failed"),
      timedOut: isTimeout,
    };
  }
}

async function getMonthlyLimit(admin: ReturnType<typeof createClient>, orgId: string): Promise<number> {
  const { data } = await admin
    .from("org_subscriptions")
    .select("content_lab_tier")
    .eq("org_id", orgId)
    .maybeSingle();
  const tier = (data as { content_lab_tier?: string | null } | null)?.content_lab_tier ?? null;
  return runLimitForTier(tier);
}
async function getCurrentUsage(admin: ReturnType<typeof createClient>, orgId: string): Promise<number> {
  const now = new Date();
  const { data } = await admin
    .from("content_lab_usage")
    .select("runs_count")
    .eq("org_id", orgId)
    .eq("year", now.getUTCFullYear())
    .eq("month", now.getUTCMonth() + 1)
    .maybeSingle();
  return (data as { runs_count?: number } | null)?.runs_count ?? 0;
}

// ───────── steps ─────────

async function runScrapeStep(
  admin: ReturnType<typeof createClient>,
  runId: string,
  orgId: string,
  mode: "fresh" | "resume" | "rescrape",
) {
  // Resume mode reuses existing scrape — skip directly to analyse.
  if (mode === "resume") {
    await setStatus(admin, runId, "analysing", { error_message: null, completed_at: null });
    await chainNext(runId, mode);
    return;
  }

  // Pre-flight: niche must have at least one handle to scrape.
  const { data: runRow } = await admin
    .from("content_lab_runs")
    .select("niche:niche_id(own_handle, top_competitors, top_global_benchmarks, tracked_handles)")
    .eq("id", runId)
    .single();
  const niche = (runRow as { niche: {
    own_handle: string | null;
    top_competitors: Array<{ handle?: string }> | null;
    top_global_benchmarks: Array<{ handle?: string }> | null;
    tracked_handles: Array<{ handle?: string }> | null;
  } } | null)?.niche;
  const handleCount =
    (niche?.own_handle ? 1 : 0) +
    (niche?.top_competitors?.length ?? 0) +
    (niche?.top_global_benchmarks?.length ?? 0) +
    (niche?.tracked_handles?.length ?? 0);
  if (handleCount === 0) {
    await failRun(admin, runId, "Niche has no handles to scrape — re-run discovery from the niche form.");
    return;
  }

  // Clear previous posts/ideas only for fresh/rescrape.
  await admin.from("content_lab_posts").delete().eq("run_id", runId);
  await admin.from("content_lab_ideas").delete().eq("run_id", runId);

  await setStatus(admin, runId, "scraping", { started_at: new Date().toISOString() });
  const step = await logStepStart({ runId, step: "scrape", message: "Calling content-lab-scrape" });
  const res = await callFn("content-lab-scrape", { run_id: runId });

  const { count: postCount } = await admin
    .from("content_lab_posts")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId);

  if (!res.ok) {
    await step.finish({ status: "failed", errorMessage: res.error ?? "unknown" });
    await failRun(admin, runId, `Scrape failed: ${res.error ?? "unknown"}`);
    return;
  }

  await step.finish({
    status: "ok",
    message: `Scraped ${postCount ?? 0} posts`,
    payload: { post_count: postCount ?? 0 },
  });

  if (!postCount || postCount === 0) {
    await failRun(admin, runId,
      "No posts could be fetched. Check that the tracked handles are public and spelled correctly, then try again.");
    return;
  }

  // Charge usage now that scrape produced data. Idempotent per run via summary.usage_consumed
  // so a resume / rescrape / retry never double-charges.
  if (orgId) {
    const { data: runRowForCharge } = await admin
      .from("content_lab_runs").select("summary").eq("id", runId).maybeSingle();
    const summaryNow = ((runRowForCharge as { summary?: Record<string, unknown> } | null)?.summary ?? {}) as Record<string, unknown>;
    if (!summaryNow.usage_consumed) {
      const limit = await getMonthlyLimit(admin, orgId);
      const used = await getCurrentUsage(admin, orgId);
      let consumedVia: "monthly" | "credit" | "none" = "none";
      if (used < limit) {
        await admin.rpc("increment_content_lab_usage", { _org_id: orgId });
        consumedVia = "monthly";
      } else {
        const { data: ok } = await admin.rpc("consume_content_lab_credit", { _org_id: orgId, _run_id: runId, _amount: 1 });
        consumedVia = ok ? "credit" : "none";
      }
      await admin.from("content_lab_runs").update({
        summary: { ...summaryNow, usage_consumed: true, usage_consumed_via: consumedVia, usage_consumed_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }).eq("id", runId);
    }
  }

  await setStatus(admin, runId, "analysing");
  await chainNext(runId, mode);
}

async function runAnalyseStep(admin: ReturnType<typeof createClient>, runId: string) {
  const step = await logStepStart({ runId, step: "analyse", message: "Calling content-lab-analyse" });
  let lastErr: string | null = null;
  for (let attempt = 1; attempt <= MAX_ANALYSE_ATTEMPTS; attempt++) {
    const res = await callFn("content-lab-analyse", { run_id: runId });
    if (res.ok) {
      await step.finish({ status: "ok", message: `Analyse complete (attempt ${attempt})` });
      await setStatus(admin, runId, "ideating");
      await chainNext(runId, "fresh");
      return;
    }
    lastErr = res.error ?? "unknown";
    console.warn(`[step-runner] analyse attempt ${attempt}/${MAX_ANALYSE_ATTEMPTS} failed for ${runId}:`, lastErr);
    if (attempt < MAX_ANALYSE_ATTEMPTS) await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  // All retries failed → write deterministic fallback so ideate has structured input
  // instead of silently degraded output.
  const { data: runRow } = await admin
    .from("content_lab_runs").select("summary").eq("id", runId).maybeSingle();
  const sNow = ((runRow as { summary?: Record<string, unknown> } | null)?.summary ?? {}) as Record<string, unknown>;
  await admin.from("content_lab_runs").update({
    summary: {
      ...sNow,
      analyse_fallback: true,
      analyse_fallback_reason: lastErr,
      deep_analysis: sNow.deep_analysis ?? {},
    },
    updated_at: new Date().toISOString(),
  }).eq("id", runId);
  await step.finish({
    status: "failed",
    message: "Analyse retries exhausted — using deterministic fallback so pipeline can continue",
    errorMessage: lastErr ?? "unknown",
  });
  await setStatus(admin, runId, "ideating");
  await chainNext(runId, "fresh");
}

async function runOneIdeatePlatformStep(
  admin: ReturnType<typeof createClient>,
  runId: string,
  summary: Record<string, unknown>,
) {
  const { data: nicheRow } = await admin
    .from("content_lab_runs")
    .select("niche:niche_id(platforms_to_scrape)")
    .eq("id", runId)
    .single();
  const platforms: string[] =
    ((nicheRow as { niche: { platforms_to_scrape?: string[] } } | null)?.niche?.platforms_to_scrape) ?? ["instagram"];

  const ideatedDone = new Set<string>(
    Array.isArray(summary.ideated_platforms) ? (summary.ideated_platforms as string[]) : [],
  );
  const attemptCounts = (summary.ideate_attempts as Record<string, number> | undefined) ?? {};
  const next = platforms.find((p) => !ideatedDone.has(p));

  if (!next) {
    // All platforms processed → finalise (strict completion check inside).
    return finaliseRun(admin, runId, platforms);
  }

  const attemptNo = (attemptCounts[next] ?? 0) + 1;

  // Check if ideas already exist for this platform — a previous attempt may have
  // succeeded but the HTTP response timed out before step-runner received it.
  const { count: existingCount } = await admin
    .from("content_lab_ideas")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("target_platform", next);
  if (existingCount && existingCount > 0) {
    console.log(`[step-runner] ${next} already has ${existingCount} ideas — skipping ideation, marking done`);
    ideatedDone.add(next);
    await admin.from("content_lab_runs").update({
      summary: {
        ...summary,
        ideated_platforms: [...ideatedDone],
        ideate_attempts: { ...attemptCounts, [next]: attemptNo },
      },
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
    const skipStep = await logStepStart({
      runId,
      step: "ideate",
      message: `Detected existing ideas for ${next} — skipping`,
      payload: { platform: next, attempt: attemptNo },
    });
    await skipStep.finish({
      status: "ok",
      message: `${next} ideas already present (${existingCount}) — HTTP timeout was a false failure`,
      payload: { platform: next, idea_count: existingCount, recovered: true },
    });
    await chainNext(runId, "fresh");
    return;
  }

  const step = await logStepStart({
    runId,
    step: "ideate",
    message: `Calling content-lab-ideate (${next}, attempt ${attemptNo}/${MAX_PLATFORM_IDEATE_ATTEMPTS})`,
    payload: { platform: next, attempt: attemptNo },
  });
  const res = await callFn("content-lab-ideate", { run_id: runId, platform: next });
  const newAttemptCounts = { ...attemptCounts, [next]: attemptNo };

  // Don't retry a platform that has no posts — it will always fail
  const noPostsError = (res.error ?? "").includes("No benchmark") || (res.error ?? "").includes("no posts");
  if (noPostsError) {
    // Mark done and move on — cross-platform fallback in ideate will handle it next pass
    ideatedDone.add(next);
    await admin.from("content_lab_runs").update({
      summary: { ...summary, ideated_platforms: [...ideatedDone], ideate_attempts: newAttemptCounts },
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
    await step.finish({ status: "failed", errorMessage: res.error ?? "unknown" });
    await chainNext(runId, "fresh");
    return;
  }

  if (res.ok) {
    await step.finish({ status: "ok", message: `Ideate complete for ${next}`, payload: { platform: next } });
    ideatedDone.add(next);
    await admin.from("content_lab_runs").update({
      summary: { ...summary, ideated_platforms: [...ideatedDone], ideate_attempts: newAttemptCounts },
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
  } else if (attemptNo < MAX_PLATFORM_IDEATE_ATTEMPTS) {
    // Bounded internal retry — keep platform unmarked, just record the attempt and re-loop.
    await step.finish({
      status: "failed",
      message: `Will retry ${next} (attempt ${attemptNo}/${MAX_PLATFORM_IDEATE_ATTEMPTS})`,
      errorMessage: res.error ?? "unknown",
      payload: { platform: next, attempt: attemptNo },
    });
    console.warn(`[step-runner] ideate ${next} attempt ${attemptNo} failed for ${runId}, will retry:`, res.error);
    await admin.from("content_lab_runs").update({
      summary: { ...summary, ideate_attempts: newAttemptCounts },
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
    // Brief backoff before re-dispatching
    await new Promise((r) => setTimeout(r, 1500 * attemptNo));
  } else {
    // Bounded retries exhausted → record permanent failure for this platform and continue
    await step.finish({
      status: "failed",
      errorMessage: `${res.error ?? "unknown"} (after ${attemptNo} attempts)`,
      payload: { platform: next, attempt: attemptNo, exhausted: true },
    });
    console.error(`[step-runner] ideate ${next} exhausted ${attemptNo} attempts for ${runId}:`, res.error);
    ideatedDone.add(next);
    const failed = Array.isArray(summary.failed_ideate_platforms)
      ? new Set(summary.failed_ideate_platforms as string[]) : new Set<string>();
    failed.add(next);
    await admin.from("content_lab_runs").update({
      summary: {
        ...summary,
        ideated_platforms: [...ideatedDone],
        failed_ideate_platforms: [...failed],
        ideate_attempts: newAttemptCounts,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
  }

  await chainNext(runId, "fresh");
}

async function finaliseRun(admin: ReturnType<typeof createClient>, runId: string, expectedPlatforms: string[]) {
  const { data: ideas } = await admin
    .from("content_lab_ideas")
    .select("target_platform, is_wildcard")
    .eq("run_id", runId);

  const ideaCount = ideas?.length ?? 0;
  if (!ideaCount) {
    await failRun(admin, runId, "Ideation produced no ideas — see step logs for per-platform errors.");
    return;
  }

  // STRICT COMPLETION: verify every expected platform has at least one idea.
  const platformsWithIdeas = new Set(
    ((ideas ?? []) as Array<{ target_platform: string | null }>)
      .map((i) => i.target_platform)
      .filter(Boolean) as string[],
  );
  const missingPlatforms = expectedPlatforms.filter((p) => !platformsWithIdeas.has(p));
  if (missingPlatforms.length > 0) {
    console.warn(`[finalise] ${runId}: no ideas for ${missingPlatforms.join(', ')} — completing with partial results`);
    // Log partial completion in summary but do NOT fail the run
    const { data: runRowPartial } = await admin
      .from("content_lab_runs").select("summary").eq("id", runId).maybeSingle();
    const sPartial = ((runRowPartial as { summary?: Record<string, unknown> } | null)?.summary ?? {}) as Record<string, unknown>;
    await admin.from("content_lab_runs").update({
      summary: { ...sPartial, partial_platforms_missing: missingPlatforms },
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
  }
  // Continue to complete regardless

  // Build display_name + description for nicer UI labels.
  const { data: runRow } = await admin
    .from("content_lab_runs")
    .select("created_at, summary, clients!inner(company_name)")
    .eq("id", runId)
    .single();

  const summary = ((runRow as { summary?: Record<string, unknown> } | null)?.summary ?? {}) as Record<string, unknown>;
  const clientName = (runRow as { clients?: { company_name?: string } } | null)?.clients?.company_name ?? "Client";
  const created = new Date((runRow as { created_at?: string } | null)?.created_at ?? Date.now());
  const monthLabel = created.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const platforms = [...new Set(((ideas ?? []) as Array<{ target_platform: string | null }>).map((i) => i.target_platform).filter(Boolean) as string[])];
  const wildcardCount = ((ideas ?? []) as Array<{ is_wildcard?: boolean }>).filter((i) => i.is_wildcard).length;
  const platformPart = platforms.length ? ` across ${platforms.join(" + ")}` : "";
  const wildcardPart = wildcardCount > 0 ? `, ${wildcardCount} wildcard${wildcardCount === 1 ? "" : "s"}` : "";

  await admin.from("content_lab_runs").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    summary: {
      ...summary,
      display_name: `${clientName} · ${monthLabel}`,
      description: `${ideaCount} idea${ideaCount === 1 ? "" : "s"}${platformPart}${wildcardPart}`,
    },
  }).eq("id", runId);

  await logStepStart({ runId, step: "pipeline", message: "Pipeline completed" })
    .then((h) => h.finish({ status: "ok", message: `Run finalised with ${ideaCount} ideas`, payload: { idea_count: ideaCount, wildcard_count: wildcardCount } }));

  // Fire notification (best-effort; never blocks completion).
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/content-lab-notify-complete`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ run_id: runId }),
    });
  } catch (e) {
    console.error(`[step-runner] notify failed for ${runId}:`, e);
  }
}
