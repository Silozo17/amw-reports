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

// New spec caps.
const MAX_POSTS_OWN = 8;
const MAX_POSTS_PER_ACCOUNT = 4;
const MAX_COMPETITOR_HANDLES = 5;
const MAX_BENCHMARK_HANDLES = 6;
const MAX_TOTAL_POSTS = 80;
const TOP_BENCHMARK_TO_ANALYSE = 10;
const TOP_COMPETITOR_TO_ANALYSE = 10;
// Recency window for competitor + benchmark posts (current month only).
const RECENT_DAYS = 30;
const RECENT_CUTOFF_MS = RECENT_DAYS * 24 * 60 * 60 * 1000;

const APIFY_CHUNK_SIZE = 5;
const APIFY_TIMEOUT_SEC = 90;
const APIFY_RETRY_TIMEOUT_SEC = 150;

interface DiscoveredEntity { handle: string; reason?: string }

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

    const competitorHandles = (niche.top_competitors ?? [])
      .map((c) => c.handle?.toLowerCase().replace(/^@/, ""))
      .filter((h): h is string => !!h)
      .slice(0, MAX_COMPETITOR_HANDLES);

    const benchmarkHandles = await loadBenchmarkHandles({
      supabase,
      niche_tag: niche.niche_tag,
      enabledPlatforms,
      llmFallback: niche.top_global_benchmarks ?? [],
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
    deduped = crossPlatformDedupe(deduped);

    // 3) Renderable-row filter: drop posts that have no usable display signal.
    // A post is renderable if it has at least one strong signal (post_url OR thumbnail OR caption ≥10 chars)
    // AND a non-placeholder author handle. Top-bucket benchmarks with strong engagement are kept even if one field missing.
    deduped = deduped.filter((p) => {
      const handle = (p.author_handle ?? "").trim().toLowerCase();
      if (!handle || handle === "unknown" || handle === "n/a" || handle === "anonymous") {
        // Allow only if there's still strong engagement signal (saves rare anonymous viral posts).
        if ((p.views ?? 0) < 1000 && (p.likes ?? 0) < 100) return false;
      }
      const captionLen = (p.caption ?? "").trim().length;
      const hasUrl = !!p.post_url;
      const hasThumb = !!p.thumbnail_url;
      const hasCaption = captionLen >= 10;
      const hasEngagement = (p.views ?? 0) > 0 || (p.likes ?? 0) > 0 || (p.comments ?? 0) > 0;
      // Need at least one display field + some engagement, OR two display fields.
      const displayFieldCount = (hasUrl ? 1 : 0) + (hasThumb ? 1 : 0) + (hasCaption ? 1 : 0);
      if (displayFieldCount === 0) return false;
      if (displayFieldCount === 1 && !hasEngagement) return false;
      return true;
    });

    // 4) Cap total inserted rows.
    deduped = deduped.slice(0, MAX_TOTAL_POSTS);

    // 4b) Cross-platform benchmark fill: every enabled platform must have benchmark signal.
    // If a platform has 0 benchmark posts after scraping, copy the top 10 benchmark posts
    // from any other platform that has them, re-tagging the platform field. Ensures the
    // ideation step always has reference material to learn from per platform.
    {
      const enabled = Array.from(new Set(deduped.map((p) => p.platform)));
      // Determine which enabled platforms (from the run config) appear at all.
      // We can only fill platforms that the user enabled, so derive from collected set.
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
        // Find the platform with the most benchmark posts to source from.
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
        // Sort by engagement signal and take top 10.
        const top = [...sourcePosts]
          .sort((a, b) => (b.views - a.views) || (b.likes - a.likes))
          .slice(0, 10)
          .map((p) => ({ ...p, platform: target }));
        deduped.push(...top);
        console.log(`Cross-platform benchmark fill: copied ${top.length} posts from ${sourcePlatform} to ${target}`);
      }
      // Re-cap after fill so we never exceed MAX_TOTAL_POSTS overall.
      deduped = deduped.slice(0, MAX_TOTAL_POSTS);
    }

    // 4) Build rows with engagement_rate + score, then mark top-N for analysis via summary.
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

    // 5) Resolve inserted row IDs and pick the top-N by score per bucket for the analyser.
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

interface BucketResult { posts: ScrapedPost[]; errors: string[] }

async function loadBenchmarkHandles(args: {
  supabase: ReturnType<typeof createClient>;
  niche_tag: string | null;
  enabledPlatforms: Array<"instagram" | "tiktok" | "facebook">;
  llmFallback: DiscoveredEntity[];
}): Promise<string[]> {
  if (args.niche_tag) {
    const { data } = await args.supabase
      .from("content_lab_benchmark_pool")
      .select("handle")
      .eq("niche_tag", args.niche_tag)
      .eq("status", "verified")
      .in("platform", args.enabledPlatforms)
      .order("median_views", { ascending: false })
      .limit(MAX_BENCHMARK_HANDLES);
    const fromPool = ((data ?? []) as Array<{ handle: string }>)
      .map((r) => r.handle.toLowerCase().replace(/^@/, ""));
    if (fromPool.length > 0) {
      console.log(`Benchmarks: ${fromPool.length} from verified pool (${args.niche_tag})`);
      return fromPool;
    }
  }
  const fallback = args.llmFallback
    .map((b) => b.handle?.toLowerCase().replace(/^@/, ""))
    .filter((h): h is string => !!h)
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
          const apifyPosts = await runApifyForHandlesWithRetry([igHandle], MAX_POSTS_OWN);
          apifyPosts.forEach((p) => { p.bucket = "own"; });
          console.log(`Own (Apify IG): ${apifyPosts.length} posts for @${igHandle}`);
          collected.push(...apifyPosts);
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
      const ttPosts = await runTikTokScraperWithRetry(ownHandlesByPlatform.tiktok, MAX_POSTS_OWN);
      ttPosts.forEach((p) => { p.bucket = "own"; });
      console.log(`Own (TikTok): ${ttPosts.length} posts for @${ownHandlesByPlatform.tiktok}`);
      collected.push(...ttPosts);
    } catch (e) {
      const msg = `Own TikTok scrape failed: ${e instanceof Error ? e.message : e}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  if (platforms.includes("facebook") && ownHandlesByPlatform.facebook) {
    try {
      const fbPosts = await runFacebookScraperWithRetry(ownHandlesByPlatform.facebook, MAX_POSTS_OWN);
      fbPosts.forEach((p) => { p.bucket = "own"; });
      console.log(`Own (Facebook): ${fbPosts.length} posts for ${ownHandlesByPlatform.facebook}`);
      collected.push(...fbPosts);
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

  const tasks: Array<Promise<ScrapedPost[]>> = [];
  if (platforms.includes("instagram")) {
    const chunks: string[][] = [];
    for (let i = 0; i < handles.length; i += APIFY_CHUNK_SIZE) {
      chunks.push(handles.slice(i, i + APIFY_CHUNK_SIZE));
    }
    chunks.forEach((c) => tasks.push(runApifyForHandlesWithRetry(c, postsPerHandle)));
  }
  if (platforms.includes("tiktok")) {
    handles.forEach((h) => tasks.push(runTikTokScraperWithRetry(h, postsPerHandle)));
  }
  if (platforms.includes("facebook")) {
    handles.forEach((h) => tasks.push(runFacebookScraperWithRetry(h, postsPerHandle)));
  }

  const settled = await Promise.allSettled(tasks);
  settled.forEach((r, idx) => {
    if (r.status === "fulfilled") {
      posts.push(...r.value);
    } else {
      const msg = `scrape task ${idx + 1} failed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`;
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

async function runApifyForHandlesWithRetry(handles: string[], resultsLimit: number): Promise<ScrapedPost[]> {
  const first = await runApifyForHandles(handles, resultsLimit, APIFY_TIMEOUT_SEC);
  if (first.length > 0) return first;
  console.log(`IG retry with ${APIFY_RETRY_TIMEOUT_SEC}s for ${handles.join(",")}`);
  return runApifyForHandles(handles, resultsLimit, APIFY_RETRY_TIMEOUT_SEC);
}

async function runTikTokScraperWithRetry(handle: string, resultsLimit: number): Promise<ScrapedPost[]> {
  const first = await runTikTokScraper(handle, resultsLimit, APIFY_TIMEOUT_SEC);
  if (first.length > 0) return first;
  console.log(`TT retry with ${APIFY_RETRY_TIMEOUT_SEC}s for ${handle}`);
  return runTikTokScraper(handle, resultsLimit, APIFY_RETRY_TIMEOUT_SEC);
}

async function runFacebookScraperWithRetry(handle: string, resultsLimit: number): Promise<ScrapedPost[]> {
  const first = await runFacebookScraper(handle, resultsLimit, APIFY_TIMEOUT_SEC);
  if (first.length > 0) return first;
  console.log(`FB retry with ${APIFY_RETRY_TIMEOUT_SEC}s for ${handle}`);
  return runFacebookScraper(handle, resultsLimit, APIFY_RETRY_TIMEOUT_SEC);
}

async function runApifyForHandles(
  handles: string[], resultsLimit: number, timeoutSec: number,
): Promise<ScrapedPost[]> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) {
    console.error("APIFY_TOKEN not configured; skipping Apify scrape");
    return [];
  }
  const igUrls = handles
    .map((h) => `https://www.instagram.com/${h.replace(/^@/, "")}/`)
    .filter((u) => u.includes("instagram.com"));
  if (igUrls.length === 0) return [];

  const onlyPostsNewerThan = new Date(Date.now() - RECENT_CUTOFF_MS).toISOString();
  const input = {
    directUrls: igUrls,
    resultsType: "posts",
    resultsLimit,
    addParentData: false,
    onlyPostsNewerThan,
  };
  const runUrl = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${apifyToken}&timeout=${timeoutSec}`;

  try {
    const res = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.error("Apify error:", res.status, await res.text());
      return [];
    }
    const items = await res.json();
    if (!Array.isArray(items)) return [];

    return items.map((it: {
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
  } catch (e) {
    console.error("Apify fetch failed:", e);
    return [];
  }
}

async function runTikTokScraper(handle: string, resultsLimit: number, timeoutSec: number): Promise<ScrapedPost[]> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) return [];
  const cleaned = handle.replace(/^@/, "");
  const oldestPostDate = new Date(Date.now() - RECENT_CUTOFF_MS).toISOString().slice(0, 10);
  const input = {
    profiles: [cleaned],
    resultsPerPage: resultsLimit,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: true, // request subs so analyse can read transcripts
    oldestPostDate, // YYYY-MM-DD; clockworks/tiktok-scraper supports this filter
  };
  const url = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=${timeoutSec}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.error("TikTok Apify error:", res.status, await res.text());
      return [];
    }
    const items = await res.json();
    if (!Array.isArray(items)) return [];
    return items.map((it: {
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
    }));
  } catch (e) {
    console.error("TikTok fetch failed:", e);
    return [];
  }
}

async function runFacebookScraper(handle: string, resultsLimit: number, timeoutSec: number): Promise<ScrapedPost[]> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) return [];
  const cleaned = handle.replace(/^@/, "");
  const input = {
    startUrls: [{ url: `https://www.facebook.com/${cleaned}/` }],
    resultsLimit,
    maxPostDate: new Date(Date.now() - RECENT_CUTOFF_MS).toISOString().slice(0, 10),
  };
  const url = `https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=${timeoutSec}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.error("Facebook Apify error:", res.status, await res.text());
      return [];
    }
    const items = await res.json();
    if (!Array.isArray(items)) return [];
    return items.map((it: {
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
  } catch (e) {
    console.error("Facebook fetch failed:", e);
    return [];
  }
}
