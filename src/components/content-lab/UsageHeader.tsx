import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContentLabUsage } from '@/hooks/useContentLab';
import BuyCreditsDialog from '@/components/content-lab/BuyCreditsDialog';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  buttonSize?: 'sm' | 'default' | 'lg';
}

const UsageHeader = ({ className, buttonSize = 'default' }: Props) => {
  const { data: usage } = useContentLabUsage();
  const [open, setOpen] = useState(false);

  const runsThisMonth = usage?.runsThisMonth ?? 0;
  const runsLimit = usage?.runsLimit ?? 0;
  const credits = usage?.creditBalance ?? 0;

  const runsRatio = runsLimit > 0 ? runsThisMonth / runsLimit : 0;
  const runsTone =
    runsLimit === 0
      ? 'border-border text-muted-foreground'
      : runsThisMonth >= runsLimit
      ? 'border-destructive/50 bg-destructive/10 text-destructive'
      : runsRatio >= 0.8
      ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : 'border-border text-foreground';

  const creditsTone =
    credits <= 0
      ? 'border-destructive/50 bg-destructive/10 text-destructive'
      : 'border-border text-foreground';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium',
          runsTone,
        )}
      >
        <span className="text-[10px] uppercase tracking-wider opacity-70">Runs</span>
        <span className="tabular-nums">
          {runsThisMonth}/{runsLimit || '—'}
        </span>
      </div>

      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium',
          creditsTone,
        )}
      >
        <span className="text-[10px] uppercase tracking-wider opacity-70">Credits</span>
        <span className="tabular-nums">{credits.toLocaleString()}</span>
      </div>

      <Button variant="outline" size={buttonSize} onClick={() => setOpen(true)}>
        <CreditCard className="mr-2 h-3.5 w-3.5" /> Buy credits
      </Button>

      <BuyCreditsDialog open={open} onOpenChange={setOpen} />
    </div>
  );
};

export default UsageHeader;
