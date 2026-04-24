import { Card } from '@/components/ui/card';
import { Eye, Heart } from 'lucide-react';
import IgThumb from '@/components/content-lab/IgThumb';

export interface ViralPostCardData {
  thumbnail_url: string | null;
  author_handle: string;
  caption: string | null;
  views: number;
  likes: number;
  platform?: string;
}

const ViralPostCard = ({ post }: { post: ViralPostCardData }) => (
  <Card className="overflow-hidden">
    <IgThumb src={post.thumbnail_url} alt={post.caption ?? `Post by @${post.author_handle}`} className="aspect-square" />
    <div className="p-3 space-y-1">
      <p className="text-xs font-semibold truncate">@{post.author_handle}</p>
      {post.caption && <p className="text-[11px] text-muted-foreground line-clamp-2">{post.caption}</p>}
      <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {post.views.toLocaleString()}</span>
        <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {post.likes.toLocaleString()}</span>
      </div>
    </div>
  </Card>
);
export default ViralPostCard;
