import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSwipeFileIds, useToggleSwipe } from '@/hooks/useSwipeFile';
import { cn } from '@/lib/utils';

interface SwipeFileHeartProps {
  ideaId: string;
  clientId?: string | null;
  nicheId?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

const SwipeFileHeart = ({ ideaId, clientId, nicheId, size = 'sm', className }: SwipeFileHeartProps) => {
  const { data: savedIds } = useSwipeFileIds();
  const toggle = useToggleSwipe();
  const isSaved = savedIds?.has(ideaId) ?? false;
  const dim = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const iconDim = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(dim, 'shrink-0', className)}
      disabled={toggle.isPending}
      onClick={(e) => {
        e.stopPropagation();
        toggle.mutate({ ideaId, clientId, nicheId, isSaved });
      }}
      aria-label={isSaved ? 'Remove from swipe file' : 'Save to swipe file'}
      aria-pressed={isSaved}
    >
      <Heart
        className={cn(
          iconDim,
          'transition-colors',
          isSaved ? 'fill-destructive text-destructive' : 'text-muted-foreground hover:text-destructive',
        )}
      />
    </Button>
  );
};

export default SwipeFileHeart;
