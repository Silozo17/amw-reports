// Public image proxy for Instagram / Facebook / TikTok CDN thumbnails.
// These CDNs sign URLs and block cross-origin browser requests via referrer policy,
// so we fetch server-side and stream bytes back to the browser.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const ALLOWED_HOST_SUFFIXES = [
  'cdninstagram.com',
  'fbcdn.net',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokv.com',
  'akamaized.net',
];

// 1×1 transparent PNG fallback so cards never show a broken icon
const TRANSPARENT_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  ),
  (c) => c.charCodeAt(0),
);

const fallback = () =>
  new Response(TRANSPARENT_PNG, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
    },
  });

const isAllowedHost = (host: string): boolean =>
  ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Note: Auth headers cannot be sent from <img> tags, so this proxy is
  // intentionally publicly callable. Abuse is bounded by the strict hostname
  // allow-list (Instagram / Facebook / TikTok CDN suffixes only) and the
  // long Cache-Control header letting Supabase edge cache absorb load.

  try {
    const { searchParams } = new URL(req.url);
    const target = searchParams.get('url');
    if (!target) return fallback();

    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return fallback();
    }

    if (parsed.protocol !== 'https:' || !isAllowedHost(parsed.hostname)) {
      return fallback();
    }

    const upstream = await fetch(parsed.toString(), {
      headers: {
        // Mimic a normal browser request; some CDNs 403 without a UA
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    const contentType = upstream.headers.get('Content-Type') ?? 'image/jpeg';
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      fn: 'content-lab-image-proxy',
      host: parsed.hostname,
      status: upstream.status,
      contentType,
    }));

    if (!upstream.ok || !upstream.body) {
      return fallback();
    }

    if (!contentType.startsWith('image/')) {
      return fallback();
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (_err) {
    return fallback();
  }
});
