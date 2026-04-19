import { Heart, MessageCircle, Send, Bookmark, Music2 } from 'lucide-react';

interface Props {
  hook: string;
  handle?: string | null;
  caption?: string | null;
}

const IdeaPreviewInstagram = ({ hook, handle, caption }: Props) => (
  <div className="relative mx-auto aspect-[9/16] w-full max-w-[240px] overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-fuchsia-500/30 via-purple-500/20 to-orange-400/30 shadow-lg">
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

    {/* Top header */}
    <div className="absolute left-3 right-3 top-3 flex items-center justify-between text-[10px] font-medium text-white">
      <span>Reels</span>
      <span>•••</span>
    </div>

    {/* Hook overlay (centre) */}
    <div className="absolute inset-x-3 top-1/3 -translate-y-1/2">
      <p className="rounded-md bg-black/55 p-2 text-center text-[11px] font-semibold leading-snug text-white">
        {hook}
      </p>
    </div>

    {/* Right rail */}
    <div className="absolute bottom-16 right-2 flex flex-col items-center gap-3 text-white">
      <Heart className="h-5 w-5" />
      <MessageCircle className="h-5 w-5" />
      <Send className="h-5 w-5" />
      <Bookmark className="h-5 w-5" />
    </div>

    {/* Bottom info */}
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

export default IdeaPreviewInstagram;
