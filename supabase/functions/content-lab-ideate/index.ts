// content-lab-ideate: generates platform-tailored ideas using Claude.
// BENCHMARK-FIRST: ideas are reverse-engineered from the top 30 benchmark posts only,
// unless the brand's own performance matches benchmark median (then own posts are
// also eligible inspiration). Otherwise own posts are listed as anti-examples.

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
const TOP_BENCHMARK_POSTS = 30;
const ANTI_EXAMPLE_OWN_POSTS = 6;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-ideate", method: req.method }));

  try {
    const { run_id, platform: singlePlatform } = await req.json();
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
      .select("id, platform, author_handle, source, bucket, caption, ai_summary, hook_text, hook_type, likes, comments, views, post_url")
      .eq("run_id", run_id)
      .order("views", { ascending: false })
      .order("likes", { ascending: false })
      .order("comments", { ascending: false });

    if (!posts || posts.length === 0) {
      return json({ error: "No posts to ideate from" }, 400);
    }

    const ownHandle = (niche.own_handle ?? "").toLowerCase().replace(/^@/, "");
    const benchmarkPosts = (posts as PostRow[]).filter((p) => p.bucket === "benchmark" || p.bucket === "competitor");
    const ownPosts = (posts as PostRow[]).filter((p) => p.bucket === "own");

    const ownAvgViews = avg(ownPosts.map((p) => p.views ?? 0));
    const benchmarkP50Views = median(benchmarkPosts.slice(0, TOP_BENCHMARK_POSTS).map((p) => p.views ?? 0));
    const ownIsCompetitive = ownAvgViews > 0 && ownAvgViews >= benchmarkP50Views;

    const allPlatforms: string[] = (niche.platforms_to_scrape ?? ["instagram"]) as string[];
    const distribution = distributeIdeas(allPlatforms);

    // Single-platform mode: only ideate the requested platform; preserve other platforms' ideas.
    // Multi-platform mode (legacy): clear all and ideate every platform sequentially.
    const platformsToProcess = singlePlatform ? [singlePlatform] : allPlatforms;
    if (singlePlatform) {
      await supabase.from("content_lab_ideas").delete().eq("run_id", run_id).eq("target_platform", singlePlatform);
    } else {
      await supabase.from("content_lab_ideas").delete().eq("run_id", run_id);
    }

    // Get current max idea_number so single-platform calls don't collide
    const { data: existingIdeas } = await supabase
      .from("content_lab_ideas")
      .select("idea_number")
      .eq("run_id", run_id)
      .order("idea_number", { ascending: false })
      .limit(1);
    let ideaCounter = (existingIdeas?.[0]?.idea_number ?? 0) as number;

    const allRows: IdeaRow[] = [];
    const rejectionLog: string[] = [];

    for (const platform of platformsToProcess) {
      const count = distribution[platform];
      if (!count) continue;

      const platformBenchmarks = benchmarkPosts
        .filter((p) => p.platform === platform)
        .slice(0, TOP_BENCHMARK_POSTS);

      const platformOwn = ownPosts.filter((p) => p.platform === platform);

      const platformLog = await logStepStart({
        runId: run_id,
        step: "ideate",
        message: `Ideate ${platform} (${count} ideas, ${platformBenchmarks.length} benchmark posts)`,
        payload: { platform, target_count: count, benchmark_post_count: platformBenchmarks.length, own_post_count: platformOwn.length, own_is_competitive: ownIsCompetitive },
      });

      if (platformBenchmarks.length === 0) {
        console.warn(`No benchmark posts for ${platform}, skipping.`);
        await platformLog.finish({ status: "failed", errorMessage: "No benchmark posts for platform" });
        continue;
      }

      const generated = await generateIdeasForPlatform({
        apiKey,
        niche: niche as unknown as NicheContext,
        platform,
        count,
        benchmarkPosts: platformBenchmarks,
        ownPosts: platformOwn,
        ownIsCompetitive,
        ownAvgViews,
        benchmarkP50Views,
      });

      if (!generated.ok) {
        console.error(`Ideation failed for ${platform}: ${generated.error}`);
        await platformLog.finish({ status: "failed", errorMessage: generated.error });
        return json({ error: `Anthropic (${platform}): ${generated.error}` }, 502);
      }

      const validHandles = new Set<string>();
      platformBenchmarks.forEach((p) => validHandles.add(p.author_handle.toLowerCase()));
      if (ownIsCompetitive && ownHandle) validHandles.add(ownHandle);

      const fallbackPostId = platformBenchmarks[0]?.id ?? null;
      const accepted: typeof generated.ideas = [];

      for (const idea of generated.ideas) {
        const handle = (idea.based_on_handle ?? "").toLowerCase().replace(/^@/, "");
        const isOwn = ownHandle && handle === ownHandle;

        if (!handle) {
          rejectionLog.push(`#${idea.title}: missing based_on_handle`);
          continue;
        }
        if (isOwn && !ownIsCompetitive) {
          rejectionLog.push(`#${idea.title}: cited own handle while own underperforms benchmarks`);
          continue;
        }
        if (!validHandles.has(handle)) {
          rejectionLog.push(`#${idea.title}: based_on_handle '${handle}' not in scraped pool`);
          continue;
        }
        if (idea.hook && idea.caption && idea.hook.trim().toLowerCase() === idea.caption.trim().toLowerCase()) {
          rejectionLog.push(`#${idea.title}: hook duplicates caption`);
          continue;
        }
        accepted.push(idea);
        if (accepted.length >= count) break;
      }

      if (accepted.length === 0) {
        console.error(`All ${generated.ideas.length} ideas rejected for ${platform}`);
        await platformLog.finish({
          status: "failed",
          errorMessage: `All ideas rejected by validator`,
          payload: { rejections: rejectionLog.slice(-20) },
        });
        continue;
      }

      for (const idea of accepted) {
        ideaCounter += 1;
        allRows.push(toRow(run_id, ideaCounter, platform, idea, platformBenchmarks, fallbackPostId));
      }

      await platformLog.finish({
        status: "ok",
        message: `Accepted ${accepted.length}/${generated.ideas.length} ideas for ${platform}`,
        payload: {
          platform,
          generated_count: generated.ideas.length,
          accepted_count: accepted.length,
          rejection_count: generated.ideas.length - accepted.length,
          rejections_sample: rejectionLog.slice(-10),
        },
      });
    }

    if (allRows.length === 0) {
      return json({ error: "Ideation produced no ideas — all rejected by validator", rejections: rejectionLog.slice(-20) }, 500);
    }

    const { error: insertErr } = await supabase.from("content_lab_ideas").insert(allRows);
    if (insertErr) return json({ error: insertErr.message }, 500);

    return json({ ok: true, idea_count: allRows.length, platforms: platformsToProcess, own_is_competitive: ownIsCompetitive });
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

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface PostRow {
  id: string;
  platform: string;
  author_handle: string;
  source: string;
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

interface HookVariant { text: string; mechanism: string; why: string }

interface GeneratedIdea {
  title: string;
  based_on_handle?: string;
  hook: string;
  hook_variants?: HookVariant[];
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
  hook_variants: HookVariant[];
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
    hook_variants: Array.isArray(idea.hook_variants) ? idea.hook_variants.slice(0, 3) : [],
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
  benchmarkPosts: PostRow[];
  ownPosts: PostRow[];
  ownIsCompetitive: boolean;
  ownAvgViews: number;
  benchmarkP50Views: number;
}

type IdeateResult =
  | { ok: true; ideas: GeneratedIdea[] }
  | { ok: false; error: string };

function formatPostList(posts: PostRow[]): string {
  return posts.map((p, i) => {
    return `${i + 1}. @${p.author_handle} — ${fmt(p.views)}👁  ${fmt(p.likes)}❤  ${fmt(p.comments)}💬
   Hook: ${p.hook_text ?? "—"}
   Summary: ${p.ai_summary ?? p.caption?.slice(0, 200) ?? "—"}`;
  }).join("\n\n");
}

function fmt(n: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

async function generateIdeasForPlatform(args: IdeatePlatformArgs): Promise<IdeateResult> {
  const { apiKey, niche, platform, count, benchmarkPosts, ownPosts, ownIsCompetitive, ownAvgViews, benchmarkP50Views } = args;

  // Generate a slight buffer so the validator can reject a few without starving the run.
  const requestCount = Math.min(count + 2, count * 2);

  const inspirationPool = ownIsCompetitive
    ? [...benchmarkPosts, ...ownPosts.slice(0, 6)]
    : benchmarkPosts;

  const antiExampleBlock = !ownIsCompetitive && ownPosts.length > 0
    ? `\n\nBRAND'S OWN UNDERPERFORMING POSTS — DO NOT REPEAT THESE PATTERNS.\nThe brand's own avg views (${fmt(ownAvgViews)}) sit BELOW the benchmark median (${fmt(benchmarkP50Views)}). Do NOT cite the brand's own handle in based_on_handle. Treat these as anti-examples:\n\n${formatPostList(ownPosts.slice(0, ANTI_EXAMPLE_OWN_POSTS))}`
    : ownIsCompetitive
      ? `\n\nThe brand's own performance (${fmt(ownAvgViews)} avg views) is on par with benchmarks (${fmt(benchmarkP50Views)} median). Their best own posts are eligible inspiration too.`
      : "";

  const systemPrompt = `${buildSystemPrompt(niche)}

PLATFORM TARGET: ${platform.toUpperCase()}
${platformStyleNote(platform)}

You will produce exactly ${requestCount} ideas for this platform. Each idea must feel native to ${platform}.`;

  const userPrompt = `INSPIRATION POOL — top ${platform} posts in this niche, ranked by views:

${formatPostList(inspirationPool)}${antiExampleBlock}

Use the generate_ideas tool to return exactly ${requestCount} ${platform}-native ideas. Every idea MUST cite based_on_handle from the inspiration pool above.`;

  const tool = {
    name: "generate_ideas",
    description: `Return ${requestCount} ready-to-film content ideas tailored for ${platform}.`,
    input_schema: {
      type: "object",
      properties: {
        ideas: {
          type: "array",
          minItems: requestCount,
          maxItems: requestCount,
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short working title (max 80 chars)" },
              based_on_handle: { type: "string", description: "@handle of the source benchmark post (without @) — REQUIRED, must be from the pool above" },
              hook: { type: "string", description: "Exact words spoken in first 3 seconds (the primary recommended hook)" },
              hook_variants: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                description: "Three alternative opening hooks for the SAME idea, each using a different attention mechanism so the user can pick the one that fits their voice. The first variant should match `hook` above.",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string", description: "The hook line itself, max 12 words" },
                    mechanism: { type: "string", description: "One of: curiosity_gap, negative, social_proof, contrarian, pattern_interrupt, stat_shock, question, story_open" },
                    why: { type: "string", description: "One sentence on why this mechanism works for this idea" },
                  },
                  required: ["text", "mechanism", "why"],
                },
              },
              body: { type: "string", description: "What gets said/shown in the middle of the video" },
              cta: { type: "string", description: "Specific, action-led CTA aligned with the brand's stated goal" },
              caption: { type: "string", description: "Post caption (no hashtags) — MUST NOT duplicate the hook" },
              caption_with_hashtag: { type: "string", description: "Caption with 1-3 hashtags appended" },
              script_full: { type: "string", description: "Full word-for-word script: hook + body + CTA" },
              duration_seconds: { type: "integer", minimum: 10, maximum: 90 },
              visual_direction: { type: "string", description: "What's on screen — angle, b-roll, text overlays" },
              why_it_works: { type: "string", description: "Name the source post's metric AND the structural mechanic you're borrowing" },
              hashtags: { type: "array", items: { type: "string" }, maxItems: 3 },
              filming_checklist: { type: "array", items: { type: "string" }, maxItems: 6 },
              platform_style_notes: { type: "string" },
            },
            required: ["title", "based_on_handle", "hook", "hook_variants", "body", "cta", "caption", "script_full", "duration_seconds", "why_it_works", "platform_style_notes"],
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
        max_tokens: 16000,
        tools: [tool],
        tool_choice: { type: "tool", name: "generate_ideas" },
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const requestId = res.headers.get("request-id") ?? res.headers.get("x-request-id") ?? "n/a";

    if (!res.ok) {
      const text = await res.text();
      console.error(JSON.stringify({
        fn: "content-lab-ideate",
        anthropic_error: true,
        status: res.status,
        request_id: requestId,
        body: text.slice(0, 1000),
      }));
      let detail = text.slice(0, 500);
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error?.message) detail = parsed.error.message;
      } catch { /* keep raw text */ }
      return { ok: false, error: `${res.status} ${detail} (req:${requestId})` };
    }

    const data = await res.json();
    const contentBlocks = (data.content ?? []) as Array<{ type: string; text?: string; input?: { ideas?: GeneratedIdea[] } }>;
    const toolUse = contentBlocks.find((c) => c.type === "tool_use");

    if (!toolUse?.input?.ideas) {
      const stopReason = data.stop_reason ?? "unknown";
      const blockTypes = contentBlocks.map((c) => c.type).join(",") || "none";
      const textBlock = contentBlocks.find((c) => c.type === "text")?.text ?? "";
      const textPreview = textBlock ? textBlock.slice(0, 400) : "";
      console.error(JSON.stringify({
        fn: "content-lab-ideate",
        anthropic_no_tool_use: true,
        platform,
        request_id: requestId,
        stop_reason: stopReason,
        block_types: blockTypes,
        text_preview: textPreview,
      }));
      return {
        ok: false,
        error: `Claude returned no tool_use (stop_reason=${stopReason}, blocks=${blockTypes}, req:${requestId})`,
      };
    }

    const ideas = toolUse.input.ideas;
    const missing: string[] = [];
    ideas.forEach((idea, i) => {
      if (!idea.title) missing.push(`#${i + 1}.title`);
      if (!idea.hook) missing.push(`#${i + 1}.hook`);
      if (!idea.body) missing.push(`#${i + 1}.body`);
      if (!idea.based_on_handle) missing.push(`#${i + 1}.based_on_handle`);
      if (!idea.why_it_works) missing.push(`#${i + 1}.why_it_works`);
    });
    if (missing.length > 0) {
      console.error(JSON.stringify({
        fn: "content-lab-ideate",
        anthropic_invalid_payload: true,
        platform,
        request_id: requestId,
        missing_fields: missing.slice(0, 10),
      }));
      return { ok: false, error: `Claude payload missing required fields: ${missing.slice(0, 5).join(", ")} (req:${requestId})` };
    }

    return { ok: true, ideas };
  } catch (e) {
    console.error(`generateIdeasForPlatform(${platform}) failed:`, e);
    return { ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}
