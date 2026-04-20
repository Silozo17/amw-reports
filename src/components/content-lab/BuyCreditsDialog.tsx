import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  CONTENT_LAB_CREDIT_PACK_LIST,
  type ContentLabCreditPackKey,
} from '@/lib/contentLabPricing';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatPerCredit = (price: number, credits: number) =>
  `£${(price / credits).toFixed(2)} / credit`;

const BuyCreditsDialog = ({ open, onOpenChange }: Props) => {
  const [loadingPack, setLoadingPack] = useState<ContentLabCreditPackKey | null>(null);

  const handleSelect = async (pack: ContentLabCreditPackKey) => {
    setLoadingPack(pack);
    try {
      const { data, error } = await supabase.functions.invoke('create-content-lab-credit-checkout', {
        body: { pack },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('No checkout URL returned');
      window.open(data.url, '_blank');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start checkout');
    } finally {
      setLoadingPack(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Buy Content Lab credits</DialogTitle>
          <DialogDescription>
            1 credit = 1 idea regeneration · 1 remix · 1 manual pool refresh. Credits never expire.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {CONTENT_LAB_CREDIT_PACK_LIST.map((pack) => {
            const isHighlighted = pack.badge === 'Best value';
            return (
              <Card
                key={pack.key}
                className={`relative flex flex-col gap-2 p-4 transition-colors ${
                  isHighlighted ? 'border-primary/60 ring-1 ring-primary/30' : ''
                }`}
              >
                {pack.badge && (
                  <Badge
                    className="absolute -top-2 right-2 font-body text-[10px]"
                    variant={isHighlighted ? 'default' : 'secondary'}
                  >
                    {pack.badge}
                  </Badge>
                )}
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  {pack.credits} credits
                </div>
                <div className="font-display text-2xl">£{pack.price}</div>
                <div className="text-xs text-muted-foreground">{formatPerCredit(pack.price, pack.credits)}</div>
                <Button
                  size="sm"
                  variant={isHighlighted ? 'default' : 'outline'}
                  className="mt-2"
                  disabled={loadingPack !== null}
                  onClick={() => handleSelect(pack.key)}
                >
                  {loadingPack === pack.key ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Buy now
                </Button>
              </Card>
            );
          })}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Secure checkout via Stripe. Credits added automatically once payment is confirmed.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default BuyCreditsDialog;
