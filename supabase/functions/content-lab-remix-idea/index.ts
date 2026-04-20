import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  ideaId: z.string().uuid(),
  remixType: z.enum(["shorter", "punchier", "emotional", "b2b", "platform"]),
  targetPlatform: z.enum(["instagram", "tiktok", "facebook", "youtube", "linkedin"]).optional(),
});

const REMIX_INSTRUCTIONS: Record<string, string> = {
  shorter: "Cut the script to roughly half its current duration. Tighten ruthlessly. Keep the hook and the payoff. Drop everything else.",
  punchier: "Tighten the language. Kill softeners ('I think', 'kind of', 'maybe', 'you know'). Use shorter sentences. Replace abstract verbs with concrete ones.",
  emotional: "Inject stakes, consequence, and feeling. Show what's at risk. Make the viewer feel something — frustration, hope, urgency, relief.",
  b2b: "Rewrite in a professional, authoritative voice. Drop slang and casual filler. Lead with insight, back with proof, end with a clear next step.",
  platform: "Rewrite the script in the native style of the target platform — pacing, opening style, length, visual cues all adjusted for that platform's algorithm and audience.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-remix-idea", method: req.method }));

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
    const { ideaId, remixType, targetPlatform } = parsed.data;

    if (remixType === "platform" && !targetPlatform) {
      return new Response(JSON.stringify({ error: "targetPlatform required for platform remix" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: idea, error: ideaErr } = await admin
      .from("content_lab_ideas")
      .select("*, content_lab_runs!inner(id, org_id, niche_id)")
      .eq("id", ideaId)
      .single();
    if (ideaErr || !idea) {
      return new Response(JSON.stringify({ error: "Idea not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const run = (idea as unknown as { content_lab_runs: { id: string; org_id: string; niche_id: string } }).content_lab_runs;
    const orgId = run.org_id;

    const { data: membership } = await admin
      .from("org_members")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { assertPlatformNotFrozen, assertOrgWithinBudget, recordCost, estimateAnthropic, BudgetExceededError, PlatformFrozenError } = await import("../_shared/costGuard.ts");
    try {
      await assertPlatformNotFrozen();
      await assertOrgWithinBudget(orgId);
    } catch (e) {
      if (e instanceof PlatformFrozenError) return new Response(JSON.stringify({ error: e.message }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (e instanceof BudgetExceededError) return new Response(JSON.stringify({ error: e.message, scope: e.scope }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw e;
    }
    await recordCost({ orgId, service: "anthropic", operation: "remix_idea", pence: estimateAnthropic("haiku", 2000, 1500), runId: run.id });

    const { data: ledgerId, error: spendErr } = await admin.rpc("spend_content_lab_credit", {
      _org_id: orgId,
      _amount: 1,
      _reason: `idea_remix_${remixType}`,
      _run_id: run.id,
    });

    if (spendErr) {
      const msg = String(spendErr.message ?? spendErr);
      if (msg.includes("INSUFFICIENT_CREDITS")) {
        const { data: bal } = await admin.from("content_lab_credits").select("balance").eq("org_id", orgId).maybeSingle();
        return new Response(
          JSON.stringify({ error: "Insufficient credits", needsCredits: true, currentBalance: bal?.balance ?? 0 }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw spendErr;
    }

    try {
      const { data: niche } = await admin
        .from("content_lab_niches")
        .select("label, tone_of_voice")
        .eq("id", run.niche_id)
        .maybeSingle();

      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

      const platformLine = remixType === "platform" ? `Target platform: ${targetPlatform}` : "";

      const systemPrompt = `You are remixing a single short-form video script for the ${niche?.label ?? "brand"} niche.

REMIX: ${remixType.toUpperCase()}
${REMIX_INSTRUCTIONS[remixType]}
${platformLine}

Return ONLY valid JSON, no markdown fences. Schema:
{ "script_full": string, "duration_seconds": number }`;

      const userPrompt = `Current title: ${idea.title}
Current hook: ${idea.hook ?? ""}
Current script:
${idea.script_full ?? idea.body ?? ""}

Current duration: ${idea.duration_seconds ?? "unknown"}s

Remix the script now per the instruction. JSON only.`;

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        throw new Error(`Claude error ${claudeRes.status}: ${errText.slice(0, 300)}`);
      }

      const claudeData = await claudeRes.json();
      const text: string = claudeData?.content?.[0]?.text ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in Claude response");
      const remixed = JSON.parse(jsonMatch[0]);

      const updatePayload: Record<string, unknown> = {
        script_full: remixed.script_full ?? idea.script_full,
        duration_seconds: remixed.duration_seconds ?? idea.duration_seconds,
        remix_count: (idea.remix_count ?? 0) + 1,
        last_modified_via: `remix_${remixType}`,
      };

      if (remixType === "platform" && targetPlatform) {
        updatePayload.target_platform = targetPlatform;
      }

      const { error: updErr } = await admin.from("content_lab_ideas").update(updatePayload).eq("id", ideaId);
      if (updErr) throw updErr;

      console.log(JSON.stringify({ fn: "content-lab-remix-idea", status: "ok", ideaId, remixType, orgId }));

      return new Response(JSON.stringify({ ok: true, ideaId, remixType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (innerErr) {
      console.error("[content-lab-remix-idea] failed, refunding:", innerErr);
      const { refundCreditWithRetry } = await import("../_shared/contentLabCreditRefund.ts");
      await refundCreditWithRetry({
        admin,
        ledgerId,
        refundReason: `idea_remix_${remixType}_refund`,
        runId: null,
        caller: "content-lab-remix-idea",
      });
      return new Response(
        JSON.stringify({ error: innerErr instanceof Error ? innerErr.message : "Remix failed", refunded: true }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("[content-lab-remix-idea] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
