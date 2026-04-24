// content-lab-regenerate-idea: free AI re-write of one idea, rate-limited.
// Limits: 5 edits per idea per user per 24h; 50 edits per org per day.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const PER_IDEA_PER_USER_24H = 5;
const PER_ORG_PER_DAY = 50;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: "Invalid auth" }, 401);
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const ideaId = String(body?.idea_id ?? "").trim();
    const instruction = String(body?.instruction ?? "").trim().slice(0, 500);
    if (!ideaId || !instruction) return json({ error: "idea_id and instruction required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load idea + run + org
    const { data: idea, error: ideaErr } = await admin
      .from("content_lab_ideas")
      .select("*, content_lab_runs!inner(org_id, client_snapshot)")
      .eq("id", ideaId).maybeSingle();
    if (ideaErr || !idea) return json({ error: "Idea not found" }, 404);

    // deno-lint-ignore no-explicit-any
    const orgId = (idea as any).content_lab_runs?.org_id as string;
    // deno-lint-ignore no-explicit-any
    const snap = ((idea as any).content_lab_runs?.client_snapshot ?? {}) as Record<string, unknown>;

    // Membership check
    const { data: m } = await admin.from("org_members")
      .select("user_id").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
    if (!m) return json({ error: "Not a member of this org" }, 403);

    // Rate limit checks
    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const sinceDay = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const [{ count: perIdeaCount }, { count: perOrgCount }] = await Promise.all([
      admin.from("content_lab_idea_edits")
        .select("id", { count: "exact", head: true })
        .eq("idea_id", ideaId).eq("edited_by", userId).gte("created_at", since24h),
      admin.from("content_lab_idea_edits")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId).gte("created_at", sinceDay),
    ]);

    if ((perIdeaCount ?? 0) >= PER_IDEA_PER_USER_24H) {
      return json({ error: `Limit reached: ${PER_IDEA_PER_USER_24H} edits per idea per day` }, 429);
    }
    if ((perOrgCount ?? 0) >= PER_ORG_PER_DAY) {
      return json({ error: `Daily org limit reached: ${PER_ORG_PER_DAY} edits` }, 429);
    }

    // Call AI
    const before = {
      title: idea.title, hook: idea.hook, script: idea.script,
      caption: idea.caption, visual_direction: idea.visual_direction,
      cta: idea.cta, hashtags: idea.hashtags, best_fit_platform: idea.best_fit_platform,
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You refine social-media content ideas. Keep the brand voice (${snap.brand_voice ?? "natural"}). Return ONLY the revised idea via the tool call.` },
          { role: "user", content: `Industry: ${snap.industry ?? "?"}, Audience: ${snap.target_audience ?? "?"}.

Current idea:
${JSON.stringify(before, null, 2)}

User instruction: ${instruction}

Rewrite the idea applying the instruction. Keep best_fit_platform unless the instruction asks otherwise.` },
        ],
        max_tokens: 1500,
        tools: [{
          type: "function",
          function: {
            name: "submit_revision",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" }, hook: { type: "string" }, script: { type: "string" },
                caption: { type: "string" }, visual_direction: { type: "string" }, cta: { type: "string" },
                best_fit_platform: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
              },
              required: ["title", "hook", "script", "caption", "visual_direction", "cta", "best_fit_platform", "hashtags"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_revision" } },
      }),
    });
    if (aiRes.status === 429) return json({ error: "AI rate limit. Try again shortly." }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return json({ error: `AI error: ${t.slice(0, 200)}` }, 500);
    }
    const aiJson = await aiRes.json();
    const argsStr = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) return json({ error: "AI did not return a revision" }, 500);
    const after = JSON.parse(argsStr) as typeof before;

    const newVersion = (idea.current_version ?? 1) + 1;
    const { error: updErr } = await admin.from("content_lab_ideas").update({
      title: after.title, hook: after.hook, script: after.script,
      caption: after.caption, visual_direction: after.visual_direction, cta: after.cta,
      hashtags: after.hashtags ?? [], best_fit_platform: after.best_fit_platform,
      current_version: newVersion, edit_count: (idea.edit_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", ideaId);
    if (updErr) return json({ error: `Update failed: ${updErr.message}` }, 500);

    await admin.from("content_lab_idea_edits").insert({
      idea_id: ideaId, org_id: orgId, edited_by: userId,
      instruction, before_snapshot: before, after_snapshot: after, version: newVersion,
    });

    return json({ ok: true, idea: { id: ideaId, ...after, current_version: newVersion } });
  } catch (e) {
    console.error("[regenerate-idea]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
