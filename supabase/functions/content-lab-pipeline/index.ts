// content-lab-pipeline: thin DISPATCHER. Creates a run row (or accepts run_id),
// performs pre-flight gates, then hands the run off to content-lab-step-runner
// which advances the state machine one step at a time. This replaces the previous
// monolithic background task that exceeded the ~400s edge runtime ceiling and left
// runs stuck in `ideating` even when ideation succeeded.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RUN_LIMITS_BY_TIER: Record<string, number> = {
  creator: 1,
  studio: 3,
  agency: 10,
};
const DEFAULT_RUN_LIMIT = 1;
const STALE_RUN_MINUTES = 10;

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

    if (!runId) {
      if (!niche_id) return json({ error: "niche_id or run_id is required" }, 400);
      const { data: niche, error: nErr } = await admin
        .from("content_lab_niches").select("id, client_id, org_id").eq("id", niche_id).single();
      if (nErr || !niche) return json({ error: "Niche not found" }, 404);

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

    return json({ ok: true, run_id: runId }, 202);
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
  await admin
    .from("content_lab_runs")
    .update({
      status: "failed",
      error_message: `Run timed out (>${STALE_RUN_MINUTES}min in active state). Auto-failed by orchestrator.`,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("status", ["pending", "scraping", "analysing", "ideating"])
    .lt("updated_at", cutoff);
}
