import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Shuffle, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useContentLabCredits } from '@/hooks/useContentLabCredits';
import CreditCostBadge from './CreditCostBadge';
import BuyCreditsDialog from './BuyCreditsDialog';

interface Props {
  ideaId: string;
  runId: string;
  regenCount?: number;
}

const MAX_REGEN_PER_IDEA = 5;

type Shift = 'angle' | 'cluster' | 'hook';
type RemixType = 'shorter' | 'punchier' | 'emotional' | 'b2b' | 'platform';

const SHIFT_LABELS: Record<Shift, string> = {
  angle: 'Different angle (same topic)',
  cluster: 'Different cluster (new topic)',
  hook: 'Different hook (keep script)',
};

const REMIX_LABELS: Record<RemixType, string> = {
  shorter: 'Shorter (cut to half)',
  punchier: 'Punchier (tighten language)',
  emotional: 'More emotional (raise stakes)',
  b2b: 'B2B tone (professional)',
  platform: 'Different platform version',
};

const PLATFORMS: Array<{ value: 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'linkedin'; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const IdeaActionButtons = ({ ideaId, runId, regenCount = 0 }: Props) => {
  const queryClient = useQueryClient();
  const { data: credits } = useContentLabCredits();
  const balance = credits?.balance ?? 0;
  const isExhausted = balance < 1;
  const regenExhausted = regenCount >= MAX_REGEN_PER_IDEA;
  const [busy, setBusy] = useState<'regen' | 'remix' | null>(null);
  const [showBuy, setShowBuy] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['content-lab-ideas', runId] });
    queryClient.invalidateQueries({ queryKey: ['content-lab-credits'] });
  };

  const handleRegenerate = async (shift: Shift) => {
    setBusy('regen');
    try {
      const { data, error } = await supabase.functions.invoke('content-lab-regenerate-idea', {
        body: { ideaId, shift },
      });
      if (error) {
        const ctx = error as { context?: { needsCredits?: boolean } };
        if (ctx.context?.needsCredits) {
          setShowBuy(true);
          return;
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      toast.success('Idea regenerated');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Regeneration failed');
    } finally {
      setBusy(null);
    }
  };

  const handleRemix = async (remixType: RemixType, targetPlatform?: string) => {
    setBusy('remix');
    try {
      const { data, error } = await supabase.functions.invoke('content-lab-remix-idea', {
        body: { ideaId, remixType, targetPlatform },
      });
      if (error) {
        const ctx = error as { context?: { needsCredits?: boolean } };
        if (ctx.context?.needsCredits) {
          setShowBuy(true);
          return;
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      toast.success('Idea remixed');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remix failed');
    } finally {
      setBusy(null);
    }
  };

  if (isExhausted) {
    return (
      <>
        <div className="flex items-center gap-2">
          <CreditCostBadge cost={1} />
          <Button size="sm" variant="outline" onClick={() => setShowBuy(true)}>
            <ShoppingCart className="mr-2 h-3.5 w-3.5" />
            Buy credits
          </Button>
        </div>
        <BuyCreditsDialog open={showBuy} onOpenChange={setShowBuy} />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <CreditCostBadge cost={1} />

        {regenCount > 0 && (
          <span className="text-[10px] text-muted-foreground">
            Regenerated {regenCount}/{MAX_REGEN_PER_IDEA}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={busy !== null || regenExhausted} title={regenExhausted ? `Max ${MAX_REGEN_PER_IDEA} regenerations reached` : undefined}>
              {busy === 'regen' ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
              )}
              Regenerate
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Shift the idea</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(SHIFT_LABELS) as Shift[]).map((s) => (
              <DropdownMenuItem key={s} onClick={() => handleRegenerate(s)}>
                {SHIFT_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={busy !== null}>
              {busy === 'remix' ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Shuffle className="mr-2 h-3.5 w-3.5" />
              )}
              Remix
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Rewrite the script</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(['shorter', 'punchier', 'emotional', 'b2b'] as RemixType[]).map((r) => (
              <DropdownMenuItem key={r} onClick={() => handleRemix(r)}>
                {REMIX_LABELS[r]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Different platform
            </DropdownMenuLabel>
            {PLATFORMS.map((p) => (
              <DropdownMenuItem key={p.value} onClick={() => handleRemix('platform', p.value)}>
                {p.label} version
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <BuyCreditsDialog open={showBuy} onOpenChange={setShowBuy} />
    </>
  );
};

export default IdeaActionButtons;
