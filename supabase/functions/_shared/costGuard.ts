// Centralised cost-guard for all paid external API calls.
// Three responsibilities:
//   1. Block work if the platform-wide kill switch is on.
//   2. Block work if the org has exceeded daily/monthly budget.
//   3. Record every paid call to the cost_events ledger.
//
// All thresholds in PENCE.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

export const ORG_DAILY_LIMIT_PENCE = 2000;     // £20.00
export const ORG_MONTHLY_LIMIT_PENCE = 10_000; // £100.00
export const RUN_KILL_SWITCH_PENCE = 200;      // £2.00
export const PLATFORM_DAILY_LIMIT_PENCE = 20_000; // £200.00

export class BudgetExceededError extends Error {
  constructor(public scope: 'org_daily' | 'org_monthly' | 'run', message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class PlatformFrozenError extends Error {
  constructor(message = 'Platform spend freeze is active') {
    super(message);
    this.name = 'PlatformFrozenError';
  }
}

let _adminClient: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (_adminClient) return _adminClient;
  _adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  return _adminClient;
}

export async function assertPlatformNotFrozen(): Promise<void> {
  const { data, error } = await admin()
    .from('platform_settings')
    .select('spend_freeze_active, spend_freeze_reason')
    .eq('id', true)
    .maybeSingle();
  if (error) {
    // Fail open on transient DB errors — better to allow than to brick the platform.
    console.error('[costGuard] platform_settings read failed', error.message);
    return;
  }
  if (data?.spend_freeze_active) {
    throw new PlatformFrozenError(data.spend_freeze_reason ?? 'Platform spend freeze active');
  }
}

export async function assertOrgWithinBudget(orgId: string): Promise<void> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: dayData }, { data: monthData }] = await Promise.all([
    admin().rpc('org_spend_pence_since', { _org_id: orgId, _since: oneDayAgo }),
    admin().rpc('org_spend_pence_since', { _org_id: orgId, _since: thirtyDaysAgo }),
  ]);

  const daySpend = (dayData as number | null) ?? 0;
  const monthSpend = (monthData as number | null) ?? 0;

  if (daySpend >= ORG_DAILY_LIMIT_PENCE) {
    throw new BudgetExceededError('org_daily', `Daily spend cap reached (£${(daySpend / 100).toFixed(2)} / £${(ORG_DAILY_LIMIT_PENCE / 100).toFixed(2)})`);
  }
  if (monthSpend >= ORG_MONTHLY_LIMIT_PENCE) {
    throw new BudgetExceededError('org_monthly', `Monthly spend cap reached (£${(monthSpend / 100).toFixed(2)} / £${(ORG_MONTHLY_LIMIT_PENCE / 100).toFixed(2)})`);
  }
}

export async function assertRunWithinKillSwitch(runId: string): Promise<void> {
  const { data } = await admin().rpc('run_spend_pence', { _run_id: runId });
  const runSpend = (data as number | null) ?? 0;
  if (runSpend >= RUN_KILL_SWITCH_PENCE) {
    throw new BudgetExceededError('run', `Run kill-switch tripped (£${(runSpend / 100).toFixed(2)} >= £${(RUN_KILL_SWITCH_PENCE / 100).toFixed(2)})`);
  }
}

export interface CostEvent {
  orgId: string;
  service: 'anthropic' | 'apify' | 'openai' | 'firecrawl' | 'lovable_ai' | 'elevenlabs';
  operation: string;
  pence: number;
  runId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordCost(event: CostEvent): Promise<void> {
  if (event.pence <= 0) return;
  const { error } = await admin().from('cost_events').insert({
    org_id: event.orgId,
    service: event.service,
    operation: event.operation,
    amount_pence: Math.round(event.pence),
    run_id: event.runId ?? null,
    metadata: event.metadata ?? {},
  });
  if (error) {
    // Never fail the parent operation because of cost-logging failure — alert only.
    console.error('[costGuard] recordCost failed', { service: event.service, error: error.message });
  }
}

// Cost estimators — keep simple, prefer over-estimating slightly.
// Pricing reference (April 2026 rates):
//   Claude Haiku 4.5: $0.80 / MTok input, $4 / MTok output
//   Claude Sonnet 4.5: $3 / MTok input, $15 / MTok output
//   OpenAI Whisper: $0.006 / minute
//   Apify per-actor: estimate £0.05/run for scrape, £0.20 for video pull
//   Firecrawl: ~$0.001/scrape ≈ 0.1p

const GBP_PER_USD = 0.80;

export const estimateAnthropic = (model: string, inputTokens: number, outputTokens: number): number => {
  const isHaiku = /haiku/i.test(model);
  const inUsd = (inputTokens / 1_000_000) * (isHaiku ? 0.80 : 3);
  const outUsd = (outputTokens / 1_000_000) * (isHaiku ? 4 : 15);
  return Math.ceil((inUsd + outUsd) * GBP_PER_USD * 100); // pence
};

export const estimateWhisper = (durationSeconds: number): number => {
  const usd = (durationSeconds / 60) * 0.006;
  return Math.ceil(usd * GBP_PER_USD * 100);
};

export const estimateApify = (actor: 'scrape' | 'video_pull' | 'pool_refresh'): number => {
  switch (actor) {
    case 'scrape': return 5;
    case 'video_pull': return 20;
    case 'pool_refresh': return 10;
  }
};

export const estimateFirecrawl = (): number => 1; // ≈1p per scrape
