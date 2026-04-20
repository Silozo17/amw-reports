// content-lab-discover: takes own_handle + website + location + optional brand_brief,
// returns niche label, description, EXACTLY 10 top global benchmark accounts (ranked
// by typical reel views), up to 5 local competitors, suggested hashtags/keywords and
// default creative preferences. Uses Firecrawl + Lovable AI (Gemini) tool calling.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";
const CURRENT_YEAR = new Date().getUTCFullYear();

interface BrandBrief {
  niche?: string;
  positioning?: string;
  offers?: string[];
  audience_who?: string;
  audience_problem?: string;
  audience_where?: string;
  tones?: string[];
  never_do?: string[];
  producer?: string;
  goal?: string;
}

interface DiscoverInput {
  niche_id?: string;
  client_id?: string;
  org_id?: string;
  own_handle: string;
  website: string;
  location?: string;
  language?: string;
  brand_brief?: BrandBrief;
}

interface DiscoveryResult {
  niche_label: string;
  niche_description: string;
  top_competitors: Array<{ handle: string; platform: string; reason: string }>;
  top_global_benchmarks: Array<{ handle: string; platform: string; reason: string; est_avg_views?: string }>;
  suggested_hashtags: string[];
  suggested_keywords: string[];
  default_creative_prefs: {
    tone_of_voice: string;
    content_styles: string[];
    producer_type: string;
    video_length_preference: string;
    posting_cadence: string;
    do_not_use: string[];
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-discover", method: req.method }));

  try {
    if (!FIRECRAWL_API_KEY) return json({ error: "FIRECRAWL_API_KEY not configured" }, 500);
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const input = await req.json() as DiscoverInput;
    if (!input.own_handle && !input.website) {
      return json({ error: "own_handle or website is required" }, 400);
    }

    const siteSummary = input.website ? await scrapeSite(input.website) : "";
    console.log("Site scraped:", siteSummary.length, "chars");

    const discovery = await runDiscovery({
      own_handle: input.own_handle,
      website: input.website,
      location: input.location ?? null,
      language: input.language ?? "en",
      site_summary: siteSummary,
      brand_brief: input.brand_brief ?? null,
    });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Slugify the niche label into a stable niche_tag used for shared benchmark pooling.
    const nicheTag = slugify(discovery.niche_label);

    if (input.niche_id) {
      const { error: uErr } = await admin
        .from("content_lab_niches")
        .update({
          own_handle: input.own_handle,
          website: input.website,
          location: input.location ?? null,
          label: discovery.niche_label,
          niche_tag: nicheTag,
          niche_description: discovery.niche_description,
          top_competitors: discovery.top_competitors,
          top_global_benchmarks: discovery.top_global_benchmarks,
          tracked_hashtags: discovery.suggested_hashtags,
          tracked_keywords: discovery.suggested_keywords,
          tone_of_voice: discovery.default_creative_prefs.tone_of_voice,
          content_styles: discovery.default_creative_prefs.content_styles,
          producer_type: discovery.default_creative_prefs.producer_type,
          video_length_preference: discovery.default_creative_prefs.video_length_preference,
          posting_cadence: discovery.default_creative_prefs.posting_cadence,
          do_not_use: discovery.default_creative_prefs.do_not_use,
          brand_brief: input.brand_brief ?? {},
          discovered_at: new Date().toISOString(),
        })
        .eq("id", input.niche_id);
      if (uErr) return json({ error: uErr.message }, 500);
    }

    // Fire pool refresh in the background — don't block the discover response.
    // Skip if a verified pool already exists for this niche_tag (refreshed in last 14 days).
    queuePoolRefreshIfStale({
      admin,
      niche_tag: nicheTag,
      hashtags: discovery.suggested_hashtags,
      keywords: discovery.suggested_keywords,
      org_id: input.org_id ?? null,
    }).catch((e) => console.error("Pool refresh queue failed:", e));

    return json({ ok: true, discovery, niche_tag: nicheTag });
  } catch (e) {
    console.error("content-lab-discover error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const POOL_FRESH_DAYS = 14;

async function queuePoolRefreshIfStale(args: {
  admin: ReturnType<typeof createClient>;
  niche_tag: string;
  hashtags: string[];
  keywords: string[];
  org_id: string | null;
}): Promise<void> {
  // Skip if any verified pool entry exists for this niche_tag refreshed in the last POOL_FRESH_DAYS.
  const cutoff = new Date(Date.now() - POOL_FRESH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: fresh } = await args.admin
    .from("content_lab_benchmark_pool")
    .select("id")
    .eq("niche_tag", args.niche_tag)
    .eq("status", "verified")
    .gte("verified_at", cutoff)
    .limit(1);
  if (fresh && fresh.length > 0) {
    console.log(`Pool already fresh for ${args.niche_tag}, skipping refresh queue`);
    return;
  }

  // Fire-and-forget. We don't await the response so discover stays fast.
  fetch(`${SUPABASE_URL}/functions/v1/content-lab-pool-refresh`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      niche_tag: args.niche_tag,
      hashtags: args.hashtags,
      keywords: args.keywords,
      platforms: ["instagram"],
      org_id: args.org_id,
    }),
  }).catch((e) => console.error("Pool refresh fire-and-forget failed:", e));
}

async function scrapeSite(url: string): Promise<string> {
  const target = url.startsWith("http") ? url : `https://${url}`;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: target,
        formats: ["markdown", "summary"],
        onlyMainContent: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Firecrawl error:", res.status, JSON.stringify(data));
      return "";
    }
    const md = data.markdown ?? data.data?.markdown ?? "";
    const summary = data.summary ?? data.data?.summary ?? "";
    return `${summary}\n\n${md}`.slice(0, 6000);
  } catch (e) {
    console.error("Firecrawl fetch failed:", e);
    return "";
  }
}

interface DiscoveryPromptInput {
  own_handle: string;
  website: string;
  location: string | null;
  language: string;
  site_summary: string;
  brand_brief: BrandBrief | null;
}

function formatBrief(b: BrandBrief | null): string {
  if (!b) return "";
  const lines: string[] = ["", "Founder-supplied brand brief:"];
  if (b.niche) lines.push(`- Niche they say they're in: ${b.niche}`);
  if (b.positioning) lines.push(`- Positioning: ${b.positioning}`);
  if (b.offers?.length) lines.push(`- What they sell/do: ${b.offers.join("; ")}`);
  if (b.audience_who) lines.push(`- Audience: ${b.audience_who}`);
  if (b.audience_problem) lines.push(`- Audience problem: ${b.audience_problem}`);
  if (b.audience_where) lines.push(`- Where audience hangs out: ${b.audience_where}`);
  if (b.tones?.length) lines.push(`- Preferred tones: ${b.tones.join(", ")}`);
  if (b.never_do?.length) lines.push(`- Never say/do: ${b.never_do.join("; ")}`);
  if (b.producer) lines.push(`- Producer: ${b.producer}`);
  if (b.goal) lines.push(`- Primary goal: ${b.goal}`);
  return lines.join("\n");
}

async function runDiscovery(input: DiscoveryPromptInput): Promise<DiscoveryResult> {
  const systemPrompt = [
    `You are the Head of Creative Direction at a top-tier social agency in ${CURRENT_YEAR}, with 12+ years identifying who the real best-in-class creators are in any vertical.`,
    "Given a brand's website + their handle + location + structured brand brief,",
    "you identify their PRECISE niche and produce TWO ranked lists:",
    "1) top_global_benchmarks: EXACTLY 10 worldwide best-in-class accounts in this niche, RANKED BY TYPICAL REEL VIEWS (not engagement rate, not vibes — raw view count is the signal). These are the accounts you would tell the client to study and reverse-engineer.",
    "2) top_competitors: up to 5 local/regional competitors operating in the same market.",
    "",
    "Hard rules:",
    "- Be ruthlessly specific. 'London wedding photographers serving £5k+ weddings' beats 'photographers'.",
    "- For benchmarks, list real, verifiable Instagram handles you are highly confident exist and currently post in this niche. If unsure about a handle, OMIT it — never invent.",
    "- Benchmarks must actually post the kind of short-form content this brand could film. A talking-head expert is not a benchmark for a wordless aesthetic brand.",
    "- For each benchmark, give a 1-line reason that names their typical view range (rough est_avg_views like '500k-2M') and what mechanic makes them work.",
    "- Default creative prefs should be tight and tailored — not generic.",
  ].join("\n");

  const userPrompt = [
    `Brand handle: @${(input.own_handle ?? "").replace(/^@/, "")}`,
    `Website: ${input.website}`,
    input.location ? `Location/market: ${input.location}` : "",
    `Output language: ${input.language}`,
    formatBrief(input.brand_brief),
    "",
    "Website content (excerpt):",
    input.site_summary || "(no website content available — work from handle + brief + location alone)",
  ].filter(Boolean).join("\n");

  const tool = {
    type: "function",
    function: {
      name: "return_discovery",
      description: "Return the niche discovery result.",
      parameters: {
        type: "object",
        properties: {
          niche_label: { type: "string", description: "Specific niche label." },
          niche_description: { type: "string", description: "1-2 sentence description of the niche, audience and offer." },
          top_competitors: {
            type: "array",
            description: "Up to 5 local/regional competitors.",
            items: {
              type: "object",
              properties: {
                handle: { type: "string", description: "Instagram handle without @" },
                platform: { type: "string", enum: ["instagram", "tiktok", "facebook"] },
                reason: { type: "string" },
              },
              required: ["handle", "platform", "reason"],
              additionalProperties: false,
            },
          },
          top_global_benchmarks: {
            type: "array",
            description: "EXACTLY 10 worldwide best-in-class accounts ranked by typical reel views.",
            minItems: 10,
            maxItems: 10,
            items: {
              type: "object",
              properties: {
                handle: { type: "string" },
                platform: { type: "string", enum: ["instagram", "tiktok", "facebook"] },
                reason: { type: "string", description: "1 line: their mechanic + why they're top." },
                est_avg_views: { type: "string", description: "Rough typical reel views, e.g. '500k-2M'." },
              },
              required: ["handle", "platform", "reason", "est_avg_views"],
              additionalProperties: false,
            },
          },
          suggested_hashtags: { type: "array", items: { type: "string" }, description: "8 niche-specific hashtags without #." },
          suggested_keywords: { type: "array", items: { type: "string" }, description: "8 search keywords used by their audience." },
          default_creative_prefs: {
            type: "object",
            properties: {
              tone_of_voice: { type: "string", enum: ["professional", "conversational", "witty", "bold", "educational", "inspiring"] },
              content_styles: {
                type: "array",
                items: { type: "string", enum: ["talking_head", "b_roll_creative", "voiceover_only", "ugc_style", "tutorial", "behind_the_scenes"] },
              },
              producer_type: { type: "string", enum: ["internal_team", "freelancer", "agency", "founder_on_phone"] },
              video_length_preference: { type: "string", enum: ["15s", "30s", "60s", "90s"] },
              posting_cadence: { type: "string", enum: ["daily", "3x_week", "weekly"] },
              do_not_use: { type: "array", items: { type: "string" }, description: "3-6 items the brand should avoid." },
            },
            required: ["tone_of_voice", "content_styles", "producer_type", "video_length_preference", "posting_cadence", "do_not_use"],
            additionalProperties: false,
          },
        },
        required: [
          "niche_label", "niche_description", "top_competitors", "top_global_benchmarks",
          "suggested_hashtags", "suggested_keywords", "default_creative_prefs",
        ],
        additionalProperties: false,
      },
    },
  };

  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "return_discovery" } },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("AI rate limit. Please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Top up Lovable AI to continue.");
    throw new Error(`AI gateway error ${res.status}: ${t}`);
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("AI did not return discovery payload");
  }
  return JSON.parse(toolCall.function.arguments) as DiscoveryResult;
}
