import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type BenchmarkPoolQuality = 'strong' | 'good' | 'limited' | 'building' | 'unknown';

export interface BenchmarkPoolStatus {
  verifiedCount: number;
  quality: BenchmarkPoolQuality;
  lastVerifiedAt: string | null;
  canRun: boolean;
}

const MIN_RUN_THRESHOLD = 5;
const POLL_INTERVAL_MS = 8000;

const qualityFromCount = (count: number): BenchmarkPoolQuality => {
  if (count >= 15) return 'strong';
  if (count >= 10) return 'good';
  if (count >= MIN_RUN_THRESHOLD) return 'limited';
  return 'building';
};

interface Options {
  /** Poll until pool reaches the run threshold. */
  poll?: boolean;
}

/**
 * Reads the verified benchmark pool size for a niche tag across selected platforms.
 * Used to gate runs and surface pool quality on the report.
 */
export const useBenchmarkPoolStatus = (
  nicheTag: string | null | undefined,
  platforms: string[] | null | undefined,
  options: Options = {},
) => {
  const enabled = !!nicheTag && (platforms?.length ?? 0) > 0;

  return useQuery<BenchmarkPoolStatus>({
    queryKey: ['benchmark-pool-status', nicheTag, platforms?.slice().sort().join(',')],
    enabled,
    refetchInterval: (query) => {
      if (!options.poll) return false;
      const data = query.state.data;
      if (!data) return POLL_INTERVAL_MS;
      return data.canRun ? false : POLL_INTERVAL_MS;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_benchmark_pool')
        .select('verified_at')
        .eq('niche_tag', nicheTag!)
        .in('platform', platforms!)
        .eq('status', 'verified')
        .order('verified_at', { ascending: false });

      if (error) throw error;

      const rows = data ?? [];
      const verifiedCount = rows.length;
      return {
        verifiedCount,
        quality: qualityFromCount(verifiedCount),
        lastVerifiedAt: rows[0]?.verified_at ?? null,
        canRun: verifiedCount >= MIN_RUN_THRESHOLD,
      };
    },
  });
};

export const POOL_RUN_THRESHOLD = MIN_RUN_THRESHOLD;
