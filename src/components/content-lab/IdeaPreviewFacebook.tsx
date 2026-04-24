import { ThumbsUp, MessageCircle, Share2 } from 'lucide-react';

interface Props { hook: string | null; handle: string; caption: string | null }

const IdeaPreviewFacebook = ({ hook, handle, caption }: Props) => (
  <div className="rounded-xl border border-border bg-background overflow-hidden shadow-sm">
    <div className="flex items-center gap-2 p-3">
      <div className="h-9 w-9 rounded-full bg-blue-600" />
      <div>
        <p className="text-sm font-semibold">{handle}</p>
        <p className="text-[11px] text-muted-foreground">Sponsored · 🌐</p>
      </div>
    </div>
    {caption && <p className="px-3 pb-2 text-sm">{caption}</p>}
    <div className="aspect-video bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center p-6 text-center">
      <p className="font-display text-lg leading-tight">{hook ?? 'Your hook here'}</p>
    </div>
    <div className="flex items-center gap-4 p-3 text-sm text-muted-foreground border-t border-border">
      <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" /> Like</span>
      <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" /> Comment</span>
      <span className="flex items-center gap-1"><Share2 className="h-4 w-4" /> Share</span>
    </div>
  </div>
);
export default IdeaPreviewFacebook;
