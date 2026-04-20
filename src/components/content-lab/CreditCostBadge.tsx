import { Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useContentLabCredits } from '@/hooks/useContentLabCredits';

interface Props {
  cost: number;
  label?: string;
}

const CreditCostBadge = ({ cost, label }: Props) => {
  const { data } = useContentLabCredits();
  const balance = data?.balance ?? 0;
  const insufficient = balance < cost;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
              insufficient
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-border bg-muted/50 text-muted-foreground'
            }`}
          >
            <Sparkles className="h-3 w-3" />
            {cost} {cost === 1 ? 'credit' : 'credits'}
            {label && <span className="opacity-60">· {label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>Your balance: <strong>{balance}</strong> credit{balance === 1 ? '' : 's'}</p>
          {insufficient && <p className="mt-1 text-destructive">Top up to use this action.</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CreditCostBadge;
