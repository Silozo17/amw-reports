import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import IdeaCard, { type IdeaCardData } from './IdeaCard';

interface Props {
  ideaId: string | null;
  onClose: () => void;
}

interface IdeaDetailRow extends IdeaCardData {
  // joined run context for save target metadata
  content_lab_runs: {
    client_id: string | null;
    niche_id: string | null;
  } | null;
}

/**
 * Premium idea detail drawer — renders the same phone-mockup + full details layout
 * as the run-detail page (`<IdeaCard variant="stacked" />`). Single source of truth
 * for idea visuals across /ideas, swipe-file and run-detail surfaces.
 */
const IdeaDetailDrawer = ({ ideaId, onClose }: Props) => {
  const { data: idea, isLoading } = useQuery<IdeaDetailRow | null>({
    queryKey: ['content-lab-idea-detail', ideaId],
    enabled: !!ideaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_ideas')
        .select(
          `id, run_id, idea_number, title, hook, hook_variants, body, cta, why_it_works,
           visual_direction, hashtags, filming_checklist, duration_seconds, target_platform,
           caption, status, rating, is_wildcard, regen_count, linked_post_id,
           actual_views, actual_engagement_rate,
           content_lab_runs:run_id ( client_id, niche_id )`,
        )
        .eq('id', ideaId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as IdeaDetailRow | null;
    },
  });

  const ideaCardData: IdeaCardData | null = idea
    ? {
        ...idea,
        client_id: idea.content_lab_runs?.client_id ?? null,
        niche_id: idea.content_lab_runs?.niche_id ?? null,
        hook_variants: Array.isArray(idea.hook_variants)
          ? (idea.hook_variants as IdeaCardData['hook_variants'])
          : null,
      }
    : null;

  return (
    <Sheet open={!!ideaId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-3xl sm:p-6">
        {isLoading || !ideaCardData ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading idea…
          </div>
        ) : (
          <IdeaCard idea={ideaCardData} variant="stacked" />
        )}
      </SheetContent>
    </Sheet>
  );
};

export default IdeaDetailDrawer;
