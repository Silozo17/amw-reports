// content-lab-pipeline: orchestrator. Creates a run (or accepts run_id), then chains
// scrape -> analyse -> ideate, updating run status throughout. Each step is a separate
// edge function call to avoid the 60s wall-clock cap on a single function.
//
// v2 changes:
// - Removed PDF rendering step (in-app feed only)
// - Empty-scrape handling: marks run as failed with a friendly message instead of crashing
// - Analyse step is best-effort (non-fatal); ideate is required

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logStepStart } from "../_shared/contentLabStepLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Per-org monthly run ceilings. When the monthly allowance is exhausted, the org
// can keep running by spending credits (1 credit = 1 extra run). Top-ups are
// purchased separately.
const RUN_LIMITS_BY_TIER: Record<string, number> = {
  creator: 1,
  studio: 3,
  agency: 10,
};
const DEFAULT_RUN_LIMIT = 1;

async function getMonthlyLimit(admin: ReturnType<typeof createClient>, orgId: string): Promise<number> {
  const { data } = await admin
    .from("org_subscriptions")
    .select("content_lab_tier")
    .eq("org_id", orgId)
    .maybeSingle();
  const tier = (data as { content_lab_tier?: string | null } | null)?.content_lab_tier?.toLowerCase();
  return (tier && RUN_LIMITS_BY_TIER[tier]) ?? DEFAULT_RUN_LIMIT;
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
    const { niche_id, run_id: existingRunId } = body as { niche_id?: string; run_id?: string };

    // Verify caller — must be authenticated org member
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let runId = existingRunId;
    let orgIdForUsage: string | null = null;

    // Create run from niche if not provided
    if (!runId) {
      if (!niche_id) return json({ error: "niche_id or run_id is required" }, 400);
      const { data: niche, error: nErr } = await admin
        .from("content_lab_niches").select("id, client_id, org_id").eq("id", niche_id).single();
      if (nErr || !niche) return json({ error: "Niche not found" }, 404);

      // Pre-flight monthly usage cap. If exhausted, allow if credit balance > 0.
      const orgIdNew = (niche as { org_id: string }).org_id;
      const limit = await getMonthlyLimit(admin, orgIdNew);
      const used = await getCurrentUsage(admin, orgIdNew);
      const credits = await getCreditBalance(admin, orgIdNew);
      if (used >= limit && credits <= 0) {
        return json({
          error: `Monthly run limit reached (${used}/${limit}). Top up credits to keep running.`,
          limit_reached: true,
          runs_used: used,
          runs_limit: limit,
          credit_balance: credits,
        }, 429);
      }

      const { data: created, error: cErr } = await admin
        .from("content_lab_runs")
        .insert({
          niche_id: niche.id,
          client_id: (niche as { client_id: string }).client_id,
          org_id: (niche as { org_id: string }).org_id,
          status: "pending",
          triggered_by: user.id,
        })
        .select("id").single();
      if (cErr || !created) return json({ error: cErr?.message ?? "Could not create run" }, 500);
      runId = created.id;
      orgIdForUsage = (niche as { org_id: string }).org_id;
    } else {
      const { data: existing } = await admin
        .from("content_lab_runs").select("org_id").eq("id", runId).single();
      orgIdForUsage = (existing as { org_id?: string } | null)?.org_id ?? null;
    }

    // Kick off async pipeline. Respond immediately so the UI doesn't block.
    runPipeline(admin, runId!, orgIdForUsage).catch((e) => {
      console.error("Pipeline crashed:", e);
    });

    return json({ ok: true, run_id: runId });
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

async function runPipeline(admin: ReturnType<typeof createClient>, runId: string, orgId: string | null) {
  const updateStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    await admin.from("content_lab_runs").update({
      status, updated_at: new Date().toISOString(), ...extra,
    }).eq("id", runId);
  };

  const fail = async (msg: string) => {
    console.error("Pipeline fail:", runId, msg);
    await updateStatus("failed", { error_message: msg, completed_at: new Date().toISOString() });
  };

  const pipelineLog = await logStepStart({ runId, step: "pipeline", message: "Pipeline started" });

  try {
    // Clear any previous posts/ideas for idempotency
    await admin.from("content_lab_posts").delete().eq("run_id", runId);
    await admin.from("content_lab_ideas").delete().eq("run_id", runId);

    // Pre-flight: ensure the niche has at least one handle to scrape
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
      await pipelineLog.finish({ status: "failed", errorMessage: "No handles configured" });
      return fail("Niche has no handles to scrape — re-run discovery from the niche form.");
    }

    // 1. SCRAPE
    await updateStatus("scraping", { started_at: new Date().toISOString() });
    const scrapeStep = await logStepStart({ runId, step: "scrape", message: "Calling content-lab-scrape" });
    const scrapeRes = await callFn("content-lab-scrape", { run_id: runId });
    if (!scrapeRes.ok) {
      await scrapeStep.finish({ status: "failed", errorMessage: scrapeRes.error ?? "unknown" });
      await pipelineLog.finish({ status: "failed", errorMessage: `Scrape failed: ${scrapeRes.error ?? "unknown"}` });
      return fail(`Scrape failed: ${scrapeRes.error ?? "unknown"}`);
    }

    // Verify we actually got posts before continuing
    const { count: postCount } = await admin
      .from("content_lab_posts")
      .select("id", { count: "exact", head: true })
      .eq("run_id", runId);

    await scrapeStep.finish({
      status: "ok",
      message: `Scraped ${postCount ?? 0} posts`,
      payload: { post_count: postCount ?? 0 },
    });

    if (!postCount || postCount === 0) {
      await pipelineLog.finish({ status: "failed", errorMessage: "No posts scraped" });
      return fail(
        "No posts could be fetched. Check that the tracked Instagram handles are public and spelled correctly, then try again.",
      );
    }
    console.log(`Pipeline ${runId}: scraped ${postCount} posts`);

    // Charge usage only once we know the scrape produced data.
    if (orgId) {
      const { error: usageErr } = await admin.rpc("increment_content_lab_usage", { _org_id: orgId });
      if (usageErr) console.error("Usage increment failed:", usageErr);
    }

    // 2. ANALYSE (best-effort)
    await updateStatus("analysing");
    const analyseStep = await logStepStart({ runId, step: "analyse", message: "Calling content-lab-analyse" });
    const analyseRes = await callFn("content-lab-analyse", { run_id: runId });
    if (!analyseRes.ok) {
      console.error(`Analyse step failed (non-fatal) for ${runId}:`, analyseRes.error);
      await analyseStep.finish({
        status: "failed",
        message: "Non-fatal — pipeline continued",
        errorMessage: analyseRes.error ?? "unknown",
      });
    } else {
      await analyseStep.finish({ status: "ok", message: "Analyse complete" });
    }

    // 3. IDEATE (required)
    await updateStatus("ideating");
    const ideateStep = await logStepStart({ runId, step: "ideate", message: "Calling content-lab-ideate" });
    const ideateRes = await callFn("content-lab-ideate", { run_id: runId });
    if (!ideateRes.ok) {
      await ideateStep.finish({ status: "failed", errorMessage: ideateRes.error ?? "unknown" });
      await pipelineLog.finish({ status: "failed", errorMessage: `Ideate failed: ${ideateRes.error ?? "unknown"}` });
      return fail(`Ideate failed: ${ideateRes.error ?? "unknown"}`);
    }

    const { count: ideaCount } = await admin
      .from("content_lab_ideas")
      .select("id", { count: "exact", head: true })
      .eq("run_id", runId);
    await ideateStep.finish({
      status: "ok",
      message: `Generated ${ideaCount ?? 0} ideas`,
      payload: { idea_count: ideaCount ?? 0 },
    });

    await updateStatus("completed", { completed_at: new Date().toISOString() });
    await pipelineLog.finish({
      status: "ok",
      message: "Pipeline completed",
      payload: { post_count: postCount ?? 0, idea_count: ideaCount ?? 0 },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await pipelineLog.finish({ status: "failed", errorMessage: msg });
    await fail(msg);
  }
}

async function callFn(name: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: `${res.status} ${text}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}
