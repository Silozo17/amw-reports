import { ThumbsUp, MessageCircle, Share2, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import IdeaShareLinkPopover from './IdeaShareLinkPopover';

interface Props {
  hook: string;
  handle?: string | null;
  caption?: string | null;
  ideaId?: string;
  runId?: string;
  isSaved?: boolean;
  commentCount?: number;
  onToggleSave?: () => void;
  onOpenComments?: () => void;
}

const IdeaPreviewFacebook = ({
  hook,
  handle,
  caption,
  ideaId,
  runId,
  isSaved,
  commentCount,
  onToggleSave,
  onOpenComments,
}: Props) => {
  const interactive = !!ideaId;

  return (
    <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 p-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-foreground">{(handle ?? 'Your Page').replace(/^@/, '')}</p>
          <p className="text-[10px] text-muted-foreground">Sponsored · 🌐</p>
        </div>
        {interactive && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSave?.(); }}
            aria-label={isSaved ? 'Remove from swipe file' : 'Save to swipe file'}
            className="text-muted-foreground transition-colors hover:text-red-500"
          >
            <Heart className={cn('h-4 w-4', isSaved && 'fill-red-500 text-red-500')} />
          </button>
        )}
      </div>

      {caption && <p className="px-3 pb-2 text-xs text-foreground">{caption}</p>}

      <div className="relative aspect-video bg-gradient-to-br from-blue-500/30 via-indigo-500/20 to-cyan-400/30">
        <div className="absolute inset-x-3 top-1/2 -translate-y-1/2">
          <p className="rounded-md bg-black/55 p-2 text-center text-xs font-semibold leading-snug text-white">
            {hook}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-around border-t border-border py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> Like</span>
        {interactive ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenComments?.(); }}
            className="relative flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Comment
            {commentCount ? <span className="text-[10px] font-bold text-primary">({commentCount})</span> : null}
          </button>
        ) : (
          <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> Comment</span>
        )}
        {interactive && runId ? (
          <IdeaShareLinkPopover
            ideaId={ideaId!}
            runId={runId}
            trigger={
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
            }
          />
        ) : (
          <span className="flex items-center gap-1"><Share2 className="h-3.5 w-3.5" /> Share</span>
        )}
      </div>
    </div>
  );
};

export default IdeaPreviewFacebook;
