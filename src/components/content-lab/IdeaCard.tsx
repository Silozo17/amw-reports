import { useState } from 'react';
import { Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import IdeaPreviewInstagram from './IdeaPreviewInstagram';
import IdeaPreviewTikTok from './IdeaPreviewTikTok';
import IdeaPreviewFacebook from './IdeaPreviewFacebook';
import IdeaDetailDrawer from './IdeaDetailDrawer';
import IdeaActionButtons from './IdeaActionButtons';
import IdeaPerformanceStrip from './IdeaPerformanceStrip';
import { useSwipeFileIds, useToggleSwipe } from '@/hooks/useSwipeFile';
import { useIdeaCommentCount } from '@/hooks/useIdeaComments';
import IdeaCommentsDrawer from './IdeaCommentsDrawer';

export interface IdeaCardData {
  id: string;
  run_id: string;
  client_id?: string | null;
  niche_id?: string | null;
  client_name?: string | null;
  niche_label?: string | null;
  idea_number: number;
  title: string;
  hook: string | null;
  caption?: string | null;
  target_platform: string | null;
  rating: number | null;
  status: string;
  duration_seconds?: number | null;
  is_wildcard?: boolean;
  // stacked-only extras (run detail page)
  body?: string | null;
  cta?: string | null;
  why_it_works?: string | null;
  hashtags?: string[];
  hook_variants?: Array<{ text: string; mechanism: string; why: string }> | null;
  regen_count?: number;
  linked_post_id?: string | null;
  actual_views?: number | null;
  actual_engagement_rate?: number | null;
}

interface Props {
  idea: IdeaCardData;
  /**
   * "grid"    — phone-mockup card for browse/swipe-file pages (click → drawer).
   * "stacked" — premium 2-col layout with full details inline, used in run detail.
   */
  variant?: 'grid' | 'stacked';
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  scripted: 'Scripted',
  filming: 'Filming',
  posted: 'Posted',
  archived: 'Archived',
};

interface PreviewArgs {
  platform: string | null;
  hook: string;
  caption: string | null;
  ideaId: string;
  runId: string;
  isSaved: boolean;
  commentCount: number;
  onToggleSave: () => void;
  onOpenComments: () => void;
}

const PreviewByPlatform = (args: PreviewArgs) => {
  const p = (args.platform ?? 'instagram').toLowerCase();
  if (p === 'tiktok') return <IdeaPreviewTikTok {...args} />;
  if (p === 'facebook') return <IdeaPreviewFacebook {...args} />;
  return <IdeaPreviewInstagram {...args} />;
};

/** Premium phone-mockup idea card. Grid for browse pages, stacked for run detail. */
const IdeaCard = ({ idea, variant = 'grid' }: Props) => {
  const [detailOpen, setDetailOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const { data: savedIds } = useSwipeFileIds();
  const toggle = useToggleSwipe();
  const { data: commentCount = 0 } = useIdeaCommentCount(idea.id);
  const isSaved = savedIds?.has(idea.id) ?? false;

  const previewProps: PreviewArgs = {
    platform: idea.target_platform,
    hook: idea.hook ?? idea.title,
    caption: idea.caption ?? null,
    ideaId: idea.id,
    runId: idea.run_id,
    isSaved,
    commentCount,
    onToggleSave: () =>
      toggle.mutate({
        ideaId: idea.id,
        clientId: idea.client_id ?? null,
        nicheId: idea.niche_id ?? null,
        isSaved,
      }),
    onOpenComments: () => setCommentsOpen(true),
  };

  if (variant === 'stacked') {
    return (
      <>
        <Card className="grid gap-6 p-6 md:grid-cols-[260px_1fr]">
          <div>
            <PreviewByPlatform {...previewProps} />
            {idea.target_platform && (
              <p className="mt-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
                {idea.target_platform}
              </p>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Idea {idea.idea_number}
                </p>
                <h3 className="mt-1 font-display text-xl">{idea.title}</h3>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {idea.is_wildcard && <Badge variant="secondary">Wildcard 🚀</Badge>}
                {idea.duration_seconds && <Badge variant="outline">{idea.duration_seconds}s</Badge>}
              </div>
            </div>
            {idea.hook && (
              <p className="text-sm">
                <span className="font-semibold">Hook: </span>
                {idea.hook}
              </p>
            )}
            {idea.hook_variants && idea.hook_variants.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Hook variants
                </p>
                <div className="grid gap-2 md:grid-cols-3">
                  {idea.hook_variants.map((v, vi) => (
                    <div
                      key={vi}
                      className="rounded-md border border-border/50 bg-muted/30 p-2 text-xs"
                    >
                      <p className="font-medium leading-snug">{v.text}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {v.mechanism}
                      </p>
                      {v.why && <p className="mt-1 text-muted-foreground">{v.why}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {idea.body && <p className="text-sm text-muted-foreground">{idea.body}</p>}
            {idea.cta && (
              <p className="text-sm">
                <span className="font-semibold">CTA: </span>
                {idea.cta}
              </p>
            )}
            {idea.why_it_works && (
              <div className="rounded-md bg-primary/5 p-3 text-sm">
                <span className="font-semibold text-primary">Why it works: </span>
                {idea.why_it_works}
              </div>
            )}
            {idea.hashtags && idea.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {idea.hashtags.map((h) => (
                  <Badge key={h} variant="secondary" className="text-[10px]">
                    #{h}
                  </Badge>
                ))}
              </div>
            )}
            <div className="border-t border-border/50 pt-3">
              <IdeaActionButtons
                ideaId={idea.id}
                runId={idea.run_id}
                regenCount={idea.regen_count ?? 0}
              />
            </div>
            <IdeaPerformanceStrip
              ideaId={idea.id}
              runId={idea.run_id}
              status={idea.status ?? 'not_started'}
              linkedPostId={idea.linked_post_id ?? null}
              actualViews={idea.actual_views ?? null}
              actualEngagementRate={idea.actual_engagement_rate ?? null}
            />
          </div>
        </Card>
        <IdeaCommentsDrawer
          ideaId={commentsOpen ? idea.id : null}
          open={commentsOpen}
          onOpenChange={setCommentsOpen}
        />
      </>
    );
  }

  // grid variant
  return (
    <>
      <Card
        onClick={() => setDetailOpen(true)}
        className={cn(
          'group flex cursor-pointer flex-col overflow-hidden border-border/60 bg-card/50 transition-all duration-200',
          'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5',
        )}
      >
        <div className="bg-gradient-to-b from-muted/40 to-muted/10 px-4 pt-5 pb-3">
          <PreviewByPlatform {...previewProps} />
        </div>

        <div className="flex flex-1 flex-col gap-2 border-t border-border/40 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            <span>Idea #{idea.idea_number}</span>
            {idea.target_platform && <span className="capitalize">· {idea.target_platform}</span>}
            {idea.duration_seconds && <span>· {idea.duration_seconds}s</span>}
          </div>
          <h3 className="font-display text-base leading-tight line-clamp-2">{idea.title}</h3>
          {idea.hook && (
            <p className="text-xs text-muted-foreground line-clamp-2">{idea.hook}</p>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
            {idea.is_wildcard && <Badge variant="secondary" className="text-[9px]">Wildcard 🚀</Badge>}
            <Badge variant="outline" className="text-[10px]">
              {STATUS_LABEL[idea.status] ?? idea.status}
            </Badge>
            {idea.rating != null && (
              <span className="ml-auto inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {idea.rating}/10
              </span>
            )}
          </div>
          {(idea.client_name || idea.niche_label) && (
            <p className="text-[10px] text-muted-foreground/80 truncate">
              {[idea.client_name, idea.niche_label].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </Card>

      <IdeaDetailDrawer ideaId={detailOpen ? idea.id : null} onClose={() => setDetailOpen(false)} />
      <IdeaCommentsDrawer
        ideaId={commentsOpen ? idea.id : null}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
      />
    </>
  );
};

export default IdeaCard;
