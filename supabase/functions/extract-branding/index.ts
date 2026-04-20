const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

/** Ensure hex codes start with # */
const normaliseHex = (color: string | undefined | null): string | null => {
  if (!color) return null;
  const clean = color.trim();
  if (!clean) return null;
  return clean.startsWith('#') ? clean : `#${clean}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "extract-branding", method: req.method, connection_id: null }));

  try {
    // ── Auth verification ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side URL safety + cost gates
    const { validateSafeUrl } = await import('../_shared/safeUrl.ts');
    const { assertPlatformNotFrozen, recordCost, estimateFirecrawl, PlatformFrozenError } = await import('../_shared/costGuard.ts');
    const safe = validateSafeUrl(url);
    if (!safe.ok || !safe.url) {
      return new Response(JSON.stringify({ error: `Invalid URL (${safe.reason})` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      await assertPlatformNotFrozen();
    } catch (e) {
      if (e instanceof PlatformFrozenError) {
        return new Response(JSON.stringify({ error: 'Branding extraction temporarily disabled (platform spend freeze).' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw e;
    }

    // Look up org for cost attribution (best-effort, non-blocking)
    let orgIdForCost: string | null = null;
    try {
      const { data: prof } = await anonClient.from('profiles').select('org_id').eq('user_id', claimsData.claims.sub).maybeSingle();
      orgIdForCost = (prof as { org_id?: string } | null)?.org_id ?? null;
    } catch { /* ignore */ }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Branding extraction is not configured. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedUrl = safe.url;

    console.log('Extracting branding from:', formattedUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['extract'],
        extract: {
          schema: {
            type: 'object',
            properties: {
              primary_color:   { type: 'string', description: 'The main brand colour as hex code e.g. #B32FBF' },
              secondary_color: { type: 'string', description: 'The secondary brand colour as hex code' },
              accent_color:    { type: 'string', description: 'The accent or highlight colour as hex code' },
              heading_font:    { type: 'string', description: 'The heading or display font name e.g. Montserrat' },
              body_font:       { type: 'string', description: 'The body text font name e.g. Inter' },
              logo_url:        { type: 'string', description: 'Absolute URL of the company logo image' },
              org_name:        { type: 'string', description: 'The company or brand name' },
            },
          },
        },
      }),
    });

    if (orgIdForCost) {
      await recordCost({
        orgId: orgIdForCost, service: 'firecrawl', operation: 'extract_branding',
        pence: estimateFirecrawl(), metadata: { url: formattedUrl },
      });
    }

    if (!response.ok) {
      const err = await response.text();
      console.error('Firecrawl API error:', err);
      return new Response(
        JSON.stringify({ error: 'Failed to extract branding from URL' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const extracted = data?.data?.extract ?? {};

    // Check if we got anything useful
    const hasColors = extracted.primary_color || extracted.secondary_color || extracted.accent_color;
    const hasFonts = extracted.heading_font || extracted.body_font;

    if (!hasColors && !hasFonts && !extracted.logo_url) {
      return new Response(
        JSON.stringify({
          error: "We couldn't detect colours automatically — try a page with more visible brand elements, like your About page",
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Branding extracted successfully');
    return new Response(
      JSON.stringify({
        primary_color:   normaliseHex(extracted.primary_color),
        secondary_color: normaliseHex(extracted.secondary_color),
        accent_color:    normaliseHex(extracted.accent_color),
        heading_font:    extracted.heading_font ?? null,
        body_font:       extracted.body_font ?? null,
        logo_url:        extracted.logo_url ?? null,
        org_name:        extracted.org_name ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error extracting branding:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract branding';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
