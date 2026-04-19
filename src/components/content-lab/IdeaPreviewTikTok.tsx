import { Heart, MessageCircle, Share2, Music2 } from 'lucide-react';

interface Props {
  hook: string;
  handle?: string | null;
  caption?: string | null;
}

const IdeaPreviewTikTok = ({ hook, handle, caption }: Props) => (
  <div className="relative mx-auto aspect-[9/16] w-full max-w-[240px] overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-slate-900 via-zinc-800 to-black shadow-lg">
    {/* Top FYP header */}
    <div className="absolute left-0 right-0 top-3 flex items-center justify-center gap-4 text-[10px] font-semibold text-white">
      <span className="opacity-60">Following</span>
      <span className="border-b border-white pb-0.5">For You</span>
    </div>

    {/* Hook overlay (lower-left, TikTok style) */}
    <div className="absolute inset-x-3 bottom-24">
      <p className="text-[11px] font-bold leading-snug text-white drop-shadow-md">
        {hook}
      </p>
    </div>

    {/* Right rail */}
    <div className="absolute bottom-20 right-2 flex flex-col items-center gap-4 text-white">
      <Heart className="h-5 w-5" />
      <MessageCircle className="h-5 w-5" />
      <Share2 className="h-5 w-5" />
      <div className="h-7 w-7 rounded-full border border-white/40 bg-gradient-to-br from-pink-500 to-purple-500" />
    </div>

    {/* Bottom info */}
    <div className="absolute inset-x-3 bottom-3 space-y-1 text-white">
      <p className="text-[11px] font-semibold">@{(handle ?? 'yourbrand').replace(/^@/, '')}</p>
      {caption && <p className="line-clamp-1 text-[10px] opacity-90">{caption}</p>}
      <div className="flex items-center gap-1 text-[10px] opacity-90">
        <Music2 className="h-3 w-3" />
        <span>Original sound</span>
      </div>
    </div>
  </div>
);

export default IdeaPreviewTikTok;
