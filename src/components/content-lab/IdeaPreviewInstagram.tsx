import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react';

interface Props { hook: string | null; handle: string; caption: string | null }

const IdeaPreviewInstagram = ({ hook, handle, caption }: Props) => (
  <div className="rounded-xl border border-border bg-background overflow-hidden shadow-sm">
    <div className="flex items-center gap-2 p-3 border-b border-border">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-yellow-400" />
      <span className="text-sm font-semibold">{handle}</span>
    </div>
    <div className="aspect-square bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center p-6 text-center">
      <p className="font-display text-lg leading-tight">{hook ?? 'Your hook here'}</p>
    </div>
    <div className="flex items-center gap-3 p-3">
      <Heart className="h-5 w-5" />
      <MessageCircle className="h-5 w-5" />
      <Send className="h-5 w-5" />
      <Bookmark className="ml-auto h-5 w-5" />
    </div>
    {caption && <p className="px-3 pb-3 text-xs text-muted-foreground line-clamp-2">{caption}</p>}
  </div>
);
export default IdeaPreviewInstagram;
