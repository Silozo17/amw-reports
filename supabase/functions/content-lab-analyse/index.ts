// content-lab-analyse: per-post AI summary + hook extraction via Lovable AI gateway.
// Cheap model (gemini-2.5-flash-lite). Updates content_lab_posts in place.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const MODEL = "google/gemini-2.5-flash-lite";
const MAX_POSTS_TO_ANALYSE = 40;

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

    // Pick top posts by engagement, only ones missing summaries
    const { data: posts, error } = await supabase
      .from("content_lab_posts")
      .select("id, caption, likes, comments, views, ai_summary")
      .eq("run_id", run_id)
      .order("engagement_rate", { ascending: false })
      .limit(MAX_POSTS_TO_ANALYSE);
    if (error) return json({ error: error.message }, 500);

    let analysed = 0;
    for (const p of posts ?? []) {
      if (p.ai_summary) continue;
      if (!p.caption || p.caption.trim().length < 10) continue;

      const result = await analysePost(apiKey, p.caption);
      if (!result) continue;

      await supabase.from("content_lab_posts").update({
        ai_summary: result.summary,
        hook_text: result.hook,
        hook_type: result.hook_type,
      }).eq("id", p.id);
      analysed++;
    }

    return json({ ok: true, analysed });
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

interface AnalyseResult { summary: string; hook: string; hook_type: string }

async function analysePost(apiKey: string, caption: string): Promise<AnalyseResult | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
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

    if (!res.ok) {
      console.error("AI analyse error:", res.status, await res.text());
      return null;
    }
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
    console.error("analysePost failed:", e);
    return null;
  }
}
