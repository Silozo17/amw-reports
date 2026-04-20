// content-lab-analyse: two-tier post analysis.
//
// Tier 1 (cheap): every post that has a caption gets a summary + hook extracted via
// Gemini Flash Lite. Bounded volume.
//
// Tier 2 (deep): the top 20 pieces flagged by the scraper (top 10 benchmark + top 10
// competitor by engagement-weighted score) get the Pro treatment — Gemini 2.5 Pro
// reads transcript (when present) + caption + thumbnail URL and returns a structured
// analysis (hook_text, hook_type, topic, intent, format_pattern, script_summary,
// style_notes). Results are written back to the same row's ai_summary/hook_text/hook_type
// fields and the structured detail is stored in summary.deep_analysis[post_id].

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const FAST_MODEL = "google/gemini-2.5-flash-lite";
const PRO_MODEL = "google/gemini-2.5-pro";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_POSTS_FAST = 40;

interface PostRow {
  id: string;
  caption: string | null;
  ai_summary: string | null;
  hook_text: string | null;
  thumbnail_url: string | null;
  transcript: string | null;
  platform: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-analyse", method: req.method }));

  try {
    const { run_id } = await req.json();
    if (!run_id) return json({ error: "run_id is required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    // Pull all posts for this run + the run summary (for top-N IDs).
    const { data: run } = await supabase
      .from("content_lab_runs").select("summary").eq("id", run_id).maybeSingle();
    const summary = ((run as { summary?: Record<string, unknown> } | null)?.summary ?? {}) as Record<string, unknown>;
    const topIds = new Set<string>(Array.isArray(summary.analyse_top_post_ids) ? (summary.analyse_top_post_ids as string[]) : []);

    const { data: posts, error } = await supabase
      .from("content_lab_posts")
      .select("id, caption, ai_summary, hook_text, thumbnail_url, transcript, platform")
      .eq("run_id", run_id)
      .order("engagement_rate", { ascending: false })
      .limit(MAX_POSTS_FAST);
    if (error) return json({ error: error.message }, 500);

    let fastAnalysed = 0;
    let deepAnalysed = 0;
    const deepResults: Record<string, unknown> = {};

    for (const p of (posts ?? []) as PostRow[]) {
      if (!p.caption || p.caption.trim().length < 10) continue;
      if (!p.ai_summary) {
        const result = await analyseFast(apiKey, p.caption);
        if (result) {
          await supabase.from("content_lab_posts").update({
            ai_summary: result.summary,
            hook_text: result.hook,
            hook_type: result.hook_type,
          }).eq("id", p.id);
          // Mutate locally so the hook write below picks up the new value
          p.hook_text = result.hook;
          fastAnalysed++;
        }
      }
    }

    // Write extracted hooks to the global hook library (idempotent via unique index).
    await upsertHooks(supabase, run_id, (posts ?? []) as PostRow[]);

    // Deep analysis for top-N — re-fetch including the IDs flagged by scraper that
    // may not be in the engagement-rate-ordered top 40 batch above.
    if (topIds.size > 0) {
      const { data: topPosts } = await supabase
        .from("content_lab_posts")
        .select("id, caption, ai_summary, hook_text, thumbnail_url, transcript, platform")
        .in("id", [...topIds]);
      for (const p of (topPosts ?? []) as PostRow[]) {
        const deep = await analyseDeep(apiKey, p);
        if (!deep) continue;
        deepResults[p.id] = deep;
        await supabase.from("content_lab_posts").update({
          ai_summary: deep.script_summary ?? p.ai_summary,
          hook_text: deep.hook_text ?? p.hook_text,
          hook_type: deep.hook_type ?? null,
        }).eq("id", p.id);
        // Insert the deep-analysed hook into the library (overrides fast version on conflict-free runs).
        if (deep.hook_text) {
          await supabase.from("content_lab_hooks").upsert({
            run_id,
            hook_text: deep.hook_text,
            mechanism: deep.hook_type || null,
            why_it_works: deep.format_pattern || null,
            source_post_id: p.id,
          }, { onConflict: "run_id,hook_text", ignoreDuplicates: true });
        }
        deepAnalysed++;
      }
    }

    // Persist deep analysis blob on the run summary so ideate / UI can use it.
    if (Object.keys(deepResults).length > 0) {
      await supabase.from("content_lab_runs")
        .update({
          summary: { ...summary, deep_analysis: deepResults },
          updated_at: new Date().toISOString(),
        })
        .eq("id", run_id);
    }

    return json({ ok: true, fast: fastAnalysed, deep: deepAnalysed });
  } catch (e) {
    console.error("content-lab-analyse error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface FastResult { summary: string; hook: string; hook_type: string }

// deno-lint-ignore no-explicit-any
async function upsertHooks(supabase: any, run_id: string, posts: PostRow[]) {
  const rows = posts
    .filter((p) => p.hook_text && p.hook_text.trim().length > 0)
    .map((p) => ({
      run_id,
      hook_text: p.hook_text!.trim(),
      mechanism: p.hook_type || null,
      why_it_works: null,
      source_post_id: p.id,
    }));
  if (rows.length === 0) return;
  // Dedupe within the batch by lowercased hook_text
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const k = r.hook_text.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const { error } = await supabase
    .from("content_lab_hooks")
    .upsert(deduped, { onConflict: "run_id,hook_text", ignoreDuplicates: true });
  if (error) console.error("upsertHooks error:", error.message);
}

async function analyseFast(apiKey: string, caption: string): Promise<FastResult | null> {
  try {
    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FAST_MODEL,
        messages: [
          {
            role: "system",
            content: "You analyse social posts. Return JSON only with keys: summary (1 sentence), hook (the opening line verbatim), hook_type (one of: question, stat, story, controversy, listicle, promise, other).",
          },
          { role: "user", content: caption.slice(0, 1500) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    return {
      summary: String(parsed.summary ?? "").slice(0, 500),
      hook: String(parsed.hook ?? "").slice(0, 300),
      hook_type: String(parsed.hook_type ?? "other"),
    };
  } catch (e) {
    console.error("analyseFast failed:", e);
    return null;
  }
}

interface DeepResult {
  hook_text: string;
  hook_type: string;
  topic: string;
  intent: string;
  format_pattern: string;
  script_summary: string;
  style_notes: string;
}

async function analyseDeep(apiKey: string, p: PostRow): Promise<DeepResult | null> {
  try {
    const userText = [
      p.caption ? `CAPTION:\n${p.caption.slice(0, 2000)}` : "",
      p.transcript ? `\n\nTRANSCRIPT:\n${p.transcript.slice(0, 4000)}` : "",
      p.thumbnail_url ? `\n\nTHUMBNAIL_URL: ${p.thumbnail_url}` : "",
      `\n\nPLATFORM: ${p.platform}`,
    ].filter(Boolean).join("");

    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: PRO_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a senior short-form video strategist. Reverse-engineer one post and return STRICT JSON with keys: hook_text (verbatim opening line), hook_type (one of: question, stat, story, controversy, listicle, promise, contrarian, demo, other), topic (1 phrase), intent (one of: educate, entertain, sell, build_authority, emotional_connection, social_proof), format_pattern (1 sentence describing the structural mechanic — e.g. 'list of 3 with reveal at end', 'before/after demo', 'POV monologue with hard cut'), script_summary (2-3 sentences describing what the video says/shows in order), style_notes (1 sentence on visual style: framing, b-roll, on-screen text, pacing). Be SPECIFIC. No padding.",
          },
          { role: "user", content: userText },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.error("analyseDeep error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    return {
      hook_text: String(parsed.hook_text ?? "").slice(0, 300),
      hook_type: String(parsed.hook_type ?? "other"),
      topic: String(parsed.topic ?? "").slice(0, 200),
      intent: String(parsed.intent ?? "").slice(0, 50),
      format_pattern: String(parsed.format_pattern ?? "").slice(0, 400),
      script_summary: String(parsed.script_summary ?? "").slice(0, 800),
      style_notes: String(parsed.style_notes ?? "").slice(0, 400),
    };
  } catch (e) {
    console.error("analyseDeep failed:", e);
    return null;
  }
}
