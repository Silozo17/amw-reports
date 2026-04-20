import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContentLabVertical {
  slug: string;
  display_name: string;
  min_views_tiktok: number;
  min_views_instagram: number;
  min_views_facebook: number;
  geo_focus: string | null;
  keyword_queries: string[];
  notes: string | null;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export const useContentLabVerticals = () =>
  useQuery({
    queryKey: ["content-lab-verticals"],
    staleTime: ONE_HOUR_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_lab_verticals" as never)
        .select("*")
        .order("display_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ContentLabVertical[];
    },
  });
