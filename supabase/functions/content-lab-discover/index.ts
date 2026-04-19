// content-lab-discover: takes own_handle + website + location, returns niche label,
// description, top competitors, top global benchmarks, suggested hashtags/keywords,
// and default creative preferences. Uses Firecrawl to read the website and Lovable AI
// (Gemini) for the structured output via tool calling.

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
const MODEL = "google/gemini-2.5-pro"; // reasoning quality matters here

interface DiscoverInput {
  niche_id?: string;          // existing niche to update
  client_id?: string;         // OR client + new niche params
  org_id?: string;
  own_handle: string;
  website: string;
  location?: string;
  language?: string;
}

interface DiscoveryResult {
  niche_label: string;
  niche_description: string;
  top_competitors: Array<{ handle: string; platform: string; reason: string }>;
  top_global_benchmarks: Array<{ handle: string; platform: string; reason: string }>;
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
    if (!input.own_handle || !input.website) {
      return json({ error: "own_handle and website are required" }, 400);
    }

    // 1. Scrape website
    const siteSummary = await scrapeSite(input.website);
    console.log("Site scraped:", siteSummary.length, "chars");

    // 2. Call Gemini for structured discovery
    const discovery = await runDiscovery({
      own_handle: input.own_handle,
      website: input.website,
      location: input.location ?? null,
      language: input.language ?? "en",
      site_summary: siteSummary,
    });

    // 3. Persist to niche if niche_id provided, else just return
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (input.niche_id) {
      const { error: uErr } = await admin
        .from("content_lab_niches")
        .update({
          own_handle: input.own_handle,
          website: input.website,
          location: input.location ?? null,
          label: discovery.niche_label,
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
          discovered_at: new Date().toISOString(),
        })
        .eq("id", input.niche_id);
      if (uErr) return json({ error: uErr.message }, 500);
    }

    return json({ ok: true, discovery });
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

async function scrapeSite(url: string): Promise<string> {
  // Normalise URL
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
      return ""; // non-fatal — discovery still runs from handle alone
    }
    const md = data.markdown ?? data.data?.markdown ?? "";
    const summary = data.summary ?? data.data?.summary ?? "";
    // Cap to ~6k chars to keep prompt small
    const combined = `${summary}\n\n${md}`.slice(0, 6000);
    return combined;
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
}

async function runDiscovery(input: DiscoveryPromptInput): Promise<DiscoveryResult> {
  const systemPrompt = [
    "You are a senior content strategist and competitive researcher.",
    "Given a brand's website content + their social handle + their location,",
    "you identify their precise niche, the top local/regional competitors,",
    "the top worldwide best-in-class accounts in that niche,",
    "and recommend sensible default creative preferences for short-form video.",
    "",
    "Be specific. 'London wedding photographers' beats 'photographers'.",
    "For competitors, list real Instagram handles you are highly confident exist.",
    "If unsure about a handle, omit it — never invent.",
    "For global benchmarks, pick accounts widely recognised as best-in-class in that niche worldwide.",
  ].join("\n");

  const userPrompt = [
    `Brand handle: @${input.own_handle.replace(/^@/, "")}`,
    `Website: ${input.website}`,
    input.location ? `Location/market: ${input.location}` : "",
    `Output language: ${input.language}`,
    "",
    "Website content (excerpt):",
    input.site_summary || "(no website content available — work from handle + location alone)",
  ].filter(Boolean).join("\n");

  const tool = {
    type: "function",
    function: {
      name: "return_discovery",
      description: "Return the niche discovery result.",
      parameters: {
        type: "object",
        properties: {
          niche_label: { type: "string", description: "Specific niche label, e.g. 'London wedding photographers'" },
          niche_description: { type: "string", description: "1-2 sentence description of the niche, audience and offer." },
          top_competitors: {
            type: "array",
            description: "Up to 10 local/regional competitors in the same niche.",
            items: {
              type: "object",
              properties: {
                handle: { type: "string", description: "Instagram handle without @" },
                platform: { type: "string", enum: ["instagram", "tiktok", "facebook"] },
                reason: { type: "string", description: "1 line on why they're a competitor." },
              },
              required: ["handle", "platform", "reason"],
              additionalProperties: false,
            },
          },
          top_global_benchmarks: {
            type: "array",
            description: "Up to 10 worldwide best-in-class accounts in the same niche.",
            items: {
              type: "object",
              properties: {
                handle: { type: "string" },
                platform: { type: "string", enum: ["instagram", "tiktok", "facebook"] },
                reason: { type: "string" },
              },
              required: ["handle", "platform", "reason"],
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
