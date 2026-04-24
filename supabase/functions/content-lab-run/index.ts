// content-lab-run: orchestrator for a single Content Lab run.
// POST { client_id } -> { run_id }
//
// Spends 1 credit (refunds on failure), creates a run row, then kicks off
// the pipeline as an EdgeRuntime background task so the HTTP response
// returns immediately. Live status is written to content_lab_run_progress.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { runApifyActor, preFilterHandle } from "../_shared/contentLabApify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

interface ClientRow {
  id: string;
  org_id: string;
  company_name: string;
  industry: string | null;
  location: string | null;
  website: string | null;
  competitors: string | null;
  social_handles: Record<string, string | null> | null;
  brand_voice: string | null;
  unique_selling_points: string | null;
  business_goals: string | null;
  target_audience: string | null;
}

interface DiscoverResult {
  competitors: Array<{ handle: string; platform: string; reason: string }>;
  viral_accounts: Array<{ handle: string; platform: string; reason: string }>;
  viral_hashtags: string[];
}

// ─── progress logger ──────────────────────────────────────────────────────────
async function logProgress(
  admin: SupabaseClient,
  runId: string,
  phase: string,
  status: "started" | "ok" | "failed" | "warn",
  message?: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  await admin.from("content_lab_run_progress").insert({
    run_id: runId,
    phase,
    status,
    message: message ?? null,
    payload: payload ?? {},
  });
  await admin
    .from("content_lab_runs")
    .update({ current_phase: phase, updated_at: new Date().toISOString() })
    .eq("id", runId);
}

// ─── Lovable AI structured-output helper ──────────────────────────────────────
async function callLovableAI(opts: {
  model: string;
  system: string;
  user: string;
  tool?: { name: string; parameters: Record<string, unknown> };
  maxTokens?: number;
}): Promise<{ ok: boolean; content?: string; toolArgs?: Record<string, unknown>; error?: string }> {
  if (!LOVABLE_API_KEY) return { ok: false, error: "LOVABLE_API_KEY missing" };
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    max_tokens: opts.maxTokens ?? 4000,
  };
  if (opts.tool) {
    body.tools = [{
      type: "function",
      function: { name: opts.tool.name, description: "Return structured output", parameters: opts.tool.parameters },
    }];
    body.tool_choice = { type: "function", function: { name: opts.tool.name } };
  }
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `${res.status}: ${t.slice(0, 300)}` };
  }
  const json = await res.json();
  const choice = json?.choices?.[0]?.message;
  if (opts.tool) {
    const args = choice?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { ok: false, error: "No tool_call in AI response" };
    try { return { ok: true, toolArgs: JSON.parse(args) }; }
    catch { return { ok: false, error: "Could not parse tool_call args" }; }
  }
  return { ok: true, content: String(choice?.content ?? "") };
}

// ─── PHASE: discover competitors + viral accounts + hashtags ──────────────────

interface CompetitorSeed { name: string; website?: string; }

/** Parse "Name | https://site" lines (or comma-separated names) from clients.competitors. */
function parseCompetitorSeeds(raw: string | null): CompetitorSeed[] {
  if (!raw) return [];
  const hasNew = raw.includes("\n") || raw.includes("|");
  const lines = hasNew ? raw.split("\n") : raw.split(",");
  return lines
    .map((l) => l.trim()).filter(Boolean)
    .map((line) => {
      const [name, website] = line.split("|").map((p) => p.trim());
      const w = website && /^https?:\/\//i.test(website) ? website : undefined;
      return { name: name || website || "", website: w };
    })
    .filter((c) => c.name);
}

interface ResolvedCompetitor extends CompetitorSeed {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
}

/** Call firecrawl-find-socials for one URL. Never throws. */
async function fetchCompetitorSocials(url: string): Promise<{ instagram?: string; tiktok?: string; facebook?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/firecrawl-find-socials`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return {};
    const data = await res.json().catch(() => ({}));
    return {
      instagram: typeof data?.instagram === "string" ? data.instagram : undefined,
      tiktok: typeof data?.tiktok === "string" ? data.tiktok : undefined,
      facebook: typeof data?.facebook === "string" ? data.facebook : undefined,
    };
  } catch {
    return {};
  }
}

/** Resolve socials for up to N seeds in parallel batches of 5. */
async function resolveCompetitorSocials(seeds: CompetitorSeed[]): Promise<ResolvedCompetitor[]> {
  const out: ResolvedCompetitor[] = [];
  const withSites = seeds.filter((s) => s.website);
  const withoutSites = seeds.filter((s) => !s.website);
  for (let i = 0; i < withSites.length; i += 5) {
    const batch = withSites.slice(i, i + 5);
    const results = await Promise.all(batch.map((s) => fetchCompetitorSocials(s.website!)));
    batch.forEach((s, idx) => out.push({ ...s, ...results[idx] }));
  }
  return [...out, ...withoutSites];
}

async function phaseDiscover(
  admin: SupabaseClient,
  runId: string,
  client: ClientRow,
): Promise<DiscoverResult> {
  const seeds = parseCompetitorSeeds(client.competitors).slice(0, 8);
  const handles = client.social_handles ?? {};
  const ownHandles = Object.entries(handles)
    .filter(([, v]) => v).map(([k, v]) => `${k}: @${v}`).join(", ");

  // Step A: scrape each competitor's website to find their real socials.
  const resolved = await resolveCompetitorSocials(seeds);
  const verifiedFacts = resolved
    .map((c) => {
      const socials: string[] = [];
      if (c.instagram) socials.push(`IG @${c.instagram}`);
      if (c.tiktok) socials.push(`TikTok @${c.tiktok}`);
      if (c.facebook) socials.push(`FB ${c.facebook}`);
      return socials.length
        ? `- ${c.name} (${c.website ?? "no website"}) → ${socials.join(", ")}`
        : `- ${c.name} (${c.website ?? "no website"}) → no socials found`;
    })
    .join("\n");

  const verifiedCount = resolved.filter((c) => c.instagram || c.tiktok).length;
  await logProgress(admin, runId, "discover", "ok", `Resolved socials for ${verifiedCount}/${seeds.length} competitor websites`, {
    resolved: resolved.map((c) => ({ name: c.name, instagram: c.instagram, tiktok: c.tiktok })),
  });

  const userPrompt = `Client: ${client.company_name}
Industry: ${client.industry ?? "unknown"}
Location: ${client.location ?? "unknown"}
Website: ${client.website ?? "unknown"}
Their own social: ${ownHandles || "none"}

VERIFIED competitor socials (scraped from their actual websites — use these EXACTLY as provided, do NOT change or guess them):
${verifiedFacts || "(none provided)"}

Task:
1. Build a list of up to 10 LOCAL competitors with their Instagram OR TikTok handle.
   - FIRST include every VERIFIED handle above as-is (one entry per platform per competitor).
   - THEN top up to 10 with additional same-industry / same-location competitors you know about.
2. List 10 VIRAL WORLDWIDE accounts in this industry/niche (any country, just very high engagement) with their Instagram OR TikTok handle.
3. List 3 niche hashtags (no #, no spaces) that get viral content in this niche.

Rules: handles must be plausible real accounts (no spaces, no "ltd"). Verified handles always win — never overwrite them with a guess.`;

  const r = await callLovableAI({
    model: "google/gemini-2.5-pro",
    system: "You are a social-media research assistant. Return ONLY structured data via the tool call.",
    user: userPrompt,
    maxTokens: 3000,
    tool: {
      name: "submit_discovery",
      parameters: {
        type: "object",
        properties: {
          competitors: {
            type: "array", maxItems: 10,
            items: {
              type: "object",
              properties: {
                handle: { type: "string" },
                platform: { type: "string", enum: ["instagram", "tiktok"] },
                reason: { type: "string" },
              },
              required: ["handle", "platform", "reason"],
            },
          },
          viral_accounts: {
            type: "array", maxItems: 10,
            items: {
              type: "object",
              properties: {
                handle: { type: "string" },
                platform: { type: "string", enum: ["instagram", "tiktok"] },
                reason: { type: "string" },
              },
              required: ["handle", "platform", "reason"],
            },
          },
          viral_hashtags: { type: "array", maxItems: 3, items: { type: "string" } },
        },
        required: ["competitors", "viral_accounts", "viral_hashtags"],
      },
    },
  });
  if (!r.ok || !r.toolArgs) throw new Error(`Discover failed: ${r.error}`);
  const out = r.toolArgs as DiscoverResult;
  // Pre-filter
  out.competitors = (out.competitors ?? []).filter((c) => preFilterHandle(c.platform, c.handle));
  out.viral_accounts = (out.viral_accounts ?? []).filter((c) => preFilterHandle(c.platform, c.handle));
  out.viral_hashtags = (out.viral_hashtags ?? []).map((h) => h.replace(/^#/, "").trim()).filter(Boolean);
  return out;
}

// ─── PHASE: scrape (own + competitors + viral) ────────────────────────────────
interface RawPost {
  bucket: "own" | "competitor" | "viral";
  platform: string;
  author_handle: string;
  author_display_name?: string | null;
  author_followers?: number | null;
  post_url?: string | null;
  external_id?: string | null;
  post_type?: string | null;
  caption?: string | null;
  thumbnail_url?: string | null;
  hashtags: string[];
  mentions: string[];
  likes: number;
  comments: number;
  shares: number;
  views: number;
  video_duration_seconds?: number | null;
  posted_at?: string | null;
  source_query?: string | null;
}

const RECENT_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000;

function isRecent(iso: string | null | undefined): boolean {
  if (!iso) return true; // keep when unknown
  const t = Date.parse(iso);
  if (isNaN(t)) return true;
  return Date.now() - t < RECENT_CUTOFF_MS;
}

function calcEngagement(p: RawPost): number {
  const audience = Math.max(p.author_followers ?? 0, p.views ?? 0, 1);
  return (p.likes + p.comments + p.shares) / audience;
}

/**
 * Coerce scraper values (often floats like 42.281 for video duration) to
 * integers so DB inserts into integer columns don't fail with
 * "invalid input syntax for type integer".
 */
function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  return Math.round(n);
}

interface IGItem {
  id?: string; shortCode?: string; url?: string; type?: string;
  caption?: string; displayUrl?: string; videoUrl?: string;
  ownerUsername?: string; ownerFullName?: string;
  likesCount?: number; commentsCount?: number; videoViewCount?: number;
  videoPlayCount?: number; videoDuration?: number;
  timestamp?: string; hashtags?: string[]; mentions?: string[];
}

function mapIG(item: IGItem, bucket: RawPost["bucket"], handle: string): RawPost {
  return {
    bucket,
    platform: "instagram",
    author_handle: item.ownerUsername ?? handle,
    author_display_name: item.ownerFullName ?? null,
    author_followers: null,
    post_url: item.url ?? (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : null),
    external_id: item.id ?? item.shortCode ?? null,
    post_type: item.type ?? null,
    caption: item.caption ?? null,
    thumbnail_url: item.displayUrl ?? null,
    hashtags: item.hashtags ?? [],
    mentions: item.mentions ?? [],
    likes: item.likesCount ?? 0,
    comments: item.commentsCount ?? 0,
    shares: 0,
    views: item.videoPlayCount ?? item.videoViewCount ?? 0,
    video_duration_seconds: item.videoDuration ?? null,
    posted_at: item.timestamp ?? null,
  };
}

interface TTItem {
  id?: string; webVideoUrl?: string; text?: string; createTimeISO?: string;
  authorMeta?: { name?: string; nickName?: string; fans?: number };
  videoMeta?: { coverUrl?: string; duration?: number };
  diggCount?: number; commentCount?: number; shareCount?: number; playCount?: number;
  hashtags?: Array<{ name?: string }>;
}

function mapTT(item: TTItem, bucket: RawPost["bucket"], handle: string): RawPost {
  return {
    bucket,
    platform: "tiktok",
    author_handle: item.authorMeta?.name ?? handle,
    author_display_name: item.authorMeta?.nickName ?? null,
    author_followers: item.authorMeta?.fans ?? null,
    post_url: item.webVideoUrl ?? null,
    external_id: item.id ?? null,
    post_type: "video",
    caption: item.text ?? null,
    thumbnail_url: item.videoMeta?.coverUrl ?? null,
    hashtags: (item.hashtags ?? []).map((h) => h.name ?? "").filter(Boolean),
    mentions: [],
    likes: item.diggCount ?? 0,
    comments: item.commentCount ?? 0,
    shares: item.shareCount ?? 0,
    views: item.playCount ?? 0,
    video_duration_seconds: item.videoMeta?.duration ?? null,
    posted_at: item.createTimeISO ?? null,
  };
}

async function scrapeIG(handles: string[], bucket: RawPost["bucket"], maxPerHandle: number): Promise<RawPost[]> {
  if (handles.length === 0) return [];
  const r = await runApifyActor<IGItem>({
    actor: "apify~instagram-scraper",
    input: { directUrls: handles.map((h) => `https://www.instagram.com/${h}/`), resultsType: "posts", resultsLimit: maxPerHandle, addParentData: false },
    timeoutSec: 120, maxItems: handles.length * maxPerHandle,
  });
  if (!r.ok) return [];
  return r.items.map((item) => mapIG(item, bucket, item.ownerUsername ?? "")).filter((p) => isRecent(p.posted_at));
}

async function scrapeTT(handles: string[], bucket: RawPost["bucket"], maxPerHandle: number): Promise<RawPost[]> {
  if (handles.length === 0) return [];
  const r = await runApifyActor<TTItem>({
    actor: "clockworks~tiktok-scraper",
    input: { profiles: handles, resultsPerPage: maxPerHandle, profileScrapeSections: ["videos"], shouldDownloadVideos: false, shouldDownloadCovers: false },
    timeoutSec: 120, maxItems: handles.length * maxPerHandle,
  });
  if (!r.ok) return [];
  return r.items.map((item) => mapTT(item, bucket, item.authorMeta?.name ?? "")).filter((p) => isRecent(p.posted_at));
}

async function scrapeIGHashtag(tag: string): Promise<RawPost[]> {
  const r = await runApifyActor<IGItem>({
    actor: "apify~instagram-hashtag-scraper",
    input: { hashtags: [tag], resultsLimit: 30 },
    timeoutSec: 90, maxItems: 30,
  });
  if (!r.ok) return [];
  return r.items.map((item) => {
    const p = mapIG(item, "viral", item.ownerUsername ?? "");
    p.source_query = `#${tag}`;
    return p;
  }).filter((p) => isRecent(p.posted_at));
}

function dedupePosts(posts: RawPost[]): RawPost[] {
  const seen = new Set<string>();
  const out: RawPost[] = [];
  for (const p of posts) {
    const week = p.posted_at ? new Date(p.posted_at).toISOString().slice(0, 10) : "x";
    const key = `${(p.caption ?? "").slice(0, 80).toLowerCase().replace(/\s+/g, " ").trim()}|${week}`;
    if (key.length < 5) { out.push(p); continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

async function phaseScrape(
  admin: SupabaseClient,
  runId: string,
  client: ClientRow,
  discover: DiscoverResult,
): Promise<RawPost[]> {
  const ownIG: string[] = [];
  const ownTT: string[] = [];
  const handles = client.social_handles ?? {};
  if (typeof handles.instagram === "string") ownIG.push(handles.instagram.replace(/^@/, ""));
  if (typeof handles.tiktok === "string") ownTT.push(handles.tiktok.replace(/^@/, ""));

  const compIG = discover.competitors.filter((c) => c.platform === "instagram").map((c) => c.handle);
  const compTT = discover.competitors.filter((c) => c.platform === "tiktok").map((c) => c.handle);
  const viralIG = discover.viral_accounts.filter((c) => c.platform === "instagram").map((c) => c.handle);
  const viralTT = discover.viral_accounts.filter((c) => c.platform === "tiktok").map((c) => c.handle);

  // Run scrapes in parallel — semaphore inside runApifyActor caps concurrency at 5.
  const [r1, r2, r3, r4, r5, r6, ...hashtagResults] = await Promise.all([
    scrapeIG(ownIG, "own", 12),
    scrapeTT(ownTT, "own", 12),
    scrapeIG(compIG, "competitor", 6),
    scrapeTT(compTT, "competitor", 6),
    scrapeIG(viralIG, "viral", 6),
    scrapeTT(viralTT, "viral", 6),
    ...discover.viral_hashtags.slice(0, 3).map((t) => scrapeIGHashtag(t)),
  ]);

  await logProgress(admin, runId, "scrape", "ok", "Scrape pools fetched", {
    own_ig: r1.length, own_tt: r2.length,
    comp_ig: r3.length, comp_tt: r4.length,
    viral_ig: r5.length, viral_tt: r6.length,
    viral_hashtag: hashtagResults.reduce((s, a) => s + a.length, 0),
  });

  const all: RawPost[] = [...r1, ...r2, ...r3, ...r4, ...r5, ...r6, ...hashtagResults.flat()];
  for (const p of all) p.likes = Math.max(0, p.likes | 0);
  return dedupePosts(all);
}

// ─── PHASE: persist scraped posts ─────────────────────────────────────────────
async function persistPosts(admin: SupabaseClient, runId: string, posts: RawPost[]): Promise<string[]> {
  if (posts.length === 0) return [];
  const rows = posts.map((p) => ({
    run_id: runId,
    bucket: p.bucket,
    platform: p.platform,
    author_handle: p.author_handle,
    author_display_name: p.author_display_name ?? null,
    // Scrapers occasionally return floats for counts; DB columns are integers.
    author_followers: toInt(p.author_followers),
    post_url: p.post_url ?? null,
    external_id: p.external_id ?? null,
    post_type: p.post_type ?? null,
    caption: p.caption ?? null,
    thumbnail_url: p.thumbnail_url ?? null,
    hashtags: p.hashtags ?? [],
    mentions: p.mentions ?? [],
    likes: toInt(p.likes) ?? 0,
    comments: toInt(p.comments) ?? 0,
    shares: toInt(p.shares) ?? 0,
    views: toInt(p.views) ?? 0,
    engagement_rate: calcEngagement(p),
    video_duration_seconds: toInt(p.video_duration_seconds),
    posted_at: p.posted_at ?? null,
    source_query: p.source_query ?? null,
  }));
  const { data, error } = await admin.from("content_lab_posts").insert(rows).select("id");
  if (error) throw new Error(`persistPosts: ${error.message}`);
  return (data ?? []).map((r: { id: string }) => r.id);
}

// ─── PHASE: analyse (Haiku-style hook tagging via Lovable AI) ─────────────────
async function phaseAnalyse(
  admin: SupabaseClient,
  runId: string,
): Promise<void> {
  const { data: posts, error } = await admin
    .from("content_lab_posts")
    .select("id, caption, platform")
    .eq("run_id", runId)
    .not("caption", "is", null);
  if (error) throw error;
  if (!posts || posts.length === 0) return;

  // Batch in groups of 30 to keep prompt size sane
  const groups: Array<typeof posts> = [];
  for (let i = 0; i < posts.length; i += 30) groups.push(posts.slice(i, i + 30));

  for (const grp of groups) {
    const items = grp.map((p, idx) => `[${idx}] (${p.platform}) ${(p.caption ?? "").slice(0, 280).replace(/\n/g, " ")}`).join("\n");
    const r = await callLovableAI({
      model: "google/gemini-2.5-flash",
      system: "You analyse social-media captions and return structured tags.",
      user: `For each numbered post below, identify:
- hook_type: one of [question, statistic, story, contrarian, transformation, list, howto, none]
- hook_text: the first compelling sentence (max 100 chars)
- pattern_tag: one short label describing the content pattern (e.g. "before-after", "behind-the-scenes", "tutorial", "trend-react")

Posts:
${items}`,
      maxTokens: 2000,
      tool: {
        name: "submit_tags",
        parameters: {
          type: "object",
          properties: {
            tags: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "integer" },
                  hook_type: { type: "string" },
                  hook_text: { type: "string" },
                  pattern_tag: { type: "string" },
                },
                required: ["index", "hook_type", "hook_text", "pattern_tag"],
              },
            },
          },
          required: ["tags"],
        },
      },
    });
    if (!r.ok || !r.toolArgs) continue;
    const tags = (r.toolArgs.tags as Array<{ index: number; hook_type: string; hook_text: string; pattern_tag: string }>) ?? [];
    for (const t of tags) {
      const post = grp[t.index];
      if (!post) continue;
      await admin.from("content_lab_posts").update({
        hook_type: t.hook_type, hook_text: t.hook_text, pattern_tag: t.pattern_tag,
      }).eq("id", post.id);
    }
  }
}

// ─── PHASE: ideate — call ideate function ─────────────────────────────────────
async function phaseIdeate(runId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/content-lab-ideate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ run_id: runId }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ideate failed: ${res.status} ${t.slice(0, 200)}`);
  }
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────
async function runPipeline(
  admin: SupabaseClient,
  runId: string,
  client: ClientRow,
  ledgerId: string,
): Promise<void> {
  try {
    await admin.from("content_lab_runs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", runId);

    // 1. Discover
    await logProgress(admin, runId, "discover", "started");
    const discover = await phaseDiscover(admin, runId, client);
    await admin.from("content_lab_runs").update({
      summary: { ...(client as unknown as Record<string, unknown>), discover },
    }).eq("id", runId);
    await logProgress(admin, runId, "discover", "ok", `Found ${discover.competitors.length} competitors, ${discover.viral_accounts.length} viral accounts, ${discover.viral_hashtags.length} hashtags`);

    // 2. Scrape
    await logProgress(admin, runId, "scrape", "started");
    const posts = await phaseScrape(admin, runId, client, discover);
    await persistPosts(admin, runId, posts);

    // 3. Analyse
    await logProgress(admin, runId, "analyse", "started");
    await phaseAnalyse(admin, runId);
    await logProgress(admin, runId, "analyse", "ok", "Tagged hooks & patterns");

    // 4. Ideate
    await logProgress(admin, runId, "ideate", "started");
    await phaseIdeate(runId);
    await logProgress(admin, runId, "ideate", "ok", "Generated 30 ideas");

    await admin.from("content_lab_runs").update({
      status: "completed", completed_at: new Date().toISOString(), current_phase: "completed",
    }).eq("id", runId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[content-lab-run] failed:", msg);
    await logProgress(admin, runId, "pipeline", "failed", msg);
    await admin.from("content_lab_runs").update({
      status: "failed", error_message: msg, completed_at: new Date().toISOString(),
    }).eq("id", runId);
    // Refund credit
    if (ledgerId) {
      try {
        await admin.rpc("refund_content_lab_credit", { _ledger_id: ledgerId, _refund_reason: `run_failed: ${msg.slice(0, 200)}` });
      } catch (refundErr) {
        console.error("[content-lab-run] refund failed:", refundErr);
      }
    }
  }
}

// ─── HTTP entry ───────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid auth" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const clientId = String(body?.client_id ?? "").trim();
    if (!clientId) return json({ error: "client_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load client + verify membership
    const { data: client, error: cErr } = await admin
      .from("clients")
      .select("id, org_id, company_name, industry, location, website, competitors, social_handles, brand_voice, unique_selling_points, business_goals, target_audience")
      .eq("id", clientId).maybeSingle();
    if (cErr || !client) return json({ error: "Client not found" }, 404);

    const { data: membership } = await admin
      .from("org_members").select("user_id").eq("org_id", client.org_id).eq("user_id", userId).maybeSingle();
    if (!membership) return json({ error: "Not a member of this org" }, 403);

    // Spend credit
    let ledgerId = "";
    try {
      const { data: ledger, error: spendErr } = await admin.rpc("spend_content_lab_credit", {
        _org_id: client.org_id, _amount: 1, _reason: "run_consumed",
      });
      if (spendErr) throw spendErr;
      ledgerId = String(ledger);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("INSUFFICIENT_CREDITS")) return json({ error: "Insufficient credits" }, 402);
      return json({ error: `Credit spend failed: ${msg}` }, 500);
    }

    // Snapshot client (parse competitors into structured list for prompts)
    const competitorsList = (client.competitors ?? "")
      .split(/\n|,/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, website] = line.split("|").map((p) => p.trim());
        return { name: name || website || "", website: website && /^https?:\/\//i.test(website) ? website : null };
      });

    const snapshot = {
      company_name: client.company_name,
      industry: client.industry,
      location: client.location,
      website: client.website,
      competitors: client.competitors,
      competitors_list: competitorsList,
      social_handles: client.social_handles,
      brand_voice: client.brand_voice,
      target_audience: client.target_audience,
    };

    const { data: run, error: runErr } = await admin.from("content_lab_runs").insert({
      org_id: client.org_id,
      client_id: client.id,
      triggered_by: userId,
      status: "pending",
      client_snapshot: snapshot,
    }).select("id").single();
    if (runErr || !run) {
      // Refund
      try { await admin.rpc("refund_content_lab_credit", { _ledger_id: ledgerId, _refund_reason: "run_create_failed" }); } catch { /* ignore */ }
      return json({ error: `Could not create run: ${runErr?.message}` }, 500);
    }

    await admin.rpc("increment_content_lab_usage", { _org_id: client.org_id });

    // Kick off pipeline as a background task — HTTP returns immediately.
    // deno-lint-ignore no-explicit-any
    const edgeRuntime = (globalThis as any).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(runPipeline(admin, run.id, client as ClientRow, ledgerId));
    } else {
      // Fallback (shouldn't happen in production)
      runPipeline(admin, run.id, client as ClientRow, ledgerId);
    }

    return json({ run_id: run.id });
  } catch (e) {
    console.error("[content-lab-run] error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
