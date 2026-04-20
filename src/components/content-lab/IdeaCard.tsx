import { useState } from 'react';
import { Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import IdeaPreviewInstagram from './IdeaPreviewInstagram';
import IdeaPreviewTikTok from './IdeaPreviewTikTok';
import IdeaPreviewFacebook from './IdeaPreviewFacebook';
import IdeaDetailDrawer from './IdeaDetailDrawer';
import { useSwipeFileIds, useToggleSwipe } from '@/hooks/useSwipeFile';
import { useIdeaCommentCount, useIdeaComments } from '@/hooks/useIdeaComments';
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
}

interface Props {
  idea: IdeaCardData;
  /** "grid" — phone-mockup card for browse/swipe-file pages. */
  variant?: 'grid';
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  scripted: 'Scripted',
  filming: 'Filming',
  posted: 'Posted',
  archived: 'Archived',
};

const PreviewByPlatform = (args: {
  platform: string | null;
  hook: string;
  caption: string | null;
  ideaId: string;
  runId: string;
  isSaved: boolean;
  commentCount: number;
  onToggleSave: () => void;
  onOpenComments: () => void;
}) => {
  const p = (args.platform ?? 'instagram').toLowerCase();
  if (p === 'tiktok') return <IdeaPreviewTikTok {...args} />;
  if (p === 'facebook') return <IdeaPreviewFacebook {...args} />;
  return <IdeaPreviewInstagram {...args} />;
};

/** Premium phone-mockup idea card. Used on /ideas, swipe-file and client tab. */
const IdeaCard = ({ idea }: Props) => {
  const [detailOpen, setDetailOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const { data: savedIds } = useSwipeFileIds();
  const toggle = useToggleSwipe();
  const { data: commentCount = 0 } = useIdeaCommentCount(idea.id);
  const isSaved = savedIds?.has(idea.id) ?? false;

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
          <PreviewByPlatform
            platform={idea.target_platform}
            hook={idea.hook ?? idea.title}
            caption={idea.caption ?? null}
            ideaId={idea.id}
            runId={idea.run_id}
            isSaved={isSaved}
            commentCount={commentCount}
            onToggleSave={() =>
              toggle.mutate({
                ideaId: idea.id,
                clientId: idea.client_id ?? null,
                nicheId: idea.niche_id ?? null,
                isSaved,
              })
            }
            onOpenComments={() => setCommentsOpen(true)}
          />
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
