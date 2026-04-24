import { Heart, MessageCircle, Share2, Music } from 'lucide-react';

interface Props { hook: string | null; handle: string; caption: string | null }

const IdeaPreviewTikTok = ({ hook, handle, caption }: Props) => (
  <div className="rounded-xl bg-black text-white overflow-hidden shadow-sm aspect-[9/16] relative">
    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
      <p className="font-display text-xl leading-tight">{hook ?? 'Your hook here'}</p>
    </div>
    <div className="absolute right-2 bottom-16 flex flex-col gap-4 items-center text-xs">
      <Heart className="h-6 w-6" />
      <MessageCircle className="h-6 w-6" />
      <Share2 className="h-6 w-6" />
    </div>
    <div className="absolute left-3 right-12 bottom-3 space-y-1">
      <p className="text-sm font-semibold">@{handle}</p>
      {caption && <p className="text-xs opacity-90 line-clamp-2">{caption}</p>}
      <p className="flex items-center gap-1 text-xs opacity-75"><Music className="h-3 w-3" /> Original audio</p>
    </div>
  </div>
);
export default IdeaPreviewTikTok;
