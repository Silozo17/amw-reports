// content-lab-scrape: pulls posts for a run.
// Sources, in priority order:
//   1. Own handle via Instagram Graph API (if OAuth-connected)
//   2. Top competitors (from niche.top_competitors[].handle) via Apify
//   3. Top global benchmarks (from niche.top_global_benchmarks[].handle) via Apify
//   4. Legacy tracked_handles + competitor_urls (back-compat)
// Per-platform isolation: a failure in one source does not abort the rest.

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
const MAX_POSTS_PER_HANDLE = 20;
const MAX_TOTAL_POSTS = 300;

interface DiscoveredEntity { handle: string; reason?: string }
interface TrackedHandle { platform: string; handle: string }

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
      tracked_handles: TrackedHandle[];
      competitor_urls: string[];
      client_id: string;
      platforms_to_scrape: string[];
    } }).niche;

    const collected: ScrapedPost[] = [];
    const errors: string[] = [];

    // ---------- 1. Own handle via OAuth ----------
    if (niche.own_handle) {
      try {
        const { data: igConn } = await supabase
          .from("platform_connections")
          .select("id, access_token, account_id, account_name, is_connected")
          .eq("client_id", niche.client_id)
          .eq("platform", "instagram")
          .eq("is_connected", true)
          .maybeSingle();

        const ownHandle = niche.own_handle.toLowerCase().replace(/^@/, "");
        const connHandle = igConn?.account_name?.toLowerCase().replace(/^@/, "");

        if (igConn?.access_token && igConn.account_id && connHandle === ownHandle) {
          const token = await decryptToken(igConn.access_token);
          const posts = await fetchOwnInstagramPosts(igConn.account_id, token, ownHandle);
          posts.forEach((p) => { p.bucket = "own"; });
          collected.push(...posts);
          console.log(`Own (OAuth): ${posts.length} posts for @${ownHandle}`);
        } else {
          // Fallback to Apify for own handle
          const posts = await scrapeApifyHandles([ownHandle]);
          posts.forEach((p) => { p.bucket = "own"; });
          collected.push(...posts);
          console.log(`Own (Apify): ${posts.length} posts for @${ownHandle}`);
        }
      } catch (e) {
        const msg = `Own handle scrape failed: ${e instanceof Error ? e.message : e}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // ---------- 2. Top competitors ----------
    const competitorHandles = (niche.top_competitors ?? [])
      .map((c) => c.handle?.toLowerCase().replace(/^@/, ""))
      .filter((h): h is string => !!h);
    if (competitorHandles.length > 0) {
      try {
        const posts = await scrapeApifyHandles(competitorHandles);
        posts.forEach((p) => { p.bucket = "competitor"; });
        collected.push(...posts);
        console.log(`Competitors: ${posts.length} posts from ${competitorHandles.length} handles`);
      } catch (e) {
        const msg = `Competitor scrape failed: ${e instanceof Error ? e.message : e}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // ---------- 3. Global benchmarks ----------
    const benchmarkHandles = (niche.top_global_benchmarks ?? [])
      .map((b) => b.handle?.toLowerCase().replace(/^@/, ""))
      .filter((h): h is string => !!h);
    if (benchmarkHandles.length > 0) {
      try {
        const posts = await scrapeApifyHandles(benchmarkHandles);
        posts.forEach((p) => { p.bucket = "benchmark"; });
        collected.push(...posts);
        console.log(`Benchmarks: ${posts.length} posts from ${benchmarkHandles.length} handles`);
      } catch (e) {
        const msg = `Benchmark scrape failed: ${e instanceof Error ? e.message : e}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // ---------- 4. Legacy back-compat (tracked_handles + competitor_urls) ----------
    const legacyHandles = (niche.tracked_handles ?? [])
      .filter((h) => h.platform === "instagram")
      .map((h) => h.handle.toLowerCase().replace(/^@/, ""));
    const legacyUrls = niche.competitor_urls ?? [];
    if (legacyHandles.length > 0 || legacyUrls.length > 0) {
      try {
        const allTargets = [
          ...legacyHandles.map((h) => `https://www.instagram.com/${h}/`),
          ...legacyUrls.filter((u) => u.includes("instagram.com")),
        ];
        if (allTargets.length > 0) {
          const posts = await runApifyInstagramByUrls(allTargets);
          posts.forEach((p) => { p.bucket = "legacy"; });
          collected.push(...posts);
          console.log(`Legacy: ${posts.length} posts`);
        }
      } catch (e) {
        const msg = `Legacy scrape failed: ${e instanceof Error ? e.message : e}`;
        console.error(msg);
        errors.push(msg);
      }
    }

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
      };
    });

    // Chunked insert: a bad row in one chunk shouldn't kill the entire run.
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

    // Persist per-bucket counts + any non-fatal errors back to the run summary
    // so they surface in the admin Run Detail drawer.
    const buckets = {
      own: rows.filter((r) => r.bucket === "own").length,
      competitor: rows.filter((r) => r.bucket === "competitor").length,
      benchmark: rows.filter((r) => r.bucket === "benchmark").length,
      legacy: rows.filter((r) => r.bucket === "legacy").length,
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

async function fetchOwnInstagramPosts(
  igUserId: string,
  accessToken: string,
  handle: string,
): Promise<ScrapedPost[]> {
  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
  const url = `https://graph.facebook.com/v25.0/${igUserId}/media?fields=${fields}&limit=${MAX_POSTS_PER_HANDLE}&access_token=${accessToken}`;
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
    }));
  } catch (e) {
    console.error("IG own fetch failed:", e);
    return [];
  }
}

async function scrapeApifyHandles(handles: string[]): Promise<ScrapedPost[]> {
  const urls = handles.map((h) => `https://www.instagram.com/${h.replace(/^@/, "")}/`);
  return runApifyInstagramByUrls(urls);
}

async function runApifyInstagramByUrls(urls: string[]): Promise<ScrapedPost[]> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) {
    console.error("APIFY_TOKEN not configured; skipping Apify scrape");
    return [];
  }

  const igUrls = urls.filter((u) => u.includes("instagram.com"));
  if (igUrls.length === 0) return [];

  const input = {
    directUrls: igUrls,
    resultsType: "posts",
    resultsLimit: MAX_POSTS_PER_HANDLE,
    addParentData: false,
  };

  const runUrl = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${apifyToken}&timeout=50`;

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
      ownerUsername?: string; url?: string; type?: string; caption?: string;
      displayUrl?: string; likesCount?: number; commentsCount?: number;
      videoViewCount?: number; videoPlayCount?: number; timestamp?: string;
    }) => ({
      platform: "instagram" as const,
      source: "apify" as const,
      bucket: "competitor" as const, // overwritten by caller
      author_handle: (it.ownerUsername ?? "unknown").toLowerCase(),
      post_url: it.url ?? null,
      post_type: it.type?.toLowerCase() ?? null,
      caption: it.caption ?? null,
      thumbnail_url: it.displayUrl ?? null,
      likes: it.likesCount ?? 0,
      comments: it.commentsCount ?? 0,
      shares: 0,
      views: it.videoViewCount ?? it.videoPlayCount ?? 0,
      posted_at: it.timestamp ?? null,
    }));
  } catch (e) {
    console.error("Apify fetch failed:", e);
    return [];
  }
}
