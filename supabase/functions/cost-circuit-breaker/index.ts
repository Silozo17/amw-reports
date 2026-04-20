// Cron job: every 5 minutes, sums platform-wide cost_events over the last 24h.
// If spend exceeds £200, flips platform_settings.spend_freeze_active=true and
// alerts platform admins via email_logs.
//
// Lift the freeze from /admin/security (admin-only).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { PLATFORM_DAILY_LIMIT_PENCE } from '../_shared/costGuard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: spendData, error: spendErr } = await admin.rpc('platform_spend_pence_since', { _since: oneDayAgo });
    if (spendErr) throw spendErr;
    const spend = (spendData as number | null) ?? 0;

    const { data: settings } = await admin
      .from('platform_settings').select('spend_freeze_active').eq('id', true).maybeSingle();
    const alreadyFrozen = settings?.spend_freeze_active === true;

    if (spend >= PLATFORM_DAILY_LIMIT_PENCE && !alreadyFrozen) {
      await admin.from('platform_settings').update({
        spend_freeze_active: true,
        spend_freeze_reason: `Auto-freeze: 24h spend £${(spend / 100).toFixed(2)} ≥ £${(PLATFORM_DAILY_LIMIT_PENCE / 100).toFixed(2)}`,
        spend_freeze_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', true);

      // Alert all platform admins
      const { data: admins } = await admin.from('platform_admins').select('user_id');
      if (admins) {
        const { data: profiles } = await admin
          .from('profiles').select('email, org_id').in('user_id', admins.map((a) => a.user_id));
        for (const p of profiles ?? []) {
          if (p.email && p.org_id) {
            await admin.from('email_logs').insert({
              org_id: p.org_id,
              recipient_email: p.email,
              email_type: 'platform_spend_freeze_alert',
              status: 'pending',
            });
          }
        }
      }
    }

    // GC idempotency cache
    try { await admin.rpc('cleanup_request_idempotency'); } catch { /* noop */ }

    return new Response(JSON.stringify({
      ok: true,
      spend_pence_24h: spend,
      limit_pence: PLATFORM_DAILY_LIMIT_PENCE,
      already_frozen: alreadyFrozen,
      action: spend >= PLATFORM_DAILY_LIMIT_PENCE && !alreadyFrozen ? 'froze' : 'noop',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    console.error(JSON.stringify({ ts: new Date().toISOString(), fn: 'cost-circuit-breaker', error: msg }));
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
