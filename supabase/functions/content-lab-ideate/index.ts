// content-lab-ideate: generates platform-tailored content ideas using Claude.
// - Distributes 12 ideas across selected platforms (12 / N split)
// - One Claude call per platform with platform-specific style guide
// - Uses master prompt (HARD_RULES + REQUIRED_RULES + brand profile)
// - Posts are filtered to that platform + own/competitor/benchmark buckets
// - Writes target_platform, platform_style_notes, caption_with_hashtag, script_full

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildSystemPrompt,
  distributeIdeas,
  platformStyleNote,
  type NicheContext,
} from "../_shared/contentLabPrompts.ts";
import { logStepStart } from "../_shared/contentLabStepLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const MODEL = "claude-sonnet-4-5-20250929";
const TOP_POSTS_PER_PLATFORM = 12;

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

    const { data: run, error: runErr } = await supabase
      .from("content_lab_runs")
      .select("id, niche_id")
      .eq("id", run_id)
      .single();
    if (runErr || !run) return json({ error: "Run not found" }, 404);

    const { data: niche, error: nicheErr } = await supabase
      .from("content_lab_niches")
      .select("*")
      .eq("id", run.niche_id)
      .single();
    if (nicheErr || !niche) return json({ error: "Niche not found" }, 404);

    const { data: posts } = await supabase
      .from("content_lab_posts")
      .select("id, platform, author_handle, bucket, caption, ai_summary, hook_text, hook_type, likes, comments, views, post_url")
      .eq("run_id", run_id)
      .order("engagement_rate", { ascending: false });

    if (!posts || posts.length === 0) {
      return json({ error: "No posts to ideate from" }, 400);
    }

    const platforms: string[] = (niche.platforms_to_scrape ?? ["instagram"]) as string[];
    const distribution = distributeIdeas(platforms);

    // Clear previous ideas for this run
    await supabase.from("content_lab_ideas").delete().eq("run_id", run_id);

    const allRows: IdeaRow[] = [];
    let ideaCounter = 0;

    for (const platform of platforms) {
      const count = distribution[platform];
      if (!count) continue;

      const platformPosts = (posts as PostRow[])
        .filter((p) => p.platform === platform)
        .slice(0, TOP_POSTS_PER_PLATFORM);

      const platformLog = await logStepStart({
        runId: run_id,
        step: "ideate",
        message: `Ideate ${platform} (${count} ideas, ${platformPosts.length} source posts)`,
        payload: { platform, target_count: count, source_post_count: platformPosts.length },
      });

      if (platformPosts.length === 0) {
        console.warn(`No posts for platform ${platform}, skipping ideation for it.`);
        await platformLog.finish({ status: "failed", errorMessage: "No source posts for platform" });
        continue;
      }

      const generated = await generateIdeasForPlatform({
        apiKey,
        niche: niche as unknown as NicheContext,
        platform,
        count,
        posts: platformPosts,
      });

      if (!generated || generated.length === 0) {
        console.error(`Ideation failed for ${platform}`);
        await platformLog.finish({ status: "failed", errorMessage: "Claude returned no ideas" });
        continue;
      }

      // Fallback evidence post: highest-engagement post for this platform.
      const fallbackPostId = platformPosts[0]?.id ?? null;
      for (const idea of generated.slice(0, count)) {
        ideaCounter += 1;
        allRows.push(toRow(run_id, ideaCounter, platform, idea, platformPosts, fallbackPostId));
      }
      await platformLog.finish({
        status: "ok",
        message: `Generated ${generated.length} ideas for ${platform}`,
        payload: { platform, generated_count: generated.length },
      });
    }

    if (allRows.length === 0) {
      return json({ error: "Ideation produced no ideas" }, 500);
    }

    const { error: insertErr } = await supabase.from("content_lab_ideas").insert(allRows);
    if (insertErr) return json({ error: insertErr.message }, 500);

    return json({ ok: true, idea_count: allRows.length, platforms: distribution });
  } catch (e) {
    console.error("content-lab-ideate error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface PostRow {
  id: string;
  platform: string;
  author_handle: string;
  bucket: string | null;
  caption: string | null;
  ai_summary: string | null;
  hook_text: string | null;
  hook_type: string | null;
  likes: number;
  comments: number;
  views: number;
  post_url: string | null;
}

interface GeneratedIdea {
  title: string;
  based_on_handle?: string;
  hook: string;
  body: string;
  cta?: string;
  caption?: string;
  caption_with_hashtag?: string;
  script_full?: string;
  duration_seconds?: number;
  visual_direction?: string;
  why_it_works: string;
  hashtags?: string[];
  filming_checklist?: string[];
  platform_style_notes?: string;
}

interface IdeaRow {
  run_id: string;
  idea_number: number;
  target_platform: string;
  platform_style_notes: string | null;
  title: string;
  based_on_post_id: string | null;
  caption: string | null;
  caption_with_hashtag: string | null;
  hook: string | null;
  body: string | null;
  cta: string | null;
  script_full: string | null;
  duration_seconds: number | null;
  visual_direction: string | null;
  why_it_works: string | null;
  hashtags: string[];
  filming_checklist: string[];
  status: string;
}

function toRow(
  runId: string,
  ideaNumber: number,
  platform: string,
  idea: GeneratedIdea,
  posts: PostRow[],
  fallbackPostId: string | null,
): IdeaRow {
  return {
    run_id: runId,
    idea_number: ideaNumber,
    target_platform: platform,
    platform_style_notes: idea.platform_style_notes ?? null,
    title: idea.title,
    based_on_post_id: matchPost(posts, idea.based_on_handle) ?? fallbackPostId,
    caption: idea.caption ?? null,
    caption_with_hashtag: idea.caption_with_hashtag ?? null,
    hook: idea.hook,
    body: idea.body,
    cta: idea.cta ?? null,
    script_full: idea.script_full ?? null,
    duration_seconds: idea.duration_seconds ?? null,
    visual_direction: idea.visual_direction ?? null,
    why_it_works: idea.why_it_works,
    hashtags: idea.hashtags ?? [],
    filming_checklist: idea.filming_checklist ?? [],
    status: "not_started",
  };
}

function matchPost(posts: PostRow[], handle?: string): string | null {
  if (!handle) return null;
  const h = handle.toLowerCase().replace(/^@/, "");
  return posts.find((p) => p.author_handle.toLowerCase() === h)?.id ?? null;
}

interface IdeatePlatformArgs {
  apiKey: string;
  niche: NicheContext;
  platform: string;
  count: number;
  posts: PostRow[];
}

async function generateIdeasForPlatform(args: IdeatePlatformArgs): Promise<GeneratedIdea[] | null> {
  const { apiKey, niche, platform, count, posts } = args;

  const systemPrompt = `${buildSystemPrompt(niche)}

PLATFORM TARGET: ${platform.toUpperCase()}
${platformStyleNote(platform)}

You will produce exactly ${count} ideas for this platform. Each idea must feel native to ${platform} — not a generic short-form video.`;

  const postSummary = posts.map((p, i) => {
    const bucketTag = p.bucket ? `[${p.bucket}]` : "";
    return `${i + 1}. ${bucketTag} @${p.author_handle} — ${p.likes}❤ ${p.comments}💬 ${p.views}👁
   Hook: ${p.hook_text ?? "—"}
   Summary: ${p.ai_summary ?? p.caption?.slice(0, 200) ?? "—"}`;
  }).join("\n\n");

  const userPrompt = `Top-performing ${platform} posts in this niche:

${postSummary}

Use the generate_ideas tool to return exactly ${count} ${platform}-native ideas grounded in these posts.`;

  const tool = {
    name: "generate_ideas",
    description: `Return ${count} ready-to-film content ideas tailored for ${platform}.`,
    input_schema: {
      type: "object",
      properties: {
        ideas: {
          type: "array",
          minItems: count,
          maxItems: count,
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short working title (max 80 chars)" },
              based_on_handle: { type: "string", description: "@handle of the source post (without @)" },
              hook: { type: "string", description: "Exact words spoken in first 3 seconds" },
              body: { type: "string", description: "What gets said/shown in the middle of the video" },
              cta: { type: "string", description: "Specific, action-led CTA (no 'link in bio' alone)" },
              caption: { type: "string", description: "Post caption (no hashtags)" },
              caption_with_hashtag: { type: "string", description: "Caption with 1-3 hashtags appended" },
              script_full: { type: "string", description: "Full word-for-word script: hook + body + CTA" },
              duration_seconds: { type: "integer", minimum: 10, maximum: 90 },
              visual_direction: { type: "string", description: "What's on screen — angle, b-roll, text overlays" },
              why_it_works: { type: "string", description: "Why this will resonate with this niche's audience" },
              hashtags: { type: "array", items: { type: "string" }, maxItems: 3 },
              filming_checklist: { type: "array", items: { type: "string" }, maxItems: 6 },
              platform_style_notes: { type: "string", description: `${platform}-specific format notes (aspect ratio, pacing, native feel)` },
            },
            required: ["title", "hook", "body", "cta", "script_full", "duration_seconds", "why_it_works", "platform_style_notes"],
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
        max_tokens: 6000,
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
    console.error(`generateIdeasForPlatform(${platform}) failed:`, e);
    return null;
  }
}
