// content-lab-ideate: Claude generates 12 content ideas based on the run's top posts.
// Single structured tool-call. Inserts into content_lab_ideas.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const MODEL = "claude-sonnet-4-5-20250929";
const TOP_POSTS_FOR_PROMPT = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-ideate", method: req.method }));

  try {
    const { run_id } = await req.json();
    if (!run_id) return json({ error: "run_id is required" }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: run } = await supabase
      .from("content_lab_runs").select("*, niche:niche_id(label, language)").eq("id", run_id).single();
    if (!run) return json({ error: "Run not found" }, 404);

    const { data: posts } = await supabase
      .from("content_lab_posts")
      .select("id, author_handle, caption, ai_summary, hook_text, hook_type, likes, comments, views, post_url")
      .eq("run_id", run_id)
      .order("engagement_rate", { ascending: false })
      .limit(TOP_POSTS_FOR_PROMPT);

    if (!posts || posts.length === 0) {
      return json({ error: "No posts to ideate from" }, 400);
    }

    const niche = (run as { niche: { label: string; language: string } }).niche;
    const ideas = await generateIdeas(apiKey, niche.label, niche.language ?? "en", posts);
    if (!ideas) return json({ error: "Ideation returned no result" }, 500);

    const rows = ideas.slice(0, 12).map((idea, i) => ({
      run_id,
      idea_number: i + 1,
      title: idea.title,
      based_on_post_id: matchPost(posts, idea.based_on_handle),
      caption: idea.caption ?? null,
      hook: idea.hook ?? null,
      body: idea.body ?? null,
      cta: idea.cta ?? null,
      duration_seconds: idea.duration_seconds ?? null,
      visual_direction: idea.visual_direction ?? null,
      why_it_works: idea.why_it_works ?? null,
      hashtags: idea.hashtags ?? [],
      filming_checklist: idea.filming_checklist ?? [],
    }));

    // Replace existing ideas for this run
    await supabase.from("content_lab_ideas").delete().eq("run_id", run_id);
    const { error: insertErr } = await supabase.from("content_lab_ideas").insert(rows);
    if (insertErr) return json({ error: insertErr.message }, 500);

    return json({ ok: true, idea_count: rows.length });
  } catch (e) {
    console.error("content-lab-ideate error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface PostRow {
  id: string; author_handle: string; caption: string | null; ai_summary: string | null;
  hook_text: string | null; hook_type: string | null; likes: number; comments: number;
  views: number; post_url: string | null;
}

interface GeneratedIdea {
  title: string;
  based_on_handle?: string;
  caption?: string;
  hook?: string;
  body?: string;
  cta?: string;
  duration_seconds?: number;
  visual_direction?: string;
  why_it_works?: string;
  hashtags?: string[];
  filming_checklist?: string[];
}

function matchPost(posts: PostRow[], handle?: string): string | null {
  if (!handle) return null;
  const h = handle.toLowerCase().replace(/^@/, "");
  return posts.find((p) => p.author_handle.toLowerCase() === h)?.id ?? null;
}

async function generateIdeas(
  apiKey: string,
  nicheLabel: string,
  language: string,
  posts: PostRow[],
): Promise<GeneratedIdea[] | null> {
  const postSummary = posts.map((p, i) =>
    `${i + 1}. @${p.author_handle} — ${p.likes}❤ ${p.comments}💬 ${p.views}👁\n   Hook: ${p.hook_text ?? "—"}\n   Summary: ${p.ai_summary ?? p.caption?.slice(0, 200) ?? "—"}`
  ).join("\n\n");

  const systemPrompt = `You are a senior content strategist for the "${nicheLabel}" niche. Output 12 distinct, ready-to-film short-form video ideas in ${language}, each grounded in a specific top post you've been shown. Avoid generic advice. Each idea must be filmable in under a day with a phone.`;

  const userPrompt = `Top posts in this niche:\n\n${postSummary}\n\nReturn 12 ideas using the generate_ideas tool.`;

  const tool = {
    name: "generate_ideas",
    description: "Return 12 ready-to-film content ideas",
    input_schema: {
      type: "object",
      properties: {
        ideas: {
          type: "array",
          minItems: 12,
          maxItems: 12,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              based_on_handle: { type: "string", description: "@handle of the source post (without @)" },
              caption: { type: "string" },
              hook: { type: "string", description: "Opening 3 seconds spoken on camera" },
              body: { type: "string", description: "What gets said/shown in the middle" },
              cta: { type: "string" },
              duration_seconds: { type: "integer", minimum: 10, maximum: 90 },
              visual_direction: { type: "string" },
              why_it_works: { type: "string" },
              hashtags: { type: "array", items: { type: "string" }, maxItems: 8 },
              filming_checklist: { type: "array", items: { type: "string" }, maxItems: 6 },
            },
            required: ["title", "hook", "body", "duration_seconds", "why_it_works"],
          },
        },
      },
      required: ["ideas"],
    },
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        tools: [tool],
        tool_choice: { type: "tool", name: "generate_ideas" },
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      console.error("Claude error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const toolUse = (data.content ?? []).find((c: { type: string }) => c.type === "tool_use");
    if (!toolUse?.input?.ideas) return null;
    return toolUse.input.ideas as GeneratedIdea[];
  } catch (e) {
    console.error("generateIdeas failed:", e);
    return null;
  }
}
