import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

export interface ContentLabAccess {
  hasAccess: boolean;
  canGenerate: boolean;
  tier: string | null;
  status: string | null;
  isLoading: boolean;
}

/**
 * Reads org_subscriptions.content_lab_tier + status to gate Content Lab UI.
 * - tier null            → no access (never bought add-on)
 * - tier set + active    → full access (browse + generate)
 * - tier set + inactive  → read-only (pipeline visible, no new runs)
 */
export const useContentLabAccess = (): ContentLabAccess => {
  const { orgId } = useOrg();

  const { data, isLoading } = useQuery({
    queryKey: ['content-lab-access', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_subscriptions')
        .select('content_lab_tier, status')
        .eq('org_id', orgId!)
        .maybeSingle();
      if (error) throw error;
      return data as { content_lab_tier: string | null; status: string | null } | null;
    },
  });

  const tier = data?.content_lab_tier ?? null;
  const status = data?.status ?? null;
  const hasAccess = !!tier;
  const canGenerate = hasAccess && status === 'active';

  return { hasAccess, canGenerate, tier, status, isLoading };
};
