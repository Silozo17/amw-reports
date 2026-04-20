// content-lab-resume: re-runs analyse + ideate on an existing run that already has
// scraped posts. Skips Apify scrape entirely and does NOT increment monthly usage.
// Used when ideation failed (e.g. Anthropic outage / billing) and we want to retry
// without spending another scrape credit.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-resume", method: req.method }));

  try {
    const { run_id } = await req.json().catch(() => ({}));
    if (!run_id) return json({ error: "run_id is required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify run exists and load niche so we can preflight platforms.
    const { data: run } = await admin
      .from("content_lab_runs").select("id, org_id, status, niche_id").eq("id", run_id).single();
    if (!run) return json({ error: "Run not found" }, 404);

    const { data: niche } = await admin
      .from("content_lab_niches").select("platforms_to_scrape").eq("id", run.niche_id).single();
    const targetPlatforms: string[] = (niche?.platforms_to_scrape ?? ["instagram"]) as string[];

    // Group existing posts by platform.
    const { data: postRows } = await admin
      .from("content_lab_posts")
      .select("platform")
      .eq("run_id", run_id);
    if (!postRows || postRows.length === 0) {
      return json({ error: "Run has no posts to resume from — start a fresh run instead." }, 400);
    }
    const postCount = postRows.length;
    const availablePlatforms = new Set(postRows.map((p) => p.platform));
    const missingPlatforms = targetPlatforms.filter((p) => !availablePlatforms.has(p));
    if (missingPlatforms.length > 0) {
      return json({
        error: `Cannot resume: niche targets [${targetPlatforms.join(", ")}] but run only has posts for [${[...availablePlatforms].join(", ")}]. Missing: ${missingPlatforms.join(", ")}. Edit the niche or start a fresh run.`,
      }, 400);
    }

    // Fire and forget so the client returns immediately
    runResume(admin, run_id).catch((e) => console.error("Resume crashed:", e));

    return json({ ok: true, run_id, post_count: postCount, platforms: [...availablePlatforms] });
  } catch (e) {
    console.error("content-lab-resume error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function runResume(admin: ReturnType<typeof createClient>, runId: string) {
  const updateStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    await admin.from("content_lab_runs").update({
      status, updated_at: new Date().toISOString(), ...extra,
    }).eq("id", runId);
  };

  const fail = async (msg: string) => {
    console.error("Resume fail:", runId, msg);
    await updateStatus("failed", { error_message: msg, completed_at: new Date().toISOString() });
  };

  const pipelineLog = await logStepStart({ runId, step: "pipeline", message: "Resume started (skip scrape)" });

  try {
    // Reset to analysing — keep posts, clear stale ideas only
    await admin.from("content_lab_ideas").delete().eq("run_id", runId);
    await updateStatus("analysing", { error_message: null, completed_at: null });

    // ANALYSE (best-effort)
    const analyseStep = await logStepStart({ runId, step: "analyse", message: "Calling content-lab-analyse (resume)" });
    const analyseRes = await callFn("content-lab-analyse", { run_id: runId });
    if (!analyseRes.ok) {
      console.error(`Analyse step failed (non-fatal) for ${runId}:`, analyseRes.error);
      await analyseStep.finish({
        status: "failed", message: "Non-fatal — pipeline continued",
        errorMessage: analyseRes.error ?? "unknown",
      });
    } else {
      await analyseStep.finish({ status: "ok", message: "Analyse complete" });
    }

    // IDEATE (required)
    await updateStatus("ideating");
    const ideateStep = await logStepStart({ runId, step: "ideate", message: "Calling content-lab-ideate (resume)" });
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
      message: "Resume completed",
      payload: { idea_count: ideaCount ?? 0 },
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
    if (!res.ok) return { ok: false, error: `${res.status} ${text}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}
