import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  nicheId: z.string().uuid(),
});

const REFRESH_COST_CREDITS = 1;
const RATE_LIMIT_WINDOW_DAYS = 30;
const RATE_LIMIT_MAX = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-manual-pool-refresh", method: req.method }));

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { nicheId } = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: niche, error: nicheErr } = await admin
      .from("content_lab_niches")
      .select("id, org_id, niche_tag, platforms_to_scrape")
      .eq("id", nicheId)
      .single();
    if (nicheErr || !niche) {
      return new Response(JSON.stringify({ error: "Niche not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const orgId = niche.org_id;

    const { data: membership } = await admin
      .from("org_members")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { assertPlatformNotFrozen, assertOrgWithinBudget, recordCost, estimateApify, BudgetExceededError, PlatformFrozenError } = await import("../_shared/costGuard.ts");
    try {
      await assertPlatformNotFrozen();
      await assertOrgWithinBudget(orgId);
    } catch (e) {
      if (e instanceof PlatformFrozenError) return new Response(JSON.stringify({ error: e.message }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (e instanceof BudgetExceededError) return new Response(JSON.stringify({ error: e.message, scope: e.scope }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw e;
    }
    await recordCost({ orgId, service: "apify", operation: "pool_refresh", pence: estimateApify("pool_refresh") });

    // Rate-limit check: max 5 manual refreshes per org per rolling 30 days
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await admin
      .from("content_lab_pool_refresh_jobs")
      .select("id", { count: "exact", head: true })
      .eq("triggered_by_org_id", orgId)
      .gte("created_at", windowStart);

    if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({ error: `Rate limit reached: max ${RATE_LIMIT_MAX} manual refreshes per ${RATE_LIMIT_WINDOW_DAYS} days`, rateLimited: true }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Always charge credits — single, simple model. Spec: 1 credit per manual refresh.
    let ledgerId: string | null = null;
    {
      const { data: spent, error: spendErr } = await admin.rpc("spend_content_lab_credit", {
        _org_id: orgId,
        _amount: REFRESH_COST_CREDITS,
        _reason: "manual_pool_refresh",
        _run_id: null,
      });

      if (spendErr) {
        const msg = String(spendErr.message ?? spendErr);
        if (msg.includes("INSUFFICIENT_CREDITS")) {
          const { data: bal } = await admin.from("content_lab_credits").select("balance").eq("org_id", orgId).maybeSingle();
          return new Response(
            JSON.stringify({
              error: "Insufficient credits",
              needsCredits: true,
              currentBalance: bal?.balance ?? 0,
              requiredCredits: REFRESH_COST_CREDITS,
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw spendErr;
      }
      ledgerId = spent as string;
    }

    // Create the job row first so we have an id to return
    const platform = (niche.platforms_to_scrape?.[0] as string) ?? "instagram";
    const nicheTag = niche.niche_tag ?? "unknown";

    const { data: job, error: jobErr } = await admin
      .from("content_lab_pool_refresh_jobs")
      .insert({
        triggered_by_org_id: orgId,
        niche_tag: nicheTag,
        platform,
        status: "pending",
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      // Refund credits if we charged
      if (ledgerId) {
        try {
          await admin.rpc("refund_content_lab_credit", {
            _ledger_id: ledgerId,
            _refund_reason: "manual_pool_refresh_refund_job_create_failed",
          });
        } catch (rErr) {
          console.error("[manual-pool-refresh] refund failed:", rErr);
        }
      }
      throw jobErr ?? new Error("Failed to create refresh job");
    }

    // Fire-and-forget the actual refresh worker
    admin.functions.invoke("content-lab-pool-refresh", {
      body: { jobId: job.id, nicheTag, platform, manual: true },
    }).catch((e) => console.error("[manual-pool-refresh] worker invoke failed:", e));

    console.log(JSON.stringify({
      fn: "content-lab-manual-pool-refresh",
      status: "queued",
      jobId: job.id,
      orgId,
      nicheTag,
      creditsCharged: REFRESH_COST_CREDITS,
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        jobId: job.id,
        creditsCharged: REFRESH_COST_CREDITS,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[content-lab-manual-pool-refresh] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
