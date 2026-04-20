import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Platform-admin "health" signals for Content Lab. All queries rely on the
// "Platform admins can view all..." RLS policies on the underlying tables.

const STALE_RUN_MINUTES = 20;
const REFUND_LOOKBACK_DAYS = 7;

export interface StuckRun {
  id: string;
  org_id: string;
  client_id: string;
  status: string;
  started_at: string | null;
  updated_at: string;
  error_message: string | null;
}

export interface RefundFailure {
  id: string;
  run_id: string;
  message: string | null;
  error_message: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface TierMismatch {
  org_id: string;
  org_name: string;
  content_lab_tier: string;
  status: string;
}

export interface ContentLabHealth {
  stuck_runs: StuckRun[];
  refund_failures: RefundFailure[];
  tier_mismatches: TierMismatch[];
}

export function useContentLabHealth() {
  return useQuery<ContentLabHealth>({
    queryKey: ['content-lab-health'],
    queryFn: async () => {
      const staleCutoff = new Date(Date.now() - STALE_RUN_MINUTES * 60_000).toISOString();
      const refundCutoff = new Date(Date.now() - REFUND_LOOKBACK_DAYS * 86_400_000).toISOString();

      const [stuckRes, refundRes, mismatchRes] = await Promise.all([
        supabase
          .from('content_lab_runs')
          .select('id, org_id, client_id, status, started_at, updated_at, error_message')
          .in('status', ['scraping', 'analysing', 'ideating', 'pending'])
          .lt('updated_at', staleCutoff)
          .order('updated_at', { ascending: true })
          .limit(50),
        supabase
          .from('content_lab_step_logs')
          .select('id, run_id, message, error_message, payload, created_at')
          .eq('step', 'refund_failed')
          .gte('created_at', refundCutoff)
          .order('created_at', { ascending: false })
          .limit(50),
        // Tier-sync mismatch: org has a content_lab_tier set but no active subscription.
        supabase
          .from('organisations')
          // deno-lint-ignore no-explicit-any
          .select('id, name, content_lab_tier, org_subscriptions(status)' as any)
          .not('content_lab_tier', 'is', null)
          .limit(200),
      ]);

      if (stuckRes.error) throw stuckRes.error;
      if (refundRes.error) throw refundRes.error;
      if (mismatchRes.error) throw mismatchRes.error;

      // deno-lint-ignore no-explicit-any
      const orgs = (mismatchRes.data ?? []) as any[];
      const tierMismatches: TierMismatch[] = orgs
        .filter((o) => {
          const subs = Array.isArray(o.org_subscriptions) ? o.org_subscriptions : [];
          return !subs.some((s: { status: string }) => s.status === 'active');
        })
        .map((o) => {
          const subs = Array.isArray(o.org_subscriptions) ? o.org_subscriptions : [];
          return {
            org_id: o.id,
            org_name: o.name,
            content_lab_tier: o.content_lab_tier,
            status: subs[0]?.status ?? 'none',
          };
        });

      return {
        stuck_runs: (stuckRes.data ?? []) as StuckRun[],
        refund_failures: (refundRes.data ?? []) as RefundFailure[],
        tier_mismatches: tierMismatches,
      };
    },
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });
}
