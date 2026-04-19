import { ThumbsUp, MessageCircle, Share2 } from 'lucide-react';

interface Props {
  hook: string;
  handle?: string | null;
  caption?: string | null;
}

const IdeaPreviewFacebook = ({ hook, handle, caption }: Props) => (
  <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
    {/* Header */}
    <div className="flex items-center gap-2 p-3">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700" />
      <div>
        <p className="text-xs font-semibold text-foreground">{(handle ?? 'Your Page').replace(/^@/, '')}</p>
        <p className="text-[10px] text-muted-foreground">Sponsored · 🌐</p>
      </div>
    </div>

    {caption && <p className="px-3 pb-2 text-xs text-foreground">{caption}</p>}

    {/* Visual */}
    <div className="relative aspect-video bg-gradient-to-br from-blue-500/30 via-indigo-500/20 to-cyan-400/30">
      <div className="absolute inset-x-3 top-1/2 -translate-y-1/2">
        <p className="rounded-md bg-black/55 p-2 text-center text-xs font-semibold leading-snug text-white">
          {hook}
        </p>
      </div>
    </div>

    {/* Action row */}
    <div className="flex items-center justify-around border-t border-border py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> Like</span>
      <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> Comment</span>
      <span className="flex items-center gap-1"><Share2 className="h-3.5 w-3.5" /> Share</span>
    </div>
  </div>
);

export default IdeaPreviewFacebook;
