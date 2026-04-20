import { useState } from 'react';
import { Heart, MessageCircle, Send, Bookmark, ExternalLink, FileText, Music2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ViralPostCardProps {
  post: {
    id: string;
    platform: string;
    author_handle: string;
    caption: string | null;
    thumbnail_url: string | null;
    post_url: string | null;
    post_type: string | null;
    posted_at: string | null;
    likes: number;
    comments: number;
    shares: number;
    views: number;
    hook_text: string | null;
    transcript?: string | null;
    video_duration_seconds?: number | null;
    hashtags?: string[] | null;
    mentions?: string[] | null;
    music_title?: string | null;
    music_artist?: string | null;
    tagged_users?: string[] | null;
  };
}

// Use VITE_SUPABASE_URL (always set) instead of project ID alone, to avoid undefined.supabase.co
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PROXY_URL = `${SUPABASE_URL}/functions/v1/content-lab-image-proxy`;

const VIDEO_TYPES = new Set(['video', 'reel', 'reels', 'clip', 'clips']);
const MAX_HASHTAG_CHIPS = 6;

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
};

const formatRelative = (iso: string | null): string => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

const proxiedSrc = (url: string | null): string | null =>
  url ? `${PROXY_URL}?url=${encodeURIComponent(url)}` : null;

const isHookDistinct = (hook: string | null, caption: string | null): boolean => {
  if (!hook?.trim()) return false;
  if (!caption?.trim()) return true;
  const h = hook.trim().toLowerCase();
  const c = caption.trim().toLowerCase();
  // Hide if hook is a prefix of caption or identical
  return !c.startsWith(h);
};

const ViralPostCard = ({ post }: ViralPostCardProps) => {
  const [imgFailed, setImgFailed] = useState(false);
  const isVideo = VIDEO_TYPES.has((post.post_type ?? '').toLowerCase());
  const ctaLabel = isVideo ? 'View reel' : 'View post';
  const proxied = proxiedSrc(post.thumbnail_url);
  // Fallback to original URL if proxy fails
  const thumb = imgFailed ? post.thumbnail_url : proxied;
  const initial = post.author_handle?.[0]?.toUpperCase() ?? '?';
  const showHook = isHookDistinct(post.hook_text, post.caption);
  const hashtags = (post.hashtags ?? []).slice(0, MAX_HASHTAG_CHIPS);
  const hasTranscript = isVideo && !!post.transcript?.trim();
  const musicLabel = post.music_title
    ? post.music_artist
      ? `${post.music_title} · ${post.music_artist}`
      : post.music_title
    : null;

  return (
    <Card className="overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center text-xs font-semibold">
            {initial}
          </div>
          <span className="text-sm font-medium truncate">@{post.author_handle}</span>
        </div>
        <Badge variant="secondary" className="text-[10px] capitalize">
          {post.platform}
        </Badge>
      </div>

      {/* Image */}
      <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/50">
        {thumb && (
          <img
            src={thumb}
            alt={post.caption ?? 'Post thumbnail'}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            onError={(e) => {
              if (!imgFailed) {
                setImgFailed(true);
              } else {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }
            }}
          />
        )}
        {isVideo && (
          <Badge className="absolute top-2 right-2 bg-background/80 text-foreground text-[10px]">
            Reel{post.video_duration_seconds ? ` · ${Math.round(post.video_duration_seconds)}s` : ''}
          </Badge>
        )}
      </div>

      {/* Action row (visual only) */}
      <div className="flex items-center justify-between px-3 pt-2.5">
        <div className="flex items-center gap-3 text-foreground">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
        </div>
        <Bookmark className="h-5 w-5 text-foreground" />
      </div>

      {/* Stats — always rendered, views only for video */}
      <div className="px-3 pt-1.5 space-y-0.5">
        {isVideo && (
          <p className="text-xs font-semibold">
            {post.views > 0 ? `${formatCount(post.views)} views` : '— views'}
          </p>
        )}
        <p className="text-sm font-semibold">
          {formatCount(post.likes)} likes
          <span className="text-muted-foreground font-normal">
            {' · '}
            {formatCount(post.comments)} comments
          </span>
          {post.shares > 0 && (
            <span className="text-muted-foreground font-normal">
              {' · '}
              {formatCount(post.shares)} shares
            </span>
          )}
        </p>
      </div>

      {/* Caption */}
      {post.caption && (
        <p className="px-3 pt-1.5 text-sm line-clamp-2">
          <span className="font-semibold">@{post.author_handle}</span>{' '}
          <span className="text-muted-foreground">{post.caption}</span>
        </p>
      )}

      {/* Hook — only when meaningfully different from caption */}
      {showHook && post.hook_text && (
        <div className="mx-3 mt-2 rounded-md bg-primary/5 p-2 text-xs">
          <span className="font-semibold text-primary">Hook: </span>
          {post.hook_text}
        </div>
      )}

      {/* Hashtag chips */}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pt-2">
          {hashtags.map((h) => (
            <Badge key={h} variant="secondary" className="text-[10px]">
              #{h.replace(/^#/, '')}
            </Badge>
          ))}
        </div>
      )}

      {/* Music */}
      {musicLabel && (
        <div className="flex items-center gap-1.5 px-3 pt-2 text-xs text-muted-foreground">
          <Music2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{musicLabel}</span>
        </div>
      )}

      {/* Footer — explicit anchor (no Slot) + transcript trigger */}
      <div className="mt-auto flex items-center justify-between gap-2 px-3 py-3">
        <div className="flex items-center gap-2">
          {post.post_url ? (
            <a
              href={post.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {ctaLabel}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">No link available</span>
          )}
          {hasTranscript && (
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Transcript
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Reel transcript — @{post.author_handle}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {post.transcript}
                  </p>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">{formatRelative(post.posted_at)}</span>
      </div>
    </Card>
  );
};

export default ViralPostCard;
