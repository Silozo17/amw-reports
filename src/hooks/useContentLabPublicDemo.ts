import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AMW_DEMO_SHARE_SLUG } from '@/lib/contentLabDemo';

/**
 * Public read-only payload returned by the `get_shared_run` RPC.
 * Mirrors the shape consumed by `/share/content-lab/:slug`.
 */
export interface PublicDemoIdea {
  id: string;
  title: string;
  hook: string | null;
  caption: string | null;
  visual_direction: string | null;
  target_platform: string | null;
  is_wildcard: boolean;
  hashtags: string[];
}

export interface PublicDemoPost {
  thumbnail_url: string | null;
  post_url: string | null;
  author_handle: string;
  views: number;
  engagement_rate: number;
  platform: string;
}

export interface PublicDemoPayload {
  run: { id: string; summary: Record<string, unknown>; completed_at: string | null; created_at: string };
  client_name: string;
  org_logo: string | null;
  org_primary_color: string | null;
  ideas: PublicDemoIdea[];
  top_posts: PublicDemoPost[];
}

/**
 * Loads the AMW Media demo run for use on public marketing pages.
 *
 * Uses the existing public `get_shared_run` RPC + active share slug, so no
 * auth, no new server code, and the data stays in sync with the real run.
 */
export const useContentLabPublicDemo = (slug: string = AMW_DEMO_SHARE_SLUG) => {
  return useQuery({
    queryKey: ['content-lab-public-demo', slug],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<PublicDemoPayload | null> => {
      const { data, error } = await supabase.rpc('get_shared_run', { _slug: slug });
      if (error) throw error;
      return (data as unknown as PublicDemoPayload) ?? null;
    },
  });
};
