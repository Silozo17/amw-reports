// content-lab-scrape: pulls posts for a run.
//
// v3 spec changes:
//  - Own posts: 8 per enabled platform (was 15 IG-heavy).
//  - Benchmarks/competitors: 4 latest per account per enabled platform (was 6/8 from a few).
//  - Cross-platform dedupe by caption fingerprint + same posted week.
//  - Per-platform retry once with longer Apify timeout if a fetch returns 0.
//  - Score every post by views*0.6 + er*views*0.4 and tag the top 10 benchmark + top 10
//    competitor pieces with bucket suffix `_top` so the analyser knows which to deep-analyse.
//  - Hard cap retained at 80 inserted rows.
//
// v4 fixes (this revision):
//  - Facebook actor corrected to apify~facebook-pages-scraper (was wrong actor → 404).
//  - Removed Apify-level date pre-filters on IG + TikTok (starved inactive accounts);
//    code-side recency filter in scrapeBucket handles this correctly with fallback.
//  - All three scrapers now surface their Apify error text to the errors array so
//    failures show up in scrape_errors instead of silent return [].
//  - Renderable filter is now skipped for benchmark + competitor buckets (those are
//    inspiration material — missing engagement fields are not a reason to drop them).
//  - Competitor handle list is deduplicated by handle BEFORE being sliced to 5 so
//    multi-platform entries for the same handle don't eat the slot budget.
//  - TikTok subtitle links are best-effort fetched + parsed into `transcript`
//    (time-boxed, non-blocking — null on any failure).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decryptToken } from "../_shared/tokenCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const APIFY_ACTOR = "apify~instagram-scraper";
const FACEBOOK_ACTOR = "apify~facebook-pages-scraper";

// New spec caps.
const MAX_POSTS_OWN = 8;
const MAX_POSTS_PER_ACCOUNT = 4;
const MAX_COMPETITOR_HANDLES = 5;
const MAX_BENCHMARK_HANDLES = 10;
const MAX_TOTAL_POSTS = 80;
const TOP_BENCHMARK_TO_ANALYSE = 10;
const TOP_COMPETITOR_TO_ANALYSE = 10;
// Recency window for competitor + benchmark posts (current month only).
const RECENT_DAYS = 30;
const RECENT_CUTOFF_MS = RECENT_DAYS * 24 * 60 * 60 * 1000;

const APIFY_CHUNK_SIZE = 5;
const APIFY_TIMEOUT_SEC = 90;
const APIFY_RETRY_TIMEOUT_SEC = 150;

// Best-effort subtitle fetching for TikTok.
const SUBTITLE_FETCH_TIMEOUT_MS = 5000;
const MAX_TRANSCRIPT_CHARS = 2000;

interface DiscoveredEntity { handle: string; platform?: string; reason?: string }

interface ScrapedPost {
  platform: "instagram" | "tiktok" | "facebook";
  source: "oauth" | "apify";
  bucket: "own" | "competitor" | "benchmark" | "legacy";
  author_handle: string;
  post_url: string | null;
  post_type: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  posted_at: string | null;
  transcript: string | null;
  video_duration_seconds: number | null;
  hashtags: string[];
  mentions: string[];
  music_title: string | null;
  music_artist: string | null;
  tagged_users: string[];
  subtitle_links?: Array<{ language?: string; downloadLink?: string }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-scrape", method: req.method }));

  try {
    const { run_id } = await req.json();
    if (!run_id) return json({ error: "run_id is required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: run, error: runErr } = await supabase
      .from("content_lab_runs").select("*, niche:niche_id(*)").eq("id", run_id).single();
    if (runErr || !run) return json({ error: "Run not found" }, 404);

    const niche = (run as { niche: {
      own_handle: string | null;
      niche_tag: string | null;
      tracked_handles: Array<{ platform: string; handle: string }> | null;
      top_competitors: DiscoveredEntity[];
      top_global_benchmarks: DiscoveredEntity[];
      client_id: string;
      platforms_to_scrape: string[] | null;
    } }).niche;

    const enabledPlatforms = (niche.platforms_to_scrape && niche.platforms_to_scrape.length > 0
      ? niche.platforms_to_scrape
      : ['instagram']) as Array<'instagram' | 'tiktok' | 'facebook'>;

    const ownHandlesByPlatform: Partial<Record<'instagram' | 'tiktok' | 'facebook', string>> = {};
    (niche.tracked_handles ?? []).forEach((h) => {
      const p = h.platform as 'instagram' | 'tiktok' | 'facebook';
      if (p && h.handle) ownHandlesByPlatform[p] = h.handle.toLowerCase().replace(/^@/, '');
    });
    if (!ownHandlesByPlatform.instagram && niche.own_handle) {
      ownHandlesByPlatform.instagram = niche.own_handle.toLowerCase().replace(/^@/, '');
    }

    const ownHandleSet = new Set<string>(Object.values(ownHandlesByPlatform).filter((h): h is string => !!h));
    if (niche.own_handle) ownHandleSet.add(niche.own_handle.toLowerCase().replace(/^@/, ""));

    // Dedupe competitor handles BEFORE slicing so multi-platform entries for the same
    // creator (e.g. same handle on IG + TikTok) don't consume multiple slots.
    const competitorSeen = new Set<string>();
    const competitorHandles = (niche.top_competitors ?? [])
      .map((c) => c.handle?.toLowerCase().replace(/^@/, ""))
      .filter((h): h is string => !!h)
      .filter((h) => !ownHandleSet.has(h))
      .filter((h) => {
        if (competitorSeen.has(h)) return false;
        competitorSeen.add(h);
        return true;
      })
      .slice(0, MAX_COMPETITOR_HANDLES);

    const benchmarkHandles = await loadBenchmarkHandles({
      supabase,
      niche_tag: niche.niche_tag,
      enabledPlatforms,
      llmFallback: niche.top_global_benchmarks ?? [],
      ownHandleSet,
    });

    const [ownResult, compResult, benchResult] = await Promise.allSettled([
      scrapeOwn(supabase, niche, enabledPlatforms, ownHandlesByPlatform),
      scrapeBucket(competitorHandles, "competitor", MAX_POSTS_PER_ACCOUNT, enabledPlatforms),
      scrapeBucket(benchmarkHandles, "benchmark", MAX_POSTS_PER_ACCOUNT, enabledPlatforms),
    ]);

    const collected: ScrapedPost[] = [];
    const errors: string[] = [];
    const absorb = (label: string, result: PromiseSettledResult<BucketResult>) => {
      if (result.status === "fulfilled") {
        collected.push(...result.value.posts);
        if (result.value.errors.length > 0) errors.push(...result.value.errors);
      } else {
        const msg = `${label} bucket crashed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`;
        console.error(msg);
        errors.push(msg);
      }
    };
    absorb("own", ownResult);
    absorb("competitor", compResult);
    absorb("benchmark", benchResult);

    // 1) Dedupe by post URL first.
    const seenUrl = new Set<string>();
    let deduped = collected.filter((p) => {
      const key = p.post_url ?? `${p.author_handle}-${p.posted_at}-${p.caption?.slice(0, 40)}`;
      if (seenUrl.has(key)) return false;
      seenUrl.add(key);
      return true;
    });

    // 2) Cross-platform dedupe: same caption fingerprint within the same posted-week.
    //    This collapses the client's own content posted to IG + TikTok + FB into one row.
    deduped = crossPlatformDedupe(deduped);

    // 3) Best-effort transcript fetch for TikTok posts that ship subtitle links.
    //    Runs in parallel with a per-file timeout; any failure just keeps transcript=null.
    await enrichTikTokTranscripts(deduped);

    // 4) Renderable-row filter — only apply to OWN posts. Benchmark + competitor buckets
    //    are inspiration material for the ideator; Apify frequently returns them with
    //    zero engagement / missing fields, and filtering them out silently starves the
    //    inspiration pool. Own posts still get filtered because they're displayed to
    //    the user directly and incomplete rows make the UI look broken.
    deduped = deduped.filter((p) => {
      if (p.bucket === "benchmark" || p.bucket === "competitor") return true;

      const handle = (p.author_handle ?? "").trim().toLowerCase();
      if (!handle || handle === "unknown" || handle === "n/a" || handle === "anonymous") {
        if ((p.views ?? 0) < 1000 && (p.likes ?? 0) < 100) return false;
      }
      const captionLen = (p.caption ?? "").trim().length;
      const hasUrl = !!p.post_url;
      const hasThumb = !!p.thumbnail_url;
      const hasCaption = captionLen >= 10;
      const hasEngagement = (p.views ?? 0) > 0 || (p.likes ?? 0) > 0 || (p.comments ?? 0) > 0;
      const displayFieldCount = (hasUrl ? 1 : 0) + (hasThumb ? 1 : 0) + (hasCaption ? 1 : 0);
      if (displayFieldCount === 0) return false;
      if (displayFieldCount === 1 && !hasEngagement) return false;
      return true;
    });

    // 5) Cap total inserted rows.
    deduped = deduped.slice(0, MAX_TOTAL_POSTS);

    // 5b) Cross-platform benchmark fill: every enabled platform must have benchmark signal.
    // If a platform has 0 benchmark posts after scraping, copy the top 10 benchmark posts
    // from any other platform that has them, re-tagging the platform field. Ensures the
    // ideation step always has reference material to learn from per platform.
    {
      const platformsInRun = new Set<"instagram" | "tiktok" | "facebook">();
      collected.forEach((p) => platformsInRun.add(p.platform));
      const benchByPlatform = new Map<string, typeof deduped>();
      deduped.forEach((p) => {
        if (p.bucket !== "benchmark") return;
        const arr = benchByPlatform.get(p.platform) ?? [];
        arr.push(p);
        benchByPlatform.set(p.platform, arr);
      });
      for (const target of platformsInRun) {
        const targetCount = benchByPlatform.get(target)?.length ?? 0;
        if (targetCount > 0) continue;
        let sourcePlatform: string | null = null;
        let sourcePosts: typeof deduped = [];
        for (const [plat, arr] of benchByPlatform.entries()) {
          if (plat === target) continue;
          if (arr.length > sourcePosts.length) {
            sourcePlatform = plat;
            sourcePosts = arr;
          }
        }
        if (!sourcePlatform || sourcePosts.length === 0) continue;
        const top = [...sourcePosts]
          .sort((a, b) => (b.views - a.views) || (b.likes - a.likes))
          .slice(0, 10)
          .map((p) => ({ ...p, platform: target }));
        deduped.push(...top);
        console.log(`Cross-platform benchmark fill: copied ${top.length} posts from ${sourcePlatform} to ${target}`);
      }
      deduped = deduped.slice(0, MAX_TOTAL_POSTS);
    }

    // 6) Build rows with engagement_rate + score, then mark top-N for analysis via summary.
    const rows = deduped.map((p) => {
      const raw = p.views > 0
        ? (p.likes + p.comments) / p.views
        : (p.likes + p.comments) / Math.max(p.likes + p.comments + 1000, 1000);
      const engagement_rate = Math.min(Math.max(raw, 0), 99.9999);
      return {
        run_id,
        platform: p.platform,
        source: p.source,
        bucket: p.bucket,
        author_handle: p.author_handle,
        post_url: p.post_url,
        post_type: p.post_type,
        caption: p.caption,
        thumbnail_url: p.thumbnail_url,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        views: p.views,
        engagement_rate,
        posted_at: p.posted_at,
        transcript: p.transcript,
        video_duration_seconds: p.video_duration_seconds,
        hashtags: p.hashtags,
        mentions: p.mentions,
        music_title: p.music_title,
        music_artist: p.music_artist,
        tagged_users: p.tagged_users,
      };
    });

    let insertedCount = 0;
    const CHUNK_SIZE = 50;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error: insertErr } = await supabase.from("content_lab_posts").insert(chunk);
      if (insertErr) {
        const msg = `Insert chunk ${i / CHUNK_SIZE + 1} failed: ${insertErr.message}`;
        console.error(msg, insertErr);
        errors.push(msg);
      } else {
        insertedCount += chunk.length;
      }
    }

    // 7) Resolve inserted row IDs and pick the top-N by score per bucket for the analyser.
    const { data: inserted } = await supabase
      .from("content_lab_posts")
      .select("id, bucket, views, engagement_rate")
      .eq("run_id", run_id);
    const score = (v: number, er: number) => v * 0.6 + er * v * 0.4;
    const topBenchmarkIds = pickTop((inserted ?? []), "benchmark", TOP_BENCHMARK_TO_ANALYSE, score);
    const topCompetitorIds = pickTop((inserted ?? []), "competitor", TOP_COMPETITOR_TO_ANALYSE, score);

    const buckets = {
      own: rows.filter((r) => r.bucket === "own").length,
      competitor: rows.filter((r) => r.bucket === "competitor").length,
      benchmark: rows.filter((r) => r.bucket === "benchmark").length,
    };

    const per_platform_counts = {
      instagram: rows.filter((r) => r.platform === "instagram").length,
      tiktok: rows.filter((r) => r.platform === "tiktok").length,
      facebook: rows.filter((r) => r.platform === "facebook").length,
    };

    const { data: existing } = await supabase
      .from("content_lab_runs").select("summary").eq("id", run_id).single();
    const existingSummary = (existing?.summary ?? {}) as Record<string, unknown>;

    await supabase
      .from("content_lab_runs")
      .update({
        summary: {
          ...existingSummary,
          scrape_buckets: buckets,
          scrape_errors: errors.length > 0 ? errors : null,
          scrape_post_count: insertedCount,
          scrape_attempted_count: rows.length,
          per_platform_counts,
          analyse_top_post_ids: [...topBenchmarkIds, ...topCompetitorIds],
        },
      })
      .eq("id", run_id);

    return json({
      ok: true,
      post_count: insertedCount,
      attempted: rows.length,
      buckets,
      top_for_analysis: topBenchmarkIds.length + topCompetitorIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("content-lab-scrape error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickTop(
  rows: Array<{ id: string; bucket?: string | null; views?: number | null; engagement_rate?: number | null }>,
  bucket: "benchmark" | "competitor",
  n: number,
  score: (v: number, er: number) => number,
): string[] {
  return rows
    .filter((r) => r.bucket === bucket)
    .map((r) => ({ id: r.id, s: score(r.views ?? 0, Number(r.engagement_rate ?? 0)) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((r) => r.id);
}

function crossPlatformDedupe(posts: ScrapedPost[]): ScrapedPost[] {
  // Many users post the same content to multiple platforms — keep ONE copy
  // (prefer the platform with most engagement signal: views, then likes).
  const groups = new Map<string, ScrapedPost[]>();
  for (const p of posts) {
    const fp = captionFingerprint(p.caption);
    if (!fp) {
      // No caption to fingerprint — treat as unique.
      groups.set(`__uniq__${p.author_handle}-${p.post_url ?? Math.random()}`, [p]);
      continue;
    }
    const week = postedWeekKey(p.posted_at);
    const key = `${p.author_handle}|${week}|${fp}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }
  const out: ScrapedPost[] = [];
  for (const arr of groups.values()) {
    if (arr.length === 1) { out.push(arr[0]); continue; }
    arr.sort((a, b) => (b.views - a.views) || (b.likes - a.likes));
    out.push(arr[0]);
  }
  return out;
}

function captionFingerprint(caption: string | null): string | null {
  if (!caption) return null;
  const norm = caption.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 60);
  return norm.length >= 10 ? norm : null;
}

function postedWeekKey(iso: string | null): string {
  if (!iso) return "no-date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "no-date";
  const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-w${week}`;
}

// ---------- TikTok transcript enrichment ----------

async function enrichTikTokTranscripts(posts: ScrapedPost[]): Promise<void> {
  const candidates = posts.filter((p) =>
    p.platform === "tiktok" &&
    !p.transcript &&
    Array.isArray(p.subtitle_links) &&
    p.subtitle_links.length > 0
  );
  if (candidates.length === 0) return;

  await Promise.allSettled(candidates.map(async (p) => {
    try {
      const link = pickBestSubtitleLink(p.subtitle_links ?? []);
      if (!link) return;
      const text = await fetchSubtitleText(link);
      if (text) p.transcript = text;
    } catch {
      // Swallow — transcripts are best-effort.
    } finally {
      // Strip the link payload after processing so it doesn't leak into the DB row.
      delete p.subtitle_links;
    }
  }));
}

function pickBestSubtitleLink(links: Array<{ language?: string; downloadLink?: string }>): string | null {
  if (links.length === 0) return null;
  const english = links.find((l) => (l.language ?? "").toLowerCase().startsWith("en"));
  return (english?.downloadLink ?? links[0].downloadLink) ?? null;
}

async function fetchSubtitleText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUBTITLE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const raw = await res.text();
    const cleaned = parseSubtitleFile(raw);
    return cleaned.length > 0 ? cleaned.slice(0, MAX_TRANSCRIPT_CHARS) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseSubtitleFile(raw: string): string {
  // Handles both WebVTT and SRT. Strips timestamps, cue numbers, WEBVTT header,
  // positioning hints and HTML-style tags. Collapses whitespace.
  const lines = raw.split(/\r?\n/);
  const keep: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^WEBVTT/i.test(trimmed)) continue;
    if (/^\d+$/.test(trimmed)) continue; // cue number
    if (/-->/i.test(trimmed)) continue; // timestamp line
    if (/^NOTE\b/i.test(trimmed)) continue;
    if (/^STYLE\b/i.test(trimmed)) continue;
    keep.push(trimmed.replace(/<[^>]+>/g, ""));
  }
  return keep.join(" ").replace(/\s+/g, " ").trim();
}

interface BucketResult { posts: ScrapedPost[]; errors: string[] }

async function loadBenchmarkHandles(args: {
  supabase: ReturnType<typeof createClient>;
  niche_tag: string | null;
  enabledPlatforms: Array<"instagram" | "tiktok" | "facebook">;
  llmFallback: DiscoveredEntity[];
  ownHandleSet: Set<string>;
}): Promise<string[]> {
  if (args.niche_tag) {
    const { data } = await args.supabase
      .from("content_lab_benchmark_pool")
      .select("handle")
      .eq("niche_tag", args.niche_tag)
      .eq("status", "verified")
      .order("median_views", { ascending: false })
      .limit(MAX_BENCHMARK_HANDLES * 2);
    const seenPool = new Set<string>();
    const fromPool = ((data ?? []) as Array<{ handle: string }>)
      .map((r) => r.handle.toLowerCase().replace(/^@/, ""))
      .filter((h) => !args.ownHandleSet.has(h) && !seenPool.has(h) && (seenPool.add(h), true))
      .slice(0, MAX_BENCHMARK_HANDLES);
    if (fromPool.length > 0) {
      console.log(`Benchmarks: ${fromPool.length} from verified pool (${args.niche_tag})`);
      return fromPool;
    }
  }
  const seen = new Set<string>();
  const fallback = (args.llmFallback ?? [])
    .map((b) => b.handle?.toLowerCase().replace(/^@/, ""))
    .filter((h): h is string => !!h)
    .filter((h) => !args.ownHandleSet.has(h) && !seen.has(h) && (seen.add(h), true))
    .slice(0, MAX_BENCHMARK_HANDLES);
  console.log(`Benchmarks: ${fallback.length} from LLM fallback (pool empty for ${args.niche_tag ?? "no tag"})`);
  return fallback;
}

async function scrapeOwn(
  supabase: ReturnType<typeof createClient>,
  niche: { own_handle: string | null; client_id: string },
  platforms: Array<"instagram" | "tiktok" | "facebook">,
  ownHandlesByPlatform: Partial<Record<"instagram" | "tiktok" | "facebook", string>>,
): Promise<BucketResult> {
  const errors: string[] = [];
  const collected: ScrapedPost[] = [];

  const hasAny = platforms.some((p) => !!ownHandlesByPlatform[p]);
  if (!hasAny) return { posts: [], errors: [] };

  if (platforms.includes("instagram")) {
    const igHandle = ownHandlesByPlatform.instagram;
    if (igHandle) {
      try {
        const { data: igConn } = await supabase
          .from("platform_connections")
          .select("id, access_token, account_id, account_name, is_connected")
          .eq("client_id", niche.client_id)
          .eq("platform", "instagram")
          .eq("is_connected", true)
          .maybeSingle();

        const connHandle = (igConn as { account_name?: string } | null)?.account_name?.toLowerCase().replace(/^@/, "");

        if (igConn && (igConn as { access_token?: string }).access_token && (igConn as { account_id?: string }).account_id && connHandle === igHandle) {
          const token = await decryptToken((igConn as { access_token: string }).access_token);
          const oauthPosts = await fetchOwnInstagramPosts((igConn as { account_id: string }).account_id, token, igHandle);
          oauthPosts.forEach((p) => { p.bucket = "own"; });
          console.log(`Own (OAuth IG): ${oauthPosts.length} posts for @${igHandle}`);
          collected.push(...oauthPosts);
        } else {
          const apifyResult = await runApifyForHandlesWithRetry([igHandle], MAX_POSTS_OWN);
          apifyResult.posts.forEach((p) => { p.bucket = "own"; });
          console.log(`Own (Apify IG): ${apifyResult.posts.length} posts for @${igHandle}`);
          collected.push(...apifyResult.posts);
          if (apifyResult.errors.length > 0) errors.push(...apifyResult.errors.map((e) => `Own IG: ${e}`));
        }
      } catch (e) {
        const msg = `Own IG scrape failed: ${e instanceof Error ? e.message : e}`;
        console.error(msg);
        errors.push(msg);
      }
    }
  }

  if (platforms.includes("tiktok") && ownHandlesByPlatform.tiktok) {
    try {
      const ttResult = await runTikTokScraperWithRetry(ownHandlesByPlatform.tiktok, MAX_POSTS_OWN);
      ttResult.posts.forEach((p) => { p.bucket = "own"; });
      console.log(`Own (TikTok): ${ttResult.posts.length} posts for @${ownHandlesByPlatform.tiktok}`);
      collected.push(...ttResult.posts);
      if (ttResult.errors.length > 0) errors.push(...ttResult.errors.map((e) => `Own TikTok: ${e}`));
    } catch (e) {
      const msg = `Own TikTok scrape failed: ${e instanceof Error ? e.message : e}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  if (platforms.includes("facebook") && ownHandlesByPlatform.facebook) {
    try {
      const fbResult = await runFacebookScraperWithRetry(ownHandlesByPlatform.facebook, MAX_POSTS_OWN);
      fbResult.posts.forEach((p) => { p.bucket = "own"; });
      console.log(`Own (Facebook): ${fbResult.posts.length} posts for ${ownHandlesByPlatform.facebook}`);
      collected.push(...fbResult.posts);
      if (fbResult.errors.length > 0) errors.push(...fbResult.errors.map((e) => `Own FB: ${e}`));
    } catch (e) {
      const msg = `Own Facebook scrape failed: ${e instanceof Error ? e.message : e}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  return { posts: collected, errors };
}

async function scrapeBucket(
  handles: string[],
  bucket: "competitor" | "benchmark",
  postsPerHandle: number,
  platforms: Array<"instagram" | "tiktok" | "facebook">,
): Promise<BucketResult> {
  if (handles.length === 0) return { posts: [], errors: [] };
  const errors: string[] = [];
  const posts: ScrapedPost[] = [];

  type TaskResult = { posts: ScrapedPost[]; errors: string[]; label: string };
  const tasks: Array<Promise<TaskResult>> = [];

  if (platforms.includes("instagram")) {
    const chunks: string[][] = [];
    for (let i = 0; i < handles.length; i += APIFY_CHUNK_SIZE) {
      chunks.push(handles.slice(i, i + APIFY_CHUNK_SIZE));
    }
    chunks.forEach((c, idx) => tasks.push(
      runApifyForHandlesWithRetry(c, postsPerHandle).then((r) => ({ ...r, label: `IG chunk ${idx + 1} [${c.join(",")}]` })),
    ));
  }
  if (platforms.includes("tiktok")) {
    handles.forEach((h) => tasks.push(
      runTikTokScraperWithRetry(h, postsPerHandle).then((r) => ({ ...r, label: `TikTok @${h}` })),
    ));
  }
  if (platforms.includes("facebook")) {
    handles.forEach((h) => tasks.push(
      runFacebookScraperWithRetry(h, postsPerHandle).then((r) => ({ ...r, label: `FB ${h}` })),
    ));
  }

  const settled = await Promise.allSettled(tasks);
  settled.forEach((r, idx) => {
    if (r.status === "fulfilled") {
      posts.push(...r.value.posts);
      if (r.value.errors.length > 0) {
        r.value.errors.forEach((e) => errors.push(`${bucket} ${r.value.label}: ${e}`));
      }
    } else {
      const msg = `${bucket} scrape task ${idx + 1} crashed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`;
      console.error(msg);
      errors.push(msg);
    }
  });

  posts.forEach((p) => { p.bucket = bucket; });

  // Recency filter: keep only posts from the last RECENT_DAYS, per account.
  // If an account returns 0 recent posts, fall back to its latest posts regardless of date.
  const cutoff = Date.now() - RECENT_CUTOFF_MS;
  const byAccount = new Map<string, ScrapedPost[]>();
  posts.forEach((p) => {
    const key = `${p.platform}|${p.author_handle}`;
    const arr = byAccount.get(key) ?? [];
    arr.push(p);
    byAccount.set(key, arr);
  });

  const filtered: ScrapedPost[] = [];
  let droppedStale = 0;
  let fallbackAccounts = 0;
  for (const [key, accountPosts] of byAccount.entries()) {
    const recent = accountPosts.filter((p) => {
      if (!p.posted_at) return false;
      const t = new Date(p.posted_at).getTime();
      return Number.isFinite(t) && t >= cutoff;
    });
    if (recent.length > 0) {
      droppedStale += accountPosts.length - recent.length;
      filtered.push(...recent);
    } else {
      // Fallback: keep this account's latest posts so we don't starve the bucket.
      fallbackAccounts += 1;
      console.log(`Recency fallback for ${key} — no posts in last ${RECENT_DAYS}d, keeping latest ${accountPosts.length}`);
      filtered.push(...accountPosts);
    }
  }

  console.log(`${bucket}: ${filtered.length} posts (dropped ${droppedStale} stale, ${fallbackAccounts} accounts used fallback) from ${handles.length} handles across [${platforms.join(",")}]`);
  return { posts: filtered, errors };
}

// ---------- OAuth IG ----------

async function fetchOwnInstagramPosts(
  igUserId: string,
  accessToken: string,
  handle: string,
): Promise<ScrapedPost[]> {
  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
  const url = `https://graph.facebook.com/v25.0/${igUserId}/media?fields=${fields}&limit=${MAX_POSTS_OWN}&access_token=${accessToken}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("IG Graph error:", await res.text());
      return [];
    }
    const data = await res.json();
    return (data.data ?? []).map((m: {
      id: string; caption?: string; media_type?: string; media_url?: string;
      thumbnail_url?: string; permalink?: string; timestamp?: string;
      like_count?: number; comments_count?: number;
    }) => ({
      platform: "instagram" as const,
      source: "oauth" as const,
      bucket: "own" as const,
      author_handle: handle,
      post_url: m.permalink ?? null,
      post_type: m.media_type?.toLowerCase() ?? null,
      caption: m.caption ?? null,
      thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
      likes: m.like_count ?? 0,
      comments: m.comments_count ?? 0,
      shares: 0,
      views: 0,
      posted_at: m.timestamp ?? null,
      transcript: null,
      video_duration_seconds: null,
      hashtags: [],
      mentions: [],
      music_title: null,
      music_artist: null,
      tagged_users: [],
    }));
  } catch (e) {
    console.error("IG own fetch failed:", e);
    return [];
  }
}

// ---------- Apify wrappers + retry ----------

interface ApifyResult { posts: ScrapedPost[]; errors: string[] }

async function runApifyForHandlesWithRetry(handles: string[], resultsLimit: number): Promise<ApifyResult> {
  const first = await runApifyForHandles(handles, resultsLimit, APIFY_TIMEOUT_SEC);
  if (first.posts.length > 0) return first;
  console.log(`IG retry with ${APIFY_RETRY_TIMEOUT_SEC}s for ${handles.join(",")}`);
  const retry = await runApifyForHandles(handles, resultsLimit, APIFY_RETRY_TIMEOUT_SEC);
  // Merge errors from both attempts so nothing is silently dropped.
  return { posts: retry.posts, errors: [...first.errors, ...retry.errors] };
}

async function runTikTokScraperWithRetry(handle: string, resultsLimit: number): Promise<ApifyResult> {
  const first = await runTikTokScraper(handle, resultsLimit, APIFY_TIMEOUT_SEC);
  if (first.posts.length > 0) return first;
  console.log(`TT retry with ${APIFY_RETRY_TIMEOUT_SEC}s for ${handle}`);
  const retry = await runTikTokScraper(handle, resultsLimit, APIFY_RETRY_TIMEOUT_SEC);
  return { posts: retry.posts, errors: [...first.errors, ...retry.errors] };
}

async function runFacebookScraperWithRetry(handle: string, resultsLimit: number): Promise<ApifyResult> {
  const first = await runFacebookScraper(handle, resultsLimit, APIFY_TIMEOUT_SEC);
  if (first.posts.length > 0) return first;
  console.log(`FB retry with ${APIFY_RETRY_TIMEOUT_SEC}s for ${handle}`);
  const retry = await runFacebookScraper(handle, resultsLimit, APIFY_RETRY_TIMEOUT_SEC);
  return { posts: retry.posts, errors: [...first.errors, ...retry.errors] };
}

async function runApifyForHandles(
  handles: string[], resultsLimit: number, timeoutSec: number,
): Promise<ApifyResult> {
  const errors: string[] = [];
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) {
    const msg = "APIFY_TOKEN not configured";
    console.error(msg);
    return { posts: [], errors: [msg] };
  }
  const igUrls = handles
    .map((h) => `https://www.instagram.com/${h.replace(/^@/, "")}/`)
    .filter((u) => u.includes("instagram.com"));
  if (igUrls.length === 0) return { posts: [], errors: [] };

  // NOTE: Removed `onlyPostsNewerThan` — it pre-filters at Apify level and starves
  // accounts that post infrequently. The post-fetch recency filter in scrapeBucket
  // handles this with a fallback for inactive accounts.
  const input = {
    directUrls: igUrls,
    resultsType: "posts",
    resultsLimit,
    addParentData: false,
  };
  const runUrl = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${apifyToken}&timeout=${timeoutSec}`;

  try {
    const res = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const bodyText = await res.text();
      const msg = `Apify IG ${res.status}: ${bodyText.slice(0, 300)}`;
      console.error(msg);
      errors.push(msg);
      return { posts: [], errors };
    }
    const items = await res.json();
    if (!Array.isArray(items)) return { posts: [], errors };

    const posts = items.map((it: {
      ownerUsername?: string; url?: string; type?: string; productType?: string; caption?: string;
      displayUrl?: string; likesCount?: number; commentsCount?: number;
      videoViewCount?: number; videoPlayCount?: number; videoDuration?: number;
      videoTranscript?: string; timestamp?: string;
      hashtags?: string[]; mentions?: string[];
      musicInfo?: { song_name?: string; artist_name?: string };
      taggedUsers?: Array<{ username?: string }>;
    }) => {
      const rawType = (it.productType ?? it.type ?? "").toLowerCase();
      const post_type = rawType === "clips" ? "reel" : rawType || null;
      return {
        platform: "instagram" as const,
        source: "apify" as const,
        bucket: "competitor" as const,
        author_handle: (it.ownerUsername ?? "unknown").toLowerCase(),
        post_url: it.url ?? null,
        post_type,
        caption: it.caption ?? null,
        thumbnail_url: it.displayUrl ?? null,
        likes: it.likesCount ?? 0,
        comments: it.commentsCount ?? 0,
        shares: 0,
        views: it.videoViewCount ?? it.videoPlayCount ?? 0,
        posted_at: it.timestamp ?? null,
        transcript: it.videoTranscript?.trim() || null,
        video_duration_seconds: it.videoDuration ? Math.round(it.videoDuration) : null,
        hashtags: Array.isArray(it.hashtags) ? it.hashtags.filter((h) => typeof h === "string") : [],
        mentions: Array.isArray(it.mentions) ? it.mentions.filter((m) => typeof m === "string") : [],
        music_title: it.musicInfo?.song_name ?? null,
        music_artist: it.musicInfo?.artist_name ?? null,
        tagged_users: Array.isArray(it.taggedUsers)
          ? it.taggedUsers.map((u) => u.username).filter((u): u is string => !!u)
          : [],
      };
    });
    return { posts, errors };
  } catch (e) {
    const msg = `Apify IG fetch failed: ${e instanceof Error ? e.message : String(e)}`;
    console.error(msg);
    errors.push(msg);
    return { posts: [], errors };
  }
}

async function runTikTokScraper(handle: string, resultsLimit: number, timeoutSec: number): Promise<ApifyResult> {
  const errors: string[] = [];
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) return { posts: [], errors: ["APIFY_TOKEN not configured"] };
  const cleaned = handle.replace(/^@/, "");

  // NOTE: Removed `oldestPostDate` — it pre-filters at Apify level and starves
  // accounts that post infrequently. The post-fetch recency filter in scrapeBucket
  // handles this with a fallback for inactive accounts.
  const input = {
    profiles: [cleaned],
    resultsPerPage: resultsLimit,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: true, // request subs so enrichTikTokTranscripts can parse them
  };
  const url = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=${timeoutSec}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const bodyText = await res.text();
      const msg = `Apify TikTok ${res.status}: ${bodyText.slice(0, 300)}`;
      console.error(msg);
      errors.push(msg);
      return { posts: [], errors };
    }
    const items = await res.json();
    if (!Array.isArray(items)) return { posts: [], errors };
    const posts = items.map((it: {
      authorMeta?: { name?: string };
      webVideoUrl?: string;
      text?: string;
      playCount?: number;
      diggCount?: number;
      commentCount?: number;
      shareCount?: number;
      createTimeISO?: string;
      videoMeta?: { duration?: number; coverUrl?: string };
      musicMeta?: { musicName?: string; musicAuthor?: string };
      hashtags?: Array<{ name?: string } | string>;
      subtitleLinks?: Array<{ language?: string; downloadLink?: string }>;
    }) => ({
      platform: "tiktok" as const,
      source: "apify" as const,
      bucket: "competitor" as const,
      author_handle: (it.authorMeta?.name ?? cleaned).toLowerCase(),
      post_url: it.webVideoUrl ?? null,
      post_type: "video",
      caption: it.text ?? null,
      thumbnail_url: it.videoMeta?.coverUrl ?? null,
      likes: it.diggCount ?? 0,
      comments: it.commentCount ?? 0,
      shares: it.shareCount ?? 0,
      views: it.playCount ?? 0,
      posted_at: it.createTimeISO ?? null,
      transcript: null,
      video_duration_seconds: it.videoMeta?.duration ? Math.round(it.videoMeta.duration) : null,
      hashtags: Array.isArray(it.hashtags)
        ? it.hashtags.map((h) => (typeof h === "string" ? h : h?.name)).filter((h): h is string => !!h)
        : [],
      mentions: [],
      music_title: it.musicMeta?.musicName ?? null,
      music_artist: it.musicMeta?.musicAuthor ?? null,
      tagged_users: [],
      subtitle_links: Array.isArray(it.subtitleLinks) ? it.subtitleLinks : undefined,
    }));
    return { posts, errors };
  } catch (e) {
    const msg = `Apify TikTok fetch failed: ${e instanceof Error ? e.message : String(e)}`;
    console.error(msg);
    errors.push(msg);
    return { posts: [], errors };
  }
}

async function runFacebookScraper(handle: string, resultsLimit: number, timeoutSec: number): Promise<ApifyResult> {
  const errors: string[] = [];
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) return { posts: [], errors: ["APIFY_TOKEN not configured"] };
  const cleaned = handle.replace(/^@/, "");

  // Uses apify~facebook-pages-scraper. Input schema does NOT include maxPostDate —
  // the previous wrong actor name + wrong schema was the cause of the instant 404s.
  const input = {
    startUrls: [{ url: `https://www.facebook.com/${cleaned}/` }],
    resultsLimit,
  };
  const url = `https://api.apify.com/v2/acts/${FACEBOOK_ACTOR}/run-sync-get-dataset-items?token=${apifyToken}&timeout=${timeoutSec}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const bodyText = await res.text();
      const msg = `Apify Facebook ${res.status}: ${bodyText.slice(0, 300)}`;
      console.error(msg);
      errors.push(msg);
      return { posts: [], errors };
    }
    const items = await res.json();
    if (!Array.isArray(items)) return { posts: [], errors };
    const posts = items.map((it: {
      pageName?: string;
      url?: string;
      text?: string;
      topImage?: string;
      thumbnail?: string;
      likesCount?: number;
      commentsCount?: number;
      sharesCount?: number;
      videoViewCount?: number;
      time?: string;
      isVideo?: boolean;
    }) => ({
      platform: "facebook" as const,
      source: "apify" as const,
      bucket: "competitor" as const,
      author_handle: (it.pageName ?? cleaned).toLowerCase(),
      post_url: it.url ?? null,
      post_type: it.isVideo ? "video" : "post",
      caption: it.text ?? null,
      thumbnail_url: it.topImage ?? it.thumbnail ?? null,
      likes: it.likesCount ?? 0,
      comments: it.commentsCount ?? 0,
      shares: it.sharesCount ?? 0,
      views: it.videoViewCount ?? 0,
      posted_at: it.time ?? null,
      transcript: null,
      video_duration_seconds: null,
      hashtags: [],
      mentions: [],
      music_title: null,
      music_artist: null,
      tagged_users: [],
    }));
    return { posts, errors };
  } catch (e) {
    const msg = `Apify Facebook fetch failed: ${e instanceof Error ? e.message : String(e)}`;
    console.error(msg);
    errors.push(msg);
    return { posts: [], errors };
  }
}
