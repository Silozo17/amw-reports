// Cloudflare Turnstile token verification.
// Called by signup + password-reset forms before submitting to Supabase Auth.
// Requires TURNSTILE_SECRET_KEY in secrets. Until that's configured, the
// function returns ok:true with a `dev_mode` flag so the frontend keeps working.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // GET = expose the public site key so the frontend widget can render.
  // Site key is non-secret by Cloudflare design; this avoids hard-coding it
  // in the client bundle and keeps rotation server-side.
  if (req.method === 'GET') {
    const siteKey = Deno.env.get('TURNSTILE_SITE_KEY') ?? '';
    return json({ site_key: siteKey, configured: !!siteKey });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  try {
    const { token } = await req.json();
    const secret = Deno.env.get('TURNSTILE_SECRET_KEY');

    // Until the user provides Turnstile keys, allow signup but flag.
    if (!secret) {
      return json({ ok: true, dev_mode: true, reason: 'turnstile_not_configured' });
    }
    if (!token || typeof token !== 'string') {
      return json({ ok: false, error: 'missing_token' }, 400);
    }

    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', token);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: form,
    });
    const data = await res.json() as { success: boolean; 'error-codes'?: string[] };

    if (!data.success) {
      return json({ ok: false, error: 'turnstile_failed', codes: data['error-codes'] }, 400);
    }
    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return json({ ok: false, error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
