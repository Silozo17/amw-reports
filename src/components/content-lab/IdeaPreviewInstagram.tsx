import { Heart, MessageCircle, Send, Bookmark, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import IdeaShareLinkPopover from './IdeaShareLinkPopover';

interface Props {
  hook: string;
  handle?: string | null;
  caption?: string | null;
  /** When provided, the heart/comment/send icons become interactive. */
  ideaId?: string;
  runId?: string;
  isSaved?: boolean;
  commentCount?: number;
  onToggleSave?: () => void;
  onOpenComments?: () => void;
}

const IdeaPreviewInstagram = ({
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
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[240px] overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-fuchsia-500/30 via-purple-500/20 to-orange-400/30 shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

      <div className="absolute left-3 right-3 top-3 flex items-center justify-between text-[10px] font-medium text-white">
        <span>Reels</span>
        <span>•••</span>
      </div>

      <div className="absolute inset-x-3 top-1/3 -translate-y-1/2">
        <p className="rounded-md bg-black/55 p-2 text-center text-[11px] font-semibold leading-snug text-white">
          {hook}
        </p>
      </div>

      <div className="absolute bottom-16 right-2 flex flex-col items-center gap-3 text-white">
        {interactive ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSave?.(); }}
            aria-label={isSaved ? 'Remove from swipe file' : 'Save to swipe file'}
            className="transition-transform hover:scale-110"
          >
            <Heart className={cn('h-5 w-5', isSaved && 'fill-red-500 text-red-500')} />
          </button>
        ) : (
          <Heart className="h-5 w-5" />
        )}

        {interactive ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenComments?.(); }}
            aria-label="Comments"
            className="relative transition-transform hover:scale-110"
          >
            <MessageCircle className="h-5 w-5" />
            {commentCount ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-bold text-primary-foreground">
                {commentCount}
              </span>
            ) : null}
          </button>
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}

        {interactive && runId ? (
          <IdeaShareLinkPopover
            ideaId={ideaId!}
            runId={runId}
            trigger={
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label="Share"
                className="transition-transform hover:scale-110"
              >
                <Send className="h-5 w-5" />
              </button>
            }
          />
        ) : (
          <Send className="h-5 w-5" />
        )}

        <Bookmark className="h-5 w-5" />
      </div>

      <div className="absolute inset-x-3 bottom-3 space-y-1 text-white">
        <p className="text-[11px] font-semibold">@{(handle ?? 'yourbrand').replace(/^@/, '')}</p>
        {caption && <p className="line-clamp-2 text-[10px] opacity-90">{caption}</p>}
        <div className="flex items-center gap-1 text-[10px] opacity-90">
          <Music2 className="h-3 w-3" />
          <span>Original audio</span>
        </div>
      </div>
    </div>
  );
};

export default IdeaPreviewInstagram;
