import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PackKey = 'small' | 'medium' | 'large';

interface Pack {
  key: PackKey;
  credits: number;
  price: string;
  perCredit: string;
  badge?: string;
}

const PACKS: Pack[] = [
  { key: 'small', credits: 5, price: '£15', perCredit: '£3.00 / credit' },
  { key: 'medium', credits: 25, price: '£60', perCredit: '£2.40 / credit', badge: 'Best value' },
  { key: 'large', credits: 100, price: '£200', perCredit: '£2.00 / credit', badge: 'Best deal' },
];

const BuyCreditsDialog = ({ open, onOpenChange }: Props) => {
  const [loadingPack, setLoadingPack] = useState<PackKey | null>(null);

  const handleSelect = async (pack: PackKey) => {
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Buy Content Lab credits</DialogTitle>
          <DialogDescription>
            Each credit unlocks one extra report run beyond your monthly allowance. Credits never expire.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-3">
          {PACKS.map((pack) => (
            <Card
              key={pack.key}
              className={`relative flex flex-col gap-2 p-5 transition-colors ${
                pack.badge ? 'border-primary/40' : ''
              }`}
            >
              {pack.badge && (
                <Badge className="absolute -top-2 right-3 font-body text-[10px]">
                  {pack.badge}
                </Badge>
              )}
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                {pack.credits} credits
              </div>
              <div className="font-display text-3xl">{pack.price}</div>
              <div className="text-xs text-muted-foreground">{pack.perCredit}</div>
              <Button
                size="sm"
                variant={pack.badge ? 'default' : 'outline'}
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
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Secure checkout via Stripe. Credits added automatically once payment is confirmed.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default BuyCreditsDialog;
