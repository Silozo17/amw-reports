// content-lab-scrape: pulls posts for a run.
// - For tracked handles with platform=instagram and a matching client OAuth connection -> Instagram Graph API
// - For all other tracked handles + competitor URLs -> Apify (instagram-scraper actor)
// Writes rows to content_lab_posts. Idempotent: caller (pipeline) clears posts for the run first.

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
const MAX_POSTS_PER_HANDLE = 30;
const MAX_TOTAL_POSTS = 200;

interface TrackedHandle { platform: string; handle: string }
interface ScrapedPost {
  platform: "instagram" | "tiktok" | "facebook";
  source: "oauth" | "apify";
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
    if (!run_id) {
      return json({ error: "run_id is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load run + niche
    const { data: run, error: runErr } = await supabase
      .from("content_lab_runs").select("*, niche:niche_id(*)").eq("id", run_id).single();
    if (runErr || !run) return json({ error: "Run not found" }, 404);

    const niche = (run as { niche: {
      tracked_handles: TrackedHandle[];
      competitor_urls: string[];
      tracked_hashtags: string[];
      client_id: string;
    } }).niche;

    const handles = (niche.tracked_handles ?? []) as TrackedHandle[];
    const competitorUrls = niche.competitor_urls ?? [];

    // Split handles: instagram with OAuth vs everything else (Apify)
    const igHandles = handles.filter((h) => h.platform === "instagram");
    const apifyHandles = handles.filter((h) => h.platform !== "instagram");

    const collected: ScrapedPost[] = [];

    // ---------- OAuth path: Instagram via existing platform_connections ----------
    const { data: igConn } = await supabase
      .from("platform_connections")
      .select("id, access_token, account_id, account_name, is_connected")
      .eq("client_id", niche.client_id)
      .eq("platform", "instagram")
      .eq("is_connected", true)
      .maybeSingle();

    const apifyTargets: string[] = competitorUrls.slice();

    if (igConn?.access_token && igHandles.length > 0) {
      const token = await decryptToken(igConn.access_token);
      // We can only fetch our own connected IG account via Graph API.
      // For other handles, fall back to Apify.
      const ownAccount = igConn.account_name?.toLowerCase().replace(/^@/, "");
      for (const h of igHandles) {
        const handle = h.handle.toLowerCase().replace(/^@/, "");
        if (ownAccount && handle === ownAccount) {
          const posts = await fetchOwnInstagramPosts(igConn.account_id!, token, handle);
          collected.push(...posts);
        } else {
          apifyTargets.push(`https://www.instagram.com/${handle}/`);
        }
      }
    } else {
      for (const h of igHandles) {
        apifyTargets.push(`https://www.instagram.com/${h.handle.replace(/^@/, "")}/`);
      }
    }

    for (const h of apifyHandles) {
      // Best-effort URLs for non-IG platforms (kept for Phase 2; Apify actor below ignores non-IG)
      apifyTargets.push(`https://www.${h.platform}.com/${h.handle.replace(/^@/, "")}/`);
    }

    // ---------- Apify path: Instagram scraper ----------
    if (apifyTargets.length > 0) {
      const apifyToken = Deno.env.get("APIFY_TOKEN");
      if (!apifyToken) {
        console.error("APIFY_TOKEN not configured; skipping Apify scrape");
      } else {
        const apifyPosts = await runApifyInstagram(apifyToken, apifyTargets);
        collected.push(...apifyPosts);
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

    // Compute engagement_rate (likes+comments)/max(views,1) — lightweight; analyse fn can refine
    const rows = deduped.map((p) => ({
      run_id,
      platform: p.platform,
      source: p.source,
      author_handle: p.author_handle,
      post_url: p.post_url,
      post_type: p.post_type,
      caption: p.caption,
      thumbnail_url: p.thumbnail_url,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      views: p.views,
      engagement_rate: p.views > 0
        ? (p.likes + p.comments) / p.views
        : (p.likes + p.comments) / 1000,
      posted_at: p.posted_at,
    }));

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from("content_lab_posts").insert(rows);
      if (insertErr) {
        console.error("Insert posts failed:", insertErr);
        return json({ error: insertErr.message }, 500);
      }
    }

    return json({ ok: true, post_count: rows.length });
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

async function runApifyInstagram(token: string, urls: string[]): Promise<ScrapedPost[]> {
  // Filter to instagram URLs (the actor only handles IG)
  const igUrls = urls.filter((u) => u.includes("instagram.com"));
  if (igUrls.length === 0) return [];

  const input = {
    directUrls: igUrls,
    resultsType: "posts",
    resultsLimit: MAX_POSTS_PER_HANDLE,
    addParentData: false,
  };

  const runUrl = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=50`;

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
