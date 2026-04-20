import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

export interface ContentLabCreditBalance {
  balance: number;
  lifetimePurchased: number;
  lifetimeUsed: number;
}

export const useContentLabCredits = () => {
  const { orgId } = useOrg();

  return useQuery<ContentLabCreditBalance>({
    queryKey: ['content-lab-credits', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_credits')
        .select('balance, lifetime_purchased, lifetime_used')
        .eq('org_id', orgId!)
        .maybeSingle();
      if (error) throw error;
      return {
        balance: data?.balance ?? 0,
        lifetimePurchased: data?.lifetime_purchased ?? 0,
        lifetimeUsed: data?.lifetime_used ?? 0,
      };
    },
  });
};
