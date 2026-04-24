// content-lab-ideate: 3 parallel calls × 10 ideas → 30 platform-agnostic ideas
// Service-role only. Called by content-lab-run.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const IDEA_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array", minItems: 8, maxItems: 12,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          hook: { type: "string", description: "Primary opening line / scroll-stopper" },
          hooks: {
            type: "array", minItems: 3, maxItems: 3,
            description: "Three distinct hook variations the user can choose between",
            items: { type: "string" },
          },
          script: { type: "string", description: "Brief outline or script body" },
          caption: { type: "string" },
          visual_direction: { type: "string" },
          cta: { type: "string" },
          best_fit_platform: { type: "string", enum: ["instagram", "tiktok", "facebook"] },
          why_it_works: { type: "string", description: "1–2 sentence credibility note that cites a specific viral or competitor pattern from the context above" },
          hashtags: { type: "array", items: { type: "string" } },
        },
        required: ["title", "hook", "hooks", "script", "caption", "visual_direction", "cta", "best_fit_platform", "why_it_works", "hashtags"],
      },
    },
  },
  required: ["ideas"],
};

interface IdeaPayload {
  title: string; hook: string; hooks?: string[]; script: string; caption: string;
  visual_direction: string; cta: string; best_fit_platform: string;
  why_it_works: string; hashtags: string[];
}

async function callIdeate(systemPrompt: string, userPrompt: string): Promise<IdeaPayload[]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 6000,
      tools: [{
        type: "function",
        function: { name: "submit_ideas", description: "Return 10 content ideas", parameters: IDEA_SCHEMA },
      }],
      tool_choice: { type: "function", function: { name: "submit_ideas" } },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Ideate AI ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("No tool_call args from ideate");
  const parsed = JSON.parse(args) as { ideas?: IdeaPayload[] };
  return parsed.ideas ?? [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const runId = String(body?.run_id ?? "").trim();
    if (!runId) return json({ error: "run_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load run + posts
    const { data: run, error: runErr } = await admin
      .from("content_lab_runs").select("id, client_snapshot, summary").eq("id", runId).maybeSingle();
    if (runErr || !run) return json({ error: "Run not found" }, 404);

    const { data: posts } = await admin
      .from("content_lab_posts")
      .select("bucket, platform, author_handle, caption, hook_type, hook_text, pattern_tag, engagement_rate, views")
      .eq("run_id", runId)
      .order("engagement_rate", { ascending: false })
      .limit(120);

    const snap = (run.client_snapshot ?? {}) as Record<string, unknown>;
    const ownPosts = (posts ?? []).filter((p) => p.bucket === "own").slice(0, 15);
    const competitorPosts = (posts ?? []).filter((p) => p.bucket === "competitor").slice(0, 20);
    const viralPosts = (posts ?? []).filter((p) => p.bucket === "viral").slice(0, 20);

    const fmt = (p: typeof ownPosts[number]) =>
      `(${p.platform}) @${p.author_handle} [${p.hook_type ?? "?"}/${p.pattern_tag ?? "?"}]: ${(p.caption ?? "").slice(0, 200).replace(/\n/g, " ")}`;

    const sharedContext = `CLIENT
Company: ${snap.company_name}
Industry: ${snap.industry ?? "unknown"}
Location: ${snap.location ?? "unknown"}
Audience: ${snap.target_audience ?? "unknown"}
Brand voice: ${snap.brand_voice ?? "unknown"}

THEIR RECENT CONTENT (what they've done)
${ownPosts.length ? ownPosts.map(fmt).join("\n") : "(none)"}

LOCAL COMPETITORS' RECENT CONTENT
${competitorPosts.length ? competitorPosts.map(fmt).join("\n") : "(none)"}

VIRAL WORLDWIDE CONTENT IN THIS NICHE
${viralPosts.length ? viralPosts.map(fmt).join("\n") : "(none)"}`;

    const systemBase = `You are a senior social-media strategist. You write content ideas that mix the client's existing voice with proven viral patterns from their niche. Each idea must be platform-agnostic but include a "best_fit_platform" recommendation. best_fit_platform MUST be exactly one of: instagram, tiktok, facebook (lowercase, no other values). Avoid generic advice — every idea should reference something specific from the client's industry, location, or audience.`;

    const promptForBatch = (offset: number) =>
      `${sharedContext}

TASK
Generate 10 fresh content ideas (numbers ${offset + 1}–${offset + 10}). They must NOT overlap with each other thematically. Cover a mix of: education, entertainment, behind-the-scenes, transformation, opinion, and trend-jacking.

For each idea provide: title, hook (scroll-stopper opener), script (3–6 sentence outline), caption (ready to post), visual_direction (1 sentence), cta, best_fit_platform, why_it_works (1 sentence linking to a viral / competitor pattern above), hashtags (4–6).`;

    const batches = await Promise.allSettled([
      callIdeate(systemBase, promptForBatch(0)),
      callIdeate(systemBase, promptForBatch(10)),
      callIdeate(systemBase, promptForBatch(20)),
    ]);

    const allIdeas: IdeaPayload[] = [];
    batches.forEach((b) => { if (b.status === "fulfilled") allIdeas.push(...b.value); });

    if (allIdeas.length === 0) return json({ error: "All ideate batches failed" }, 500);

    // Normalise best_fit_platform to satisfy the DB CHECK constraint
    // (instagram | tiktok | facebook). Map common aliases the AI sometimes
    // returns; fall back to "instagram" for anything unrecognised so a single
    // bad value never blows up the whole insert.
    const normalisePlatform = (raw: string | undefined | null): string => {
      const v = String(raw ?? "").trim().toLowerCase();
      if (v === "instagram" || v === "ig" || v === "reels" || v === "instagram reels") return "instagram";
      if (v === "tiktok" || v === "tt" || v === "shorts" || v === "youtube shorts") return "tiktok";
      if (v === "facebook" || v === "fb" || v === "meta") return "facebook";
      return "instagram";
    };

    const rows = allIdeas.slice(0, 30).map((idea, idx) => ({
      run_id: runId,
      idea_number: idx + 1,
      title: idea.title,
      hook: idea.hook,
      script: idea.script,
      caption: idea.caption,
      visual_direction: idea.visual_direction,
      cta: idea.cta,
      best_fit_platform: normalisePlatform(idea.best_fit_platform),
      why_it_works: idea.why_it_works,
      hashtags: idea.hashtags ?? [],
      status: "new",
      current_version: 1,
      edit_count: 0,
    }));

    const { error: insErr } = await admin.from("content_lab_ideas").insert(rows);
    if (insErr) return json({ error: `Insert ideas failed: ${insErr.message}` }, 500);

    return json({ inserted: rows.length });
  } catch (e) {
    console.error("[content-lab-ideate]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
