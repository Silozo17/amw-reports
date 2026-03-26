import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function usePlatformAdmin() {
  const { user } = useAuth();

  const { data: isPlatformAdmin = false, isLoading } = useQuery({
    queryKey: ['platform-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from('platform_admins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Platform admin check failed:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return { isPlatformAdmin, isLoading };
}
