// content-lab-pool-refresh: builds the verified benchmark pool for a niche_tag.
//
// v2 changes (A1 fixes):
//  - Chunked background execution via EdgeRuntime.waitUntil so the HTTP response returns
//    immediately and verification continues for up to 400s past the response.
//  - Relative thresholds: instead of hard cutoffs, we collect verification stats for ALL
//    candidates, then keep the top decile by median views per platform (with absolute floors
//    so we don't accept genuinely tiny accounts).
//  - Watchdog hook: stale "running" jobs older than 15 min are auto-marked failed at the
//    start of every invocation.
//
// Triggered by: content-lab-discover after a niche is saved/updated, OR by cron / admin.
// Idempotent: re-running for the same niche_tag refreshes the pool and updates verified_at.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// Tunables — kept conservative to bound Apify spend per pool refresh.
const HASHTAGS_PER_REFRESH = 4;
const POSTS_PER_HASHTAG = 30;
const MAX_CANDIDATES = 25;
const MAX_SAMPLED_TARGET = 18; // sample more so relative thresholds have signal
const APIFY_TIMEOUT_SEC = 90;
const STALE_JOB_MINUTES = 15;

// Absolute floors — accounts below these are always rejected, even in slow niches.
const ABSOLUTE_MIN_FOLLOWERS = 5_000;
const ABSOLUTE_MIN_MEDIAN_VIEWS = 2_000;
const MAX_DAYS_SINCE_LAST_POST = 60;
const MIN_POSTS_SAMPLED = 4;
// Relative selection — keep top X% of sampled accounts by median views per platform.
const TOP_PERCENTILE_KEEP = 0.6; // keep top 60% (was hard threshold rejecting 100%)
const MIN_VERIFIED_OUTPUT = 5;
const MAX_VERIFIED_OUTPUT = 15;

interface RefreshInput {
  niche_tag: string;
  platforms?: Array<"instagram" | "tiktok" | "facebook">;
  hashtags?: string[];
  keywords?: string[];
  org_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "content-lab-pool-refresh", method: req.method }));

  try {
    if (!APIFY_TOKEN) return json({ error: "APIFY_TOKEN not configured" }, 500);

    const input = (await req.json()) as RefreshInput;
    if (!input.niche_tag) return json({ error: "niche_tag is required" }, 400);

    const platforms = input.platforms?.length ? input.platforms : ["instagram"];
    const hashtags = (input.hashtags ?? []).slice(0, HASHTAGS_PER_REFRESH);
    const keywords = (input.keywords ?? []).slice(0, 3);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Watchdog: clean up stale running jobs from previous invocations.
    await reapStaleJobs(admin);

    // Create job rows synchronously so the caller has IDs to poll.
    const jobIds: Array<{ platform: string; jobId: string | null }> = [];
    for (const platform of platforms) {
      const { data: jobRow } = await admin
        .from("content_lab_pool_refresh_jobs")
        .insert({
          niche_tag: input.niche_tag,
          platform,
          status: "running",
          triggered_by_org_id: input.org_id ?? null,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      jobIds.push({ platform, jobId: (jobRow as { id?: string } | null)?.id ?? null });
    }

    // Detach the heavy work — return 202 immediately, continue in background.
    const work = (async () => {
      for (const { platform, jobId } of jobIds) {
        try {
          const summary = await refreshOnePlatform(admin, {
            niche_tag: input.niche_tag,
            platform: platform as "instagram" | "tiktok" | "facebook",
            hashtags,
            keywords,
          });
          if (jobId) {
            await admin
              .from("content_lab_pool_refresh_jobs")
              .update({
                status: "completed",
                candidates_found: summary.found,
                candidates_verified: summary.verified,
                completed_at: new Date().toISOString(),
              })
              .eq("id", jobId);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown";
          console.error(`Pool refresh ${platform} failed:`, msg);
          if (jobId) {
            await admin
              .from("content_lab_pool_refresh_jobs")
              .update({
                status: "failed",
                error_message: msg,
                completed_at: new Date().toISOString(),
              })
              .eq("id", jobId);
          }
        }
      }
    })();

    // @ts-ignore - EdgeRuntime is provided by Supabase Deno runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work);
    } else {
      // Fallback: run inline (will be subject to request timeout).
      await work;
    }

    return json({ ok: true, niche_tag: input.niche_tag, jobs: jobIds, status: "queued" }, 202);
  } catch (e) {
    console.error("content-lab-pool-refresh error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function reapStaleJobs(admin: ReturnType<typeof createClient>): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_JOB_MINUTES * 60_000).toISOString();
  const { error } = await admin
    .from("content_lab_pool_refresh_jobs")
    .update({
      status: "failed",
      error_message: `Watchdog: job exceeded ${STALE_JOB_MINUTES}min runtime`,
      completed_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("started_at", cutoff);
  if (error) console.error("reapStaleJobs error:", error);
}

interface RefreshArgs {
  niche_tag: string;
  platform: "instagram" | "tiktok" | "facebook";
  hashtags: string[];
  keywords: string[];
}

async function refreshOnePlatform(
  admin: ReturnType<typeof createClient>,
  args: RefreshArgs,
): Promise<{ found: number; verified: number }> {
  // 1. Harvest candidate handles from hashtags / keyword search.
  let candidates = await harvestCandidates(args);
  console.log(`[${args.platform}/${args.niche_tag}] harvested ${candidates.length} candidates`);

  // 2. LLM seed fallback if too few — only IG (most reliable).
  if (candidates.length < 8 && args.platform === "instagram" && LOVABLE_API_KEY) {
    const seed = await llmSeedHandles(args.niche_tag, args.platform);
    candidates = dedupe([...candidates, ...seed]);
    console.log(`[${args.platform}/${args.niche_tag}] +${seed.length} LLM seeds, total ${candidates.length}`);
  }

  candidates = candidates.slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) return { found: 0, verified: 0 };

  // 3. Sample each candidate (NOT pass/fail yet — gather metrics for relative ranking).
  const sampled: SampledAccount[] = [];
  for (const handle of candidates) {
    if (sampled.length >= MAX_SAMPLED_TARGET) break;
    try {
      const s = await sampleHandle(handle, args.platform);
      if (s) sampled.push(s);
    } catch (e) {
      console.error(`Sample @${handle} failed:`, e);
    }
  }

  if (sampled.length === 0) return { found: candidates.length, verified: 0 };

  // 4. Relative selection: rank by median_views, keep top percentile, apply absolute floors.
  const verified = selectTopAccounts(sampled);

  // 5. Mark previous pool entries stale, then upsert survivors.
  await admin
    .from("content_lab_benchmark_pool")
    .update({ status: "stale", updated_at: new Date().toISOString() })
    .eq("niche_tag", args.niche_tag)
    .eq("platform", args.platform);

  for (const v of verified) {
    await admin.from("content_lab_benchmark_pool").upsert(
      {
        niche_tag: args.niche_tag,
        platform: args.platform,
        handle: v.handle,
        display_name: v.display_name,
        follower_count: v.follower_count,
        median_views: v.median_views,
        median_engagement_rate: v.median_engagement_rate,
        last_post_at: v.last_post_at,
        posts_analysed: v.posts_analysed,
        thumbnail_url: v.thumbnail_url,
        profile_url: v.profile_url,
        status: "verified",
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        rejection_reason: null,
      },
      { onConflict: "niche_tag,platform,handle", ignoreDuplicates: false },
    );
  }

  return { found: candidates.length, verified: verified.length };
}

// ============== Selection (relative thresholds) ==============

function selectTopAccounts(sampled: SampledAccount[]): SampledAccount[] {
  // Apply hard floors first (truly inactive or microscopic).
  const floor = sampled.filter((s) => {
    if (s.follower_count !== null && s.follower_count < ABSOLUTE_MIN_FOLLOWERS) return false;
    if (s.median_views < ABSOLUTE_MIN_MEDIAN_VIEWS) return false;
    if (s.last_post_at && daysSince(s.last_post_at) > MAX_DAYS_SINCE_LAST_POST) return false;
    if (s.posts_analysed < MIN_POSTS_SAMPLED) return false;
    return true;
  });

  if (floor.length === 0) return [];

  // Rank by median_views desc, keep top percentile.
  const ranked = [...floor].sort((a, b) => b.median_views - a.median_views);
  const cutoffIdx = Math.max(MIN_VERIFIED_OUTPUT, Math.ceil(ranked.length * TOP_PERCENTILE_KEEP));
  return ranked.slice(0, Math.min(cutoffIdx, MAX_VERIFIED_OUTPUT));
}

// ============== Harvesting ==============

async function harvestCandidates(args: RefreshArgs): Promise<string[]> {
  if (args.platform === "instagram") {
    return harvestIgHashtags(args.hashtags);
  }
  if (args.platform === "tiktok") {
    return harvestTtHashtags(args.hashtags);
  }
  if (args.platform === "facebook") {
    return harvestFbKeywords(args.keywords.length ? args.keywords : args.hashtags);
  }
  return [];
}

async function harvestIgHashtags(hashtags: string[]): Promise<string[]> {
  if (hashtags.length === 0) return [];
  const cleaned = hashtags.map((h) => h.replace(/^#/, "")).filter(Boolean);
  const url = `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=${APIFY_TIMEOUT_SEC}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hashtags: cleaned, resultsLimit: POSTS_PER_HASHTAG }),
    });
    if (!res.ok) {
      console.error("IG hashtag harvest error:", res.status, await res.text());
      return [];
    }
    const items = await res.json();
    if (!Array.isArray(items)) return [];
    const ranked = [...items].sort((a, b) =>
      ((b.videoViewCount ?? b.likesCount ?? 0) as number) - ((a.videoViewCount ?? a.likesCount ?? 0) as number),
    );
    return dedupe(
      ranked
        .map((it: { ownerUsername?: string }) => it.ownerUsername?.toLowerCase())
        .filter((h): h is string => !!h),
    );
  } catch (e) {
    console.error("IG hashtag fetch failed:", e);
    return [];
  }
}

async function harvestTtHashtags(hashtags: string[]): Promise<string[]> {
  if (hashtags.length === 0) return [];
  const cleaned = hashtags.map((h) => h.replace(/^#/, "")).filter(Boolean);
  const url = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=${APIFY_TIMEOUT_SEC}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hashtags: cleaned,
        resultsPerPage: POSTS_PER_HASHTAG,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
      }),
    });
    if (!res.ok) {
      console.error("TT hashtag harvest error:", res.status, await res.text());
      return [];
    }
    const items = await res.json();
    if (!Array.isArray(items)) return [];
    const ranked = [...items].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));
    return dedupe(
      ranked
        .map((it: { authorMeta?: { name?: string } }) => it.authorMeta?.name?.toLowerCase())
        .filter((h): h is string => !!h),
    );
  } catch (e) {
    console.error("TT hashtag fetch failed:", e);
    return [];
  }
}

async function harvestFbKeywords(keywords: string[]): Promise<string[]> {
  if (keywords.length === 0) return [];
  const url = `https://api.apify.com/v2/acts/apify~facebook-pages-search-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=${APIFY_TIMEOUT_SEC}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ search: keywords.slice(0, 3), maxItems: 30 }),
    });
    if (!res.ok) {
      console.error("FB search harvest error:", res.status, await res.text());
      return [];
    }
    const items = await res.json();
    if (!Array.isArray(items)) return [];
    return dedupe(
      items
        .map((it: { pageUrl?: string; url?: string; pageName?: string }) => {
          const slug = it.pageUrl?.match(/facebook\.com\/([^/?#]+)/i)?.[1]
            ?? it.url?.match(/facebook\.com\/([^/?#]+)/i)?.[1]
            ?? it.pageName;
          return slug?.toLowerCase();
        })
        .filter((h): h is string => !!h),
    );
  } catch (e) {
    console.error("FB search failed:", e);
    return [];
  }
}

// ============== LLM seed fallback ==============

async function llmSeedHandles(nicheTag: string, platform: string): Promise<string[]> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Return only well-known, currently-active handles. JSON array of strings." },
          {
            role: "user",
            content: `5 well-known ${platform} accounts in the niche "${nicheTag.replace(/-/g, " ")}" with 100k+ followers. Return ONLY a JSON array of handles without @.`,
          },
        ],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr) ? arr.filter((h): h is string => typeof h === "string").map((h) => h.replace(/^@/, "").toLowerCase()) : [];
  } catch {
    return [];
  }
}

// ============== Sampling (no pass/fail — just collect metrics) ==============

interface SampledAccount {
  handle: string;
  display_name: string | null;
  follower_count: number | null;
  median_views: number;
  median_engagement_rate: number;
  last_post_at: string | null;
  posts_analysed: number;
  thumbnail_url: string | null;
  profile_url: string;
}

async function sampleHandle(handle: string, platform: "instagram" | "tiktok" | "facebook"): Promise<SampledAccount | null> {
  if (platform === "instagram") return sampleIg(handle);
  if (platform === "tiktok") return sampleTt(handle);
  if (platform === "facebook") return sampleFb(handle);
  return null;
}

const median = (arr: number[]) => arr.length ? [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)] : 0;

async function sampleIg(handle: string): Promise<SampledAccount | null> {
  const url = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=${APIFY_TIMEOUT_SEC}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [`https://www.instagram.com/${handle}/`],
      resultsType: "posts",
      resultsLimit: 12,
      addParentData: true,
    }),
  });
  if (!res.ok) return null;
  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) return null;
  const followerCount = (items[0]?.ownerFollowersCount as number | undefined) ?? null;
  const views = items.map((i) => (i.videoViewCount ?? i.videoPlayCount ?? 0) as number).filter((v) => v > 0);
  const likes = items.map((i) => (i.likesCount ?? 0) as number);
  const lastPost = items[0]?.timestamp as string | undefined;
  const medianViews = median(views.length ? views : likes.map((l) => l * 10));
  const medianEr = followerCount && followerCount > 0 ? median(likes) / followerCount : 0;
  return {
    handle,
    display_name: items[0]?.ownerFullName ?? null,
    follower_count: followerCount,
    median_views: medianViews,
    median_engagement_rate: medianEr,
    last_post_at: lastPost ?? null,
    posts_analysed: items.length,
    thumbnail_url: items[0]?.displayUrl ?? null,
    profile_url: `https://www.instagram.com/${handle}/`,
  };
}

async function sampleTt(handle: string): Promise<SampledAccount | null> {
  const url = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=${APIFY_TIMEOUT_SEC}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profiles: [handle],
      resultsPerPage: 12,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
    }),
  });
  if (!res.ok) return null;
  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) return null;
  const followers = (items[0]?.authorMeta?.fans as number | undefined) ?? null;
  const views = items.map((i) => (i.playCount ?? 0) as number);
  const likes = items.map((i) => (i.diggCount ?? 0) as number);
  const lastPost = items[0]?.createTimeISO as string | undefined;
  return {
    handle,
    display_name: items[0]?.authorMeta?.nickName ?? null,
    follower_count: followers,
    median_views: median(views),
    median_engagement_rate: followers && followers > 0 ? median(likes) / followers : 0,
    last_post_at: lastPost ?? null,
    posts_analysed: items.length,
    thumbnail_url: items[0]?.videoMeta?.coverUrl ?? null,
    profile_url: `https://www.tiktok.com/@${handle}`,
  };
}

async function sampleFb(handle: string): Promise<SampledAccount | null> {
  const url = `https://api.apify.com/v2/acts/apify~facebook-pages-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=${APIFY_TIMEOUT_SEC}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startUrls: [{ url: `https://www.facebook.com/${handle}/` }],
      resultsLimit: 12,
    }),
  });
  if (!res.ok) return null;
  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) return null;
  const followers = (items[0]?.likes as number | undefined) ?? null;
  const views = items.map((i) => (i.videoViewCount ?? 0) as number).filter((v) => v > 0);
  const likes = items.map((i) => (i.likesCount ?? 0) as number);
  const lastPost = items[0]?.time as string | undefined;
  return {
    handle,
    display_name: items[0]?.pageName ?? null,
    follower_count: followers,
    median_views: median(views.length ? views : likes.map((l) => l * 5)),
    median_engagement_rate: 0,
    last_post_at: lastPost ?? null,
    posts_analysed: items.length,
    thumbnail_url: items[0]?.topImage ?? null,
    profile_url: `https://www.facebook.com/${handle}/`,
  };
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.map((h) => h.toLowerCase().replace(/^@/, ""))));
}

function daysSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}
