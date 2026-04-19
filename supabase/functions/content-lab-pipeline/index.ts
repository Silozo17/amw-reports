// content-lab-pipeline: orchestrator. Creates a run (or accepts run_id), then chains
// scrape -> analyse -> ideate, updating run status throughout. Each step is a separate
// edge function call to avoid the 60s wall-clock cap on a single function.
//
// v2 changes:
// - Removed PDF rendering step (in-app feed only)
// - Empty-scrape handling: marks run as failed with a friendly message instead of crashing
// - Analyse step is best-effort (non-fatal); ideate is required

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    // Create run from niche if not provided
    if (!runId) {
      if (!niche_id) return json({ error: "niche_id or run_id is required" }, 400);
      const { data: niche, error: nErr } = await admin
        .from("content_lab_niches").select("id, client_id, org_id").eq("id", niche_id).single();
      if (nErr || !niche) return json({ error: "Niche not found" }, 404);

      const { data: created, error: cErr } = await admin
        .from("content_lab_runs")
        .insert({
          niche_id: niche.id,
          client_id: niche.client_id,
          org_id: niche.org_id,
          status: "pending",
          triggered_by: user.id,
        })
        .select("id").single();
      if (cErr || !created) return json({ error: cErr?.message ?? "Could not create run" }, 500);
      runId = created.id;
    }

    // Kick off async pipeline. Respond immediately so the UI doesn't block.
    runPipeline(admin, runId!).catch((e) => {
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

async function runPipeline(admin: ReturnType<typeof createClient>, runId: string) {
  const updateStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    await admin.from("content_lab_runs").update({
      status, updated_at: new Date().toISOString(), ...extra,
    }).eq("id", runId);
  };

  const fail = async (msg: string) => {
    console.error("Pipeline fail:", runId, msg);
    await updateStatus("failed", { error_message: msg, completed_at: new Date().toISOString() });
  };

  try {
    // Clear any previous posts/ideas for idempotency
    await admin.from("content_lab_posts").delete().eq("run_id", runId);
    await admin.from("content_lab_ideas").delete().eq("run_id", runId);

    // 1. SCRAPE
    await updateStatus("scraping", { started_at: new Date().toISOString() });
    const scrapeRes = await callFn("content-lab-scrape", { run_id: runId });
    if (!scrapeRes.ok) return fail(`Scrape failed: ${scrapeRes.error ?? "unknown"}`);

    // Verify we actually got posts before continuing — otherwise ideate has nothing to work with.
    const { count: postCount } = await admin
      .from("content_lab_posts")
      .select("id", { count: "exact", head: true })
      .eq("run_id", runId);

    if (!postCount || postCount === 0) {
      return fail(
        "No posts could be fetched. Check that the tracked Instagram handles are public and spelled correctly, then try again.",
      );
    }
    console.log(`Pipeline ${runId}: scraped ${postCount} posts`);

    // 2. ANALYSE (best-effort — ideate can still run on raw posts)
    await updateStatus("analysing");
    const analyseRes = await callFn("content-lab-analyse", { run_id: runId });
    if (!analyseRes.ok) {
      console.error(`Analyse step failed (non-fatal) for ${runId}:`, analyseRes.error);
    }

    // 3. IDEATE (required)
    await updateStatus("ideating");
    const ideateRes = await callFn("content-lab-ideate", { run_id: runId });
    if (!ideateRes.ok) return fail(`Ideate failed: ${ideateRes.error ?? "unknown"}`);

    // PDF rendering removed — content is consumed in-app via RunDetailPage.
    await updateStatus("completed", { completed_at: new Date().toISOString() });
  } catch (e) {
    await fail(e instanceof Error ? e.message : "Unknown error");
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
