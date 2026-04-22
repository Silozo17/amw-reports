// content-lab-pipeline: thin DISPATCHER. Creates a run row (or accepts run_id),
// performs pre-flight gates, then hands the run off to content-lab-step-runner
// which advances the state machine one step at a time. This replaces the previous
// monolithic background task that exceeded the ~400s edge runtime ceiling and left
// runs stuck in `ideating` even when ideation succeeded.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { runLimitForTier } from "../_shared/contentLabTiers.ts";
import { assertPlatformNotFrozen, assertOrgWithinBudget, BudgetExceededError, PlatformFrozenError } from "../_shared/costGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STALE_RUN_MINUTES = 20;
const MAX_AUTO_RESUME_ATTEMPTS = 3;

interface OrgEntitlement {
  tier: string | null;
  status: string | null;
  gracePeriodEnd: string | null;
  monthlyLimit: number;
}

async function getOrgEntitlement(admin: ReturnType<typeof createClient>, orgId: string): Promise<OrgEntitlement> {
  const { data } = await admin
    .from("org_subscriptions")
    .select("content_lab_tier, status, grace_period_end")
    .eq("org_id", orgId)
    .maybeSingle();
  const tier = (data as { content_lab_tier?: string | null } | null)?.content_lab_tier ?? null;
  const status = (data as { status?: string | null } | null)?.status ?? null;
  const gracePeriodEnd = (data as { grace_period_end?: string | null } | null)?.grace_period_end ?? null;
  return { tier, status, gracePeriodEnd, monthlyLimit: runLimitForTier(tier) };
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

async function getCreditBalance(admin: ReturnType<typeof createClient>, orgId: string): Promise<number> {
  const { data } = await admin
    .from("content_lab_credits")
    .select("balance")
    .eq("org_id", orgId)
    .maybeSingle();
  return (data as { balance?: number } | null)?.balance ?? 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-pipeline", method: req.method }));

  try {
    const body = await req.json().catch(() => ({}));
    const { niche_id, run_id: existingRunId, email_on_complete } = body as {
      niche_id?: string; run_id?: string; email_on_complete?: boolean;
    };

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Defensive sweep: any active run older than STALE_RUN_MINUTES → force-fail.
    await reapStaleRuns(admin);

    let runId = existingRunId;
    let orgIdForUsage: string | null = null;

    // Idempotency-Key replay protection (24h cache)
    const idemKey = req.headers.get("Idempotency-Key");
    if (idemKey) {
      const { data: cached } = await admin
        .from("request_idempotency").select("response_status, response_body")
        .eq("key", idemKey).maybeSingle();
      if (cached) {
        return new Response(JSON.stringify(cached.response_body), {
          status: cached.response_status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!runId) {
      if (!niche_id) return json({ error: "niche_id or run_id is required" }, 400);
      const { data: niche, error: nErr } = await admin
        .from("content_lab_niches").select("id, client_id, org_id").eq("id", niche_id).single();
      if (nErr || !niche) return json({ error: "Niche not found" }, 404);

      const orgIdNew = (niche as { org_id: string }).org_id;

      // Cost gates: platform freeze + per-org daily/monthly budget
      try {
        await assertPlatformNotFrozen();
        await assertOrgWithinBudget(orgIdNew);
      } catch (e) {
        if (e instanceof PlatformFrozenError) return json({ error: e.message, platform_frozen: true }, 503);
        if (e instanceof BudgetExceededError) return json({ error: e.message, budget_exceeded: true, scope: e.scope }, 402);
        throw e;
      }

      // Concurrent-run lock: one in-flight run per (org, niche)
      const { count: activeCount } = await admin
        .from("content_lab_runs").select("id", { count: "exact", head: true })
        .eq("org_id", orgIdNew).eq("niche_id", niche_id)
        .in("status", ["pending", "scraping", "analysing", "ideating"]);
      if ((activeCount ?? 0) > 0) {
        const { data: inProgress } = await admin
          .from("content_lab_runs").select("id").eq("org_id", orgIdNew).eq("niche_id", niche_id)
          .in("status", ["pending", "scraping", "analysing", "ideating"]).limit(1).maybeSingle();
        return json({
          error: "A run is already in progress for this niche.",
          conflict: true,
          in_progress_run_id: inProgress?.id,
        }, 409);
      }

      const ent = await getOrgEntitlement(admin, orgIdNew);

      // Hard gate: must have an active Content Lab subscription. No tier = no run.
      // Past-grace cancellations / unpaid → block.
      if (!ent.tier) {
        return json({
          error: "Content Lab subscription required. Choose a plan to start generating runs.",
          subscription_required: true,
        }, 402);
      }
      const graceActive = ent.gracePeriodEnd && new Date(ent.gracePeriodEnd) > new Date();
      const isCancelled = ent.status === "cancelled" || ent.status === "canceled" || ent.status === "unpaid";
      const pastGrace = isCancelled && !graceActive;
      if (pastGrace) {
        return json({
          error: "Content Lab subscription is not active. Reactivate to continue generating runs.",
          subscription_inactive: true,
        }, 402);
      }

      const used = await getCurrentUsage(admin, orgIdNew);
      const credits = await getCreditBalance(admin, orgIdNew);
      // Monthly quota first; once exhausted, credits cover overflow runs (1 credit per run).
      // The step-runner already routes to consume_content_lab_credit when used >= limit.
      if (used >= ent.monthlyLimit && credits < 1) {
        return json({
          error: `Monthly run limit reached (${used}/${ent.monthlyLimit}) and no credits available. Top up to keep generating.`,
          limit_reached: true,
          runs_used: used,
          runs_limit: ent.monthlyLimit,
          credit_balance: credits,
        }, 429);
      }

      const { data: created, error: cErr } = await admin
        .from("content_lab_runs")
        .insert({
          niche_id: niche.id,
          client_id: (niche as { client_id: string }).client_id,
          org_id: orgIdNew,
          status: "pending",
          triggered_by: user.id,
          email_on_complete: email_on_complete !== false,
        })
        .select("id").single();
      if (cErr || !created) return json({ error: cErr?.message ?? "Could not create run" }, 500);
      runId = created.id;
      orgIdForUsage = orgIdNew;
    } else {
      const { data: existing } = await admin
        .from("content_lab_runs").select("org_id").eq("id", runId).single();
      orgIdForUsage = (existing as { org_id?: string } | null)?.org_id ?? null;
      if (typeof email_on_complete === "boolean") {
        await admin.from("content_lab_runs")
          .update({ email_on_complete, updated_at: new Date().toISOString() })
          .eq("id", runId);
      }
    }

    // Hand off to the state-machine step runner.
    await fetch(`${SUPABASE_URL}/functions/v1/content-lab-step-runner`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ run_id: runId, mode: "fresh" }),
    }).catch((e) => console.error("step-runner kick failed:", e));

    const responseBody = { ok: true, run_id: runId };
    if (idemKey) {
      await admin.from("request_idempotency").upsert({
        key: idemKey, org_id: orgIdForUsage, endpoint: "content-lab-pipeline",
        response_status: 202, response_body: responseBody,
      }, { onConflict: "key" });
    }
    return json(responseBody, 202);
  } catch (e) {
    console.error("content-lab-pipeline error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function reapStaleRuns(admin: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - STALE_RUN_MINUTES * 60 * 1000).toISOString();
  const { data: stale } = await admin
    .from("content_lab_runs")
    .select("id, status, summary")
    .in("status", ["pending", "scraping", "analysing", "ideating"])
    .lt("updated_at", cutoff);

  for (const row of (stale ?? []) as Array<{ id: string; status: string; summary: Record<string, unknown> | null }>) {
    const summary = (row.summary ?? {}) as Record<string, unknown>;
    const attempts = Number(summary.auto_resume_attempts ?? 0);

    if (attempts < MAX_AUTO_RESUME_ATTEMPTS) {
      // Self-heal: re-dispatch to the step runner. The runner is idempotent because
      // it reads `status` and resumes from there. Charging is also idempotent via
      // summary.usage_consumed.
      await admin.from("content_lab_runs").update({
        summary: { ...summary, auto_resume_attempts: attempts + 1, last_auto_resume_at: new Date().toISOString() },
        error_message: null,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);

      // Resume mode if we already have scraped posts; fresh-step otherwise.
      const mode = row.status === "pending" || row.status === "scraping" ? "fresh" : "resume";
      fetch(`${SUPABASE_URL}/functions/v1/content-lab-step-runner`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: row.id, mode }),
      }).catch(() => { /* best-effort */ });
    } else {
      // Exhausted automatic recovery → terminal failure.
      await admin.from("content_lab_runs").update({
        status: "failed",
        error_message: `Auto-recovery exhausted after ${attempts} attempts. Use Retry ideation or contact support.`,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
    }
  }
}
