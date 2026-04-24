// firecrawl-find-socials: scrape a website's homepage and extract Instagram /
// TikTok / Facebook handles from outbound links.
// POST { url } -> { instagram?: string, tiktok?: string, facebook?: string, source: 'firecrawl' | 'none' }
//
// Single Firecrawl scrape (~1 credit). Never throws on failure — returns
// { source: 'none' } so the caller can fall back to AI guessing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

interface SocialHandles {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
}

// Paths that look like usernames but aren't.
const HANDLE_BLOCKLIST = new Set([
  "share", "sharer", "intent", "explore", "directory", "p", "reel", "reels",
  "stories", "tv", "tag", "tags", "accounts", "developers", "about",
  "help", "privacy", "policies", "tos", "terms", "legal", "embed",
  "video", "watch", "groups", "events", "marketplace", "gaming",
  "messenger", "business", "ads", "pages", "settings", "login", "signup",
  "home", "discover", "trending", "music", "search", "foryou",
]);

function extractHandle(link: string, host: "instagram.com" | "tiktok.com" | "facebook.com"): string | null {
  try {
    const u = new URL(link);
    const h = u.hostname.replace(/^www\./, "").toLowerCase();
    if (h !== host && !h.endsWith("." + host)) return null;
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    let raw = segments[0];
    if (host === "tiktok.com") raw = raw.replace(/^@/, "");
    raw = raw.toLowerCase();
    if (!raw || raw.length < 2 || raw.length > 30) return null;
    if (HANDLE_BLOCKLIST.has(raw)) return null;
    if (!/^[a-z0-9._-]+$/.test(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

function pickSocials(links: string[]): SocialHandles {
  const result: SocialHandles = {};
  for (const link of links) {
    if (!result.instagram) {
      const ig = extractHandle(link, "instagram.com");
      if (ig) result.instagram = ig;
    }
    if (!result.tiktok) {
      const tt = extractHandle(link, "tiktok.com");
      if (tt) result.tiktok = tt;
    }
    if (!result.facebook) {
      const fb = extractHandle(link, "facebook.com");
      if (fb) result.facebook = fb;
    }
    if (result.instagram && result.tiktok && result.facebook) break;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "firecrawl-find-socials", method: req.method }));

  try {
    // Auth: accept either a logged-in user JWT OR the service role key
    // (so the orchestrator edge function can call this internally).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!isServiceRole) {
      const anon = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data, error } = await anon.auth.getUser();
      if (error || !data?.user?.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ source: "none", error: "FIRECRAWL_API_KEY not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
    if (!rawUrl) {
      return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const normalizedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    try { new URL(normalizedUrl); } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single homepage scrape — `links` format only. Include header/footer
    // (where social icons usually live) by disabling onlyMainContent.
    const fcRes = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: normalizedUrl,
        formats: ["links"],
        onlyMainContent: false,
      }),
    });

    if (!fcRes.ok) {
      const errText = await fcRes.text().catch(() => "");
      console.error("Firecrawl scrape failed:", fcRes.status, errText.slice(0, 200));
      return new Response(JSON.stringify({ source: "none", error: `Firecrawl ${fcRes.status}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fcData = await fcRes.json().catch(() => ({}));
    const links: string[] = (fcData?.data?.links ?? fcData?.links ?? []) as string[];
    if (!Array.isArray(links) || links.length === 0) {
      return new Response(JSON.stringify({ source: "none" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const socials = pickSocials(links);
    const found = Boolean(socials.instagram || socials.tiktok || socials.facebook);

    return new Response(
      JSON.stringify({ ...socials, source: found ? "firecrawl" : "none" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("firecrawl-find-socials error:", err);
    return new Response(
      JSON.stringify({ source: "none", error: err instanceof Error ? err.message : String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
