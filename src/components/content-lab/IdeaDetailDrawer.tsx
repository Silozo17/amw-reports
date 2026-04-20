import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ExternalLink } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import IdeaActionButtons from './IdeaActionButtons';
import IdeaPerformanceStrip from './IdeaPerformanceStrip';

interface Props {
  ideaId: string | null;
  onClose: () => void;
}

interface IdeaDetail {
  id: string;
  run_id: string;
  idea_number: number;
  title: string;
  hook: string | null;
  hook_variants: Array<{ text: string; mechanism: string; why: string }> | null;
  body: string | null;
  cta: string | null;
  why_it_works: string | null;
  visual_direction: string | null;
  hashtags: string[];
  filming_checklist: string[];
  duration_seconds: number | null;
  target_platform: string | null;
  status: string;
  rating: number | null;
  is_wildcard: boolean;
  regen_count: number;
  linked_post_id: string | null;
  actual_views: number | null;
  actual_engagement_rate: number | null;
}

/**
 * Full idea details lifted from the run-detail Ideas tab into a Sheet drawer.
 * Single source of truth — used by IdeaCard so /ideas and swipe-file expose the
 * same depth as the run report without duplicating the run page layout.
 */
const IdeaDetailDrawer = ({ ideaId, onClose }: Props) => {
  const navigate = useNavigate();

  const { data: idea, isLoading } = useQuery<IdeaDetail | null>({
    queryKey: ['content-lab-idea-detail', ideaId],
    enabled: !!ideaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_ideas')
        .select(
          `id, run_id, idea_number, title, hook, hook_variants, body, cta, why_it_works,
           visual_direction, hashtags, filming_checklist, duration_seconds, target_platform,
           status, rating, is_wildcard, regen_count, linked_post_id, actual_views, actual_engagement_rate`,
        )
        .eq('id', ideaId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as IdeaDetail | null;
    },
  });

  return (
    <Sheet open={!!ideaId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {isLoading || !idea ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading idea…
          </div>
        ) : (
          <>
            <SheetHeader className="space-y-2 pb-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Idea #{idea.idea_number}
              </p>
              <SheetTitle className="font-display text-2xl leading-tight">{idea.title}</SheetTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                {idea.is_wildcard && <Badge variant="secondary">Wildcard 🚀</Badge>}
                {idea.target_platform && (
                  <Badge variant="outline" className="capitalize">{idea.target_platform}</Badge>
                )}
                {idea.duration_seconds && <Badge variant="outline">{idea.duration_seconds}s</Badge>}
                {idea.rating != null && <Badge variant="outline">★ {idea.rating}/10</Badge>}
              </div>
            </SheetHeader>

            <div className="space-y-4 pb-8">
              {idea.hook && (
                <Section label="Hook">
                  <p className="text-sm">{idea.hook}</p>
                </Section>
              )}

              {idea.hook_variants && idea.hook_variants.length > 0 && (
                <Section label="Hook variants">
                  <div className="grid gap-2">
                    {idea.hook_variants.map((v, i) => (
                      <div key={i} className="rounded-md border border-border/50 bg-muted/30 p-3 text-xs">
                        <p className="font-medium leading-snug">{v.text}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {v.mechanism}
                        </p>
                        {v.why && <p className="mt-1 text-muted-foreground">{v.why}</p>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {idea.body && (
                <Section label="Script">
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{idea.body}</p>
                </Section>
              )}

              {idea.cta && (
                <Section label="CTA">
                  <p className="text-sm">{idea.cta}</p>
                </Section>
              )}

              {idea.why_it_works && (
                <div className="rounded-md bg-primary/5 p-3 text-sm">
                  <span className="font-semibold text-primary">Why it works: </span>
                  {idea.why_it_works}
                </div>
              )}

              {idea.visual_direction && (
                <Section label="Visual direction">
                  <p className="text-sm text-muted-foreground">{idea.visual_direction}</p>
                </Section>
              )}

              {idea.filming_checklist && idea.filming_checklist.length > 0 && (
                <Section label="Filming checklist">
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {idea.filming_checklist.map((c, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary">·</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {idea.hashtags && idea.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {idea.hashtags.map((h) => (
                    <Badge key={h} variant="secondary" className="text-[10px]">#{h}</Badge>
                  ))}
                </div>
              )}

              <div className="border-t border-border/40 pt-4">
                <IdeaActionButtons ideaId={idea.id} runId={idea.run_id} regenCount={idea.regen_count} />
              </div>

              <IdeaPerformanceStrip
                ideaId={idea.id}
                runId={idea.run_id}
                status={idea.status}
                linkedPostId={idea.linked_post_id}
                actualViews={idea.actual_views}
                actualEngagementRate={idea.actual_engagement_rate}
              />

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => { onClose(); navigate(`/content-lab/run/${idea.run_id}`); }}
              >
                Open full report <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
      {label}
    </p>
    {children}
  </div>
);

export default IdeaDetailDrawer;
