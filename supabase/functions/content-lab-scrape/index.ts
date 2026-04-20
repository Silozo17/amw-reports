// content-lab-scrape: pulls posts for a run.
// Sources, in priority order:
//   1. Own handle via Instagram Graph API (if OAuth-connected) OR Apify fallback
//   2. Top competitors (from niche.top_competitors[].handle) via Apify
//   3. Top global benchmarks (from niche.top_global_benchmarks[].handle) via Apify
// Per-bucket isolation: a failure in one bucket does not abort the rest.
// Buckets are kicked off in parallel via Promise.allSettled and competitor/benchmark
// handles are chunked (max 5 per Apify call) to stay under per-actor timeouts.

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
// Cost caps — keep low to bound Apify spend per run.
// Realistic worst case = 15 + (5*8) + (6*6) = 91 items (capped to MAX_TOTAL_POSTS).
const MAX_POSTS_OWN = 15;
const MAX_POSTS_COMPETITOR = 8;
const MAX_POSTS_BENCHMARK = 6;
const MAX_COMPETITOR_HANDLES = 5;
// Raised from 3 → 6 so we have ~36 benchmark posts to pick top-30 from in ideate.
const MAX_BENCHMARK_HANDLES = 6;
const MAX_TOTAL_POSTS = 80;
const APIFY_CHUNK_SIZE = 5;
// Lowered from 90 → 60s to keep total wall-clock under Supabase edge timeout (150s)
// when running 3 buckets × 3 platforms in parallel.
const APIFY_TIMEOUT_SEC = 60;
// Engagement rate is a ratio (0-1). DB column is numeric(8,4) → max ~9999, but anything
// >1 is a data anomaly. Clamp tightly to keep stats trustworthy.
const MAX_ENGAGEMENT_RATE = 1;

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
      top_competitors: DiscoveredEntity[];
      top_global_benchmarks: DiscoveredEntity[];
      client_id: string;
      platforms_to_scrape: string[] | null;
    } }).niche;

    const enabledPlatforms = (niche.platforms_to_scrape && niche.platforms_to_scrape.length > 0
      ? niche.platforms_to_scrape
      : ['instagram']) as Array<'instagram' | 'tiktok' | 'facebook'>;

    const competitorHandles = (niche.top_competitors ?? [])
      .map((c) => c.handle?.toLowerCase().replace(/^@/, ""))
      .filter((h): h is string => !!h)
      .slice(0, MAX_COMPETITOR_HANDLES);
    const benchmarkHandles = (niche.top_global_benchmarks ?? [])
      .map((b) => b.handle?.toLowerCase().replace(/^@/, ""))
      .filter((h): h is string => !!h)
      .slice(0, MAX_BENCHMARK_HANDLES);

    // Run all three buckets in parallel; each handles its own errors.
    // Each bucket fans out across all enabled platforms internally.
    const [ownResult, compResult, benchResult] = await Promise.allSettled([
      scrapeOwn(supabase, niche, enabledPlatforms),
      scrapeBucket(competitorHandles, "competitor", MAX_POSTS_COMPETITOR, enabledPlatforms),
      scrapeBucket(benchmarkHandles, "benchmark", MAX_POSTS_BENCHMARK, enabledPlatforms),
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

    // De-duplicate by post_url, then cap
    const seen = new Set<string>();
    const deduped = collected.filter((p) => {
      const key = p.post_url ?? `${p.author_handle}-${p.posted_at}-${p.caption?.slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, MAX_TOTAL_POSTS);

    const rows = deduped.map((p) => {
      const raw = p.views > 0
        ? (p.likes + p.comments) / p.views
        : (p.likes + p.comments) / Math.max(p.likes + p.comments + 1000, 1000);
      const engagement_rate = Math.min(Math.max(raw, 0), MAX_ENGAGEMENT_RATE);
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

    const buckets = {
      own: rows.filter((r) => r.bucket === "own").length,
      competitor: rows.filter((r) => r.bucket === "competitor").length,
      benchmark: rows.filter((r) => r.bucket === "benchmark").length,
    };

    const { data: existing } = await supabase
      .from("content_lab_runs")
      .select("summary")
      .eq("id", run_id)
      .single();
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
        },
      })
      .eq("id", run_id);

    return json({
      ok: true,
      post_count: insertedCount,
      attempted: rows.length,
      buckets,
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

// One retry on 5xx (Apify 503/504 are common). Returns the final response either way.
async function fetchWithRetry(url: string, init: RequestInit, label: string): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status >= 500 && res.status < 600) {
    console.warn(`${label}: ${res.status}, retrying once after 1.5s`);
    await new Promise((r) => setTimeout(r, 1500));
    return fetch(url, init);
  }
  return res;
}

interface BucketResult { posts: ScrapedPost[]; errors: string[] }

async function scrapeOwn(
  supabase: ReturnType<typeof createClient>,
  niche: { own_handle: string | null; client_id: string },
  platforms: Array<"instagram" | "tiktok" | "facebook">,
): Promise<BucketResult> {
  if (!niche.own_handle) return { posts: [], errors: [] };
  const errors: string[] = [];
  const ownHandle = niche.own_handle.toLowerCase().replace(/^@/, "");

  try {
    // Instagram OAuth path (preferred, free)
    if (platforms.includes("instagram")) {
      const { data: igConn } = await supabase
        .from("platform_connections")
        .select("id, access_token, account_id, account_name, is_connected")
        .eq("client_id", niche.client_id)
        .eq("platform", "instagram")
        .eq("is_connected", true)
        .maybeSingle();

      const connHandle = (igConn as { account_name?: string } | null)?.account_name?.toLowerCase().replace(/^@/, "");

      if (igConn && (igConn as { access_token?: string }).access_token && (igConn as { account_id?: string }).account_id && connHandle === ownHandle) {
        const token = await decryptToken((igConn as { access_token: string }).access_token);
        const posts = await fetchOwnInstagramPosts((igConn as { account_id: string }).account_id, token, ownHandle);
        posts.forEach((p) => { p.bucket = "own"; });
        console.log(`Own (OAuth IG): ${posts.length} posts for @${ownHandle}`);
        // Still scrape other platforms via Apify below
        const remaining = platforms.filter((p) => p !== "instagram");
        if (remaining.length === 0) return { posts, errors };
        const extra = await scrapeHandlesAcrossPlatforms([ownHandle], MAX_POSTS_OWN, remaining);
        extra.posts.forEach((p) => { p.bucket = "own"; });
        return { posts: [...posts, ...extra.posts], errors: [...errors, ...extra.errors] };
      }
    }

    // Apify fallback for own handle across all enabled platforms
    const result = await scrapeHandlesAcrossPlatforms([ownHandle], MAX_POSTS_OWN, platforms);
    result.posts.forEach((p) => { p.bucket = "own"; });
    console.log(`Own (Apify): ${result.posts.length} posts for @${ownHandle}`);
    return { posts: result.posts, errors: [...errors, ...result.errors] };
  } catch (e) {
    const msg = `Own handle scrape failed: ${e instanceof Error ? e.message : e}`;
    console.error(msg);
    errors.push(msg);
    return { posts: [], errors };
  }
}

async function scrapeBucket(
  handles: string[],
  bucket: "competitor" | "benchmark",
  postsPerHandle: number,
  platforms: Array<"instagram" | "tiktok" | "facebook">,
): Promise<BucketResult> {
  if (handles.length === 0) return { posts: [], errors: [] };
  const result = await scrapeHandlesAcrossPlatforms(handles, postsPerHandle, platforms);
  result.posts.forEach((p) => { p.bucket = bucket; });
  console.log(`${bucket}: ${result.posts.length} posts from ${handles.length} handles across [${platforms.join(",")}]`);
  return result;
}

// Fan a list of handles across the enabled platforms and merge results.
async function scrapeHandlesAcrossPlatforms(
  handles: string[],
  postsPerHandle: number,
  platforms: Array<"instagram" | "tiktok" | "facebook">,
): Promise<BucketResult> {
  const errors: string[] = [];
  const posts: ScrapedPost[] = [];

  const tasks: Array<Promise<ScrapedPost[]>> = [];
  if (platforms.includes("instagram")) {
    // chunk for IG
    const chunks: string[][] = [];
    for (let i = 0; i < handles.length; i += APIFY_CHUNK_SIZE) {
      chunks.push(handles.slice(i, i + APIFY_CHUNK_SIZE));
    }
    chunks.forEach((c) => tasks.push(runApifyForHandles(c, postsPerHandle)));
  }
  if (platforms.includes("tiktok")) {
    handles.forEach((h) => tasks.push(runTikTokScraper(h, postsPerHandle)));
  }
  if (platforms.includes("facebook")) {
    handles.forEach((h) => tasks.push(runFacebookScraper(h, postsPerHandle)));
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

  return { posts, errors };
}

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

async function runApifyForHandles(handles: string[], resultsLimit: number): Promise<ScrapedPost[]> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) {
    console.error("APIFY_TOKEN not configured; skipping Apify scrape");
    return [];
  }
  const igUrls = handles
    .map((h) => `https://www.instagram.com/${h.replace(/^@/, "")}/`)
    .filter((u) => u.includes("instagram.com"));
  if (igUrls.length === 0) return [];

  const input = {
    directUrls: igUrls,
    resultsType: "posts",
    resultsLimit,
    addParentData: false,
  };

  const runUrl = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${apifyToken}&timeout=${APIFY_TIMEOUT_SEC}`;

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
        bucket: "competitor" as const, // overwritten by caller
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

// ---------- TikTok via clockworks/tiktok-scraper ----------
async function runTikTokScraper(handle: string, resultsLimit: number): Promise<ScrapedPost[]> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) return [];
  const cleaned = handle.replace(/^@/, "");
  const input = {
    profiles: [cleaned],
    resultsPerPage: resultsLimit,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
  };
  const url = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=${APIFY_TIMEOUT_SEC}`;
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
        ? it.hashtags
            .map((h) => (typeof h === "string" ? h : h?.name))
            .filter((h): h is string => !!h)
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

// ---------- Facebook via apify/facebook-pages-scraper ----------
async function runFacebookScraper(handle: string, resultsLimit: number): Promise<ScrapedPost[]> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) return [];
  const cleaned = handle.replace(/^@/, "");
  const input = {
    startUrls: [{ url: `https://www.facebook.com/${cleaned}/` }],
    resultsLimit,
  };
  const url = `https://api.apify.com/v2/acts/apify~facebook-pages-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=${APIFY_TIMEOUT_SEC}`;
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
