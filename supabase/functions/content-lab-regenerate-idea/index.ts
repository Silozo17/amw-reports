import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  ideaId: z.string().uuid(),
  shift: z.enum(["angle", "cluster", "hook"]),
});

const SHIFT_INSTRUCTIONS: Record<string, string> = {
  angle: "Keep the same TOPIC and target outcome, but take a completely different ANGLE — different framing, different entry point, different argument. Do not repeat the existing hook, structure or examples.",
  cluster: "JUMP to a fundamentally different topic cluster than the current idea. Use the source-post context to find an UNUSED viral angle from the pool. Different topic, different hook, different script. The only continuity is the brand voice.",
  hook: "KEEP the existing script body, CTA, visual direction and hashtags exactly as they are. Rewrite ONLY the opening hook and the 3 hook variants. Make them sharper, more pattern-interrupting, and more curiosity-driven than the originals.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-regenerate-idea", method: req.method }));

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
    const { ideaId, shift } = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch idea + run + niche to verify ownership and gather context
    const { data: idea, error: ideaErr } = await admin
      .from("content_lab_ideas")
      .select("*, content_lab_runs!inner(id, org_id, niche_id, client_id)")
      .eq("id", ideaId)
      .single();
    if (ideaErr || !idea) {
      return new Response(JSON.stringify({ error: "Idea not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const run = (idea as unknown as { content_lab_runs: { id: string; org_id: string; niche_id: string } }).content_lab_runs;
    const orgId = run.org_id;
    const runId = run.id;

    // Verify membership
    const { data: membership } = await admin
      .from("org_members")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cost gates
    const { assertPlatformNotFrozen, assertOrgWithinBudget, recordCost, estimateAnthropic, BudgetExceededError, PlatformFrozenError } = await import("../_shared/costGuard.ts");
    try {
      await assertPlatformNotFrozen();
      await assertOrgWithinBudget(orgId);
    } catch (e) {
      if (e instanceof PlatformFrozenError) return new Response(JSON.stringify({ error: e.message }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (e instanceof BudgetExceededError) return new Response(JSON.stringify({ error: e.message, scope: e.scope }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw e;
    }
    await recordCost({ orgId, service: "anthropic", operation: "regenerate_idea", pence: estimateAnthropic("haiku", 2000, 1500), runId });

    // Spend 1 credit atomically
    const { data: ledgerId, error: spendErr } = await admin.rpc("spend_content_lab_credit", {
      _org_id: orgId,
      _amount: 1,
      _reason: "idea_regenerate",
      _run_id: runId,
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
      // Fetch niche brief + source post for context
      const { data: niche } = await admin
        .from("content_lab_niches")
        .select("label, brand_brief, tone_of_voice, do_not_use, video_length_preference")
        .eq("id", run.niche_id)
        .maybeSingle();

      let sourcePost: { caption: string | null; hook_text: string | null; transcript: string | null; author_handle: string } | null = null;
      if (idea.based_on_post_id) {
        const { data: sp } = await admin
          .from("content_lab_posts")
          .select("caption, hook_text, transcript, author_handle")
          .eq("id", idea.based_on_post_id)
          .maybeSingle();
        sourcePost = sp ?? null;
      }

      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

      const systemPrompt = `You are a senior short-form video strategist regenerating ONE content idea for a brand.

Niche: ${niche?.label ?? "unknown"}
Tone of voice: ${niche?.tone_of_voice ?? "not specified"}
Do NOT use: ${(niche?.do_not_use ?? []).join(", ") || "n/a"}
Preferred length: ${niche?.video_length_preference ?? "30-60s"}

REGENERATION SHIFT: ${shift.toUpperCase()}
${SHIFT_INSTRUCTIONS[shift]}

Return ONLY valid JSON, no markdown fences. Schema:
{
  "title": string,
  "hook": string,
  "hook_variants": [{"text": string, "mechanism": string, "why": string}, {"text": string, "mechanism": string, "why": string}, {"text": string, "mechanism": string, "why": string}],
  "body": string,
  "cta": string,
  "script_full": string,
  "caption": string,
  "caption_with_hashtag": string,
  "hashtags": string[],
  "visual_direction": string,
  "why_it_works": string,
  "duration_seconds": number,
  "platform_style_notes": string
}`;

      const userPrompt = `EXISTING IDEA (to ${shift === "hook" ? "preserve except hook" : "replace"}):
Title: ${idea.title}
Hook: ${idea.hook ?? ""}
Body: ${idea.body ?? ""}
CTA: ${idea.cta ?? ""}
Script: ${idea.script_full ?? ""}
Why it works: ${idea.why_it_works ?? ""}

${sourcePost ? `SOURCE POST CONTEXT:
@${sourcePost.author_handle}
Hook: ${sourcePost.hook_text ?? ""}
Caption: ${sourcePost.caption ?? ""}
Transcript: ${(sourcePost.transcript ?? "").slice(0, 1500)}` : ""}

Regenerate the idea now per the shift instruction. JSON only.`;

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 3000,
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
      const newIdea = JSON.parse(jsonMatch[0]);

      // For "hook" shift, only update hook fields; otherwise full update
      const updatePayload: Record<string, unknown> = {
        regen_count: (idea.regen_count ?? 0) + 1,
        last_modified_via: "regenerate",
      };

      if (shift === "hook") {
        updatePayload.hook = newIdea.hook ?? idea.hook;
        updatePayload.hook_variants = newIdea.hook_variants ?? idea.hook_variants;
      } else {
        Object.assign(updatePayload, {
          title: newIdea.title ?? idea.title,
          hook: newIdea.hook ?? idea.hook,
          hook_variants: newIdea.hook_variants ?? idea.hook_variants,
          body: newIdea.body ?? idea.body,
          cta: newIdea.cta ?? idea.cta,
          script_full: newIdea.script_full ?? idea.script_full,
          caption: newIdea.caption ?? idea.caption,
          caption_with_hashtag: newIdea.caption_with_hashtag ?? idea.caption_with_hashtag,
          hashtags: newIdea.hashtags ?? idea.hashtags,
          visual_direction: newIdea.visual_direction ?? idea.visual_direction,
          why_it_works: newIdea.why_it_works ?? idea.why_it_works,
          duration_seconds: newIdea.duration_seconds ?? idea.duration_seconds,
          platform_style_notes: newIdea.platform_style_notes ?? idea.platform_style_notes,
        });
      }

      const { error: updErr } = await admin.from("content_lab_ideas").update(updatePayload).eq("id", ideaId);
      if (updErr) throw updErr;

      console.log(JSON.stringify({ fn: "content-lab-regenerate-idea", status: "ok", ideaId, shift, orgId }));

      return new Response(JSON.stringify({ ok: true, ideaId, shift }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (innerErr) {
      // Refund on any failure after credit was spent. Retried + audit-logged
      // so a DB blip can't silently consume a user's credit.
      console.error("[content-lab-regenerate-idea] failed, refunding:", innerErr);
      const { refundCreditWithRetry } = await import("../_shared/contentLabCreditRefund.ts");
      await refundCreditWithRetry({
        admin,
        ledgerId,
        refundReason: "idea_regenerate_refund",
        runId: typeof runId === "string" ? runId : null,
        caller: "content-lab-regenerate-idea",
      });
      return new Response(
        JSON.stringify({ error: innerErr instanceof Error ? innerErr.message : "Regeneration failed", refunded: true }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("[content-lab-regenerate-idea] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
