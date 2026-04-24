// content-lab-image-proxy
//
// Proxies Instagram (and other CDN) thumbnails so they can be hot-linked
// from our app without being blocked by Instagram's anti-hotlink referrer
// checks. Returns the image bytes with a long cache header. On any failure
// returns 404 so the client falls back to a branded placeholder.
//
// Usage: GET /functions/v1/content-lab-image-proxy?url=<encoded-url>

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const ALLOWED_HOST_SUFFIXES = [
  "cdninstagram.com",
  "fbcdn.net",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokv.com",
  "akamaized.net",
];

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB safety cap

function isAllowed(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("url");
    if (!target) return notFound("missing url param");

    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return notFound("invalid url");
    }
    if (parsed.protocol !== "https:") return notFound("non-https");
    if (!isAllowed(parsed)) return notFound("host not allowed");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const upstream = await fetch(parsed.toString(), {
      signal: ctrl.signal,
      headers: {
        // Instagram serves placeholder PNGs to non-IG referrers — pretend to be
        // an Instagram web client so we get the real image bytes.
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 Instagram 290.0.0",
        Accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8",
        Referer: parsed.origin + "/",
      },
    }).catch(() => null);
    clearTimeout(timer);

    if (!upstream || !upstream.ok || !upstream.body) {
      return notFound("upstream fail");
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return notFound("not an image");

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
      return notFound("size out of range");
    }

    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        // Cache aggressively at the edge — IG URLs change but content for the
        // same URL never does.
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch (e) {
    console.error("[content-lab-image-proxy]", e);
    return notFound("error");
  }
});

function notFound(reason: string): Response {
  return new Response(reason, { status: 404, headers: corsHeaders });
}
