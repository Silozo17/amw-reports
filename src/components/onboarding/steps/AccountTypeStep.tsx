import { cn } from '@/lib/utils';
import { Palette, Building2, Users } from 'lucide-react';

const ACCOUNT_TYPES = [
  { id: 'creator', label: 'Creator', description: 'I manage my own brand and content', icon: Palette },
  { id: 'business', label: 'Business', description: 'I run a business and need marketing insights', icon: Building2 },
  { id: 'agency', label: 'Agency', description: 'I manage marketing for multiple clients', icon: Users },
];

const CARD_BASE =
  'rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md hover:border-border';
const CARD_SELECTED =
  'bg-primary/8 border-primary/30 shadow-lg shadow-primary/10 scale-[1.02] ring-1 ring-primary/20';

interface AccountTypeStepProps {
  accountType: string;
  onSelect: (type: string) => void;
}

const AccountTypeStep = ({ accountType, onSelect }: AccountTypeStepProps) => (
  <div className="grid gap-4 sm:grid-cols-3">
    {ACCOUNT_TYPES.map((type) => {
      const Icon = type.icon;
      const selected = accountType === type.id;
      return (
        <button
          key={type.id}
          onClick={() => onSelect(type.id)}
          className={cn(CARD_BASE, 'flex flex-col items-center gap-4 p-6', selected && CARD_SELECTED)}
        >
          <div className={cn(
            'flex h-14 w-14 items-center justify-center rounded-xl transition-colors duration-300',
            selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-base text-foreground">{type.label}</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{type.description}</p>
          </div>
        </button>
      );
    })}
  </div>
);

export default AccountTypeStep;
