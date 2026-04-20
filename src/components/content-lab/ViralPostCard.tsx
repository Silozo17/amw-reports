import { Heart, MessageCircle, Send, Bookmark, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  };
}

const PROXY_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/content-lab-image-proxy`;

const VIDEO_TYPES = new Set(['video', 'reel', 'reels', 'clip', 'clips']);

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

const ViralPostCard = ({ post }: ViralPostCardProps) => {
  const isVideo = VIDEO_TYPES.has((post.post_type ?? '').toLowerCase());
  const ctaLabel = isVideo ? 'View reel' : 'View post';
  const thumb = proxiedSrc(post.thumbnail_url);
  const initial = post.author_handle?.[0]?.toUpperCase() ?? '?';

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
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        {isVideo && (
          <Badge className="absolute top-2 right-2 bg-background/80 text-foreground text-[10px]">
            Reel
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

      {/* Stats */}
      <div className="px-3 pt-1.5 space-y-0.5">
        {post.views > 0 && (
          <p className="text-xs font-semibold">{formatCount(post.views)} views</p>
        )}
        <p className="text-sm font-semibold">
          {formatCount(post.likes)} likes
          {post.comments > 0 && (
            <span className="text-muted-foreground font-normal">
              {' · '}
              {formatCount(post.comments)} comments
            </span>
          )}
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

      {/* Hook */}
      {post.hook_text && (
        <div className="mx-3 mt-2 rounded-md bg-primary/5 p-2 text-xs">
          <span className="font-semibold text-primary">Hook: </span>
          {post.hook_text}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-2 px-3 py-3">
        {post.post_url ? (
          <Button asChild size="sm" variant="default">
            <a href={post.post_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              {ctaLabel}
            </a>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No link available</span>
        )}
        <span className="text-[11px] text-muted-foreground">{formatRelative(post.posted_at)}</span>
      </div>
    </Card>
  );
};

export default ViralPostCard;
