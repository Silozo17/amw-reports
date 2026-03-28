import { cn } from '@/lib/utils';
import { Clock, Heart, BarChart3, Sparkles } from 'lucide-react';

const CARD_BASE =
  'rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md hover:border-border';
const CARD_SELECTED =
  'bg-primary/8 border-primary/30 shadow-lg shadow-primary/10 scale-[1.02] ring-1 ring-primary/20';

const REASONS = [
  { id: 'time_saving', label: 'Save time on reporting', icon: Clock },
  { id: 'client_retention', label: 'Impress clients with branded reports', icon: Heart },
  { id: 'reporting', label: 'Track performance across platforms', icon: BarChart3 },
  { id: 'growth', label: 'Retain and grow client base', icon: Sparkles },
];

interface ReasonStepProps {
  primaryReason: string;
  onSelect: (reason: string) => void;
}

const ReasonStep = ({ primaryReason, onSelect }: ReasonStepProps) => (
  <div className="grid gap-3 sm:grid-cols-2">
    {REASONS.map((reason) => {
      const Icon = reason.icon;
      const selected = primaryReason === reason.id;
      return (
        <button
          key={reason.id}
          onClick={() => onSelect(reason.id)}
          className={cn(CARD_BASE, 'flex items-center gap-4 p-5 text-left', selected && CARD_SELECTED)}
        >
          <div className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-300',
            selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium text-foreground">{reason.label}</span>
        </button>
      );
    })}
  </div>
);

export default ReasonStep;
