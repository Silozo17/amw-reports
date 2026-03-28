import { cn } from '@/lib/utils';
import { Search, Share2, MessageSquare, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';

const CARD_BASE =
  'rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md hover:border-border';
const CARD_SELECTED =
  'bg-primary/8 border-primary/30 shadow-lg shadow-primary/10 scale-[1.02] ring-1 ring-primary/20';

const REFERRAL_SOURCES = [
  { id: 'google', label: 'Google search', icon: Search },
  { id: 'social', label: 'Social media', icon: Share2 },
  { id: 'referral', label: 'Referral', icon: MessageSquare },
  { id: 'event', label: 'Event / conference', icon: Calendar },
  { id: 'other', label: 'Other', icon: MessageSquare },
];

interface ReferralStepProps {
  referralSource: string;
  onSelect: (source: string) => void;
  otherReferral: string;
  onOtherChange: (value: string) => void;
}

const ReferralStep = ({ referralSource, onSelect, otherReferral, onOtherChange }: ReferralStepProps) => (
  <>
    <div className="grid gap-3 sm:grid-cols-3">
      {REFERRAL_SOURCES.map((source) => {
        const Icon = source.icon;
        const selected = referralSource === source.id;
        return (
          <button
            key={source.id}
            onClick={() => onSelect(source.id)}
            className={cn(CARD_BASE, 'flex flex-col items-center gap-3 p-5', selected && CARD_SELECTED)}
          >
            <Icon className={cn('h-5 w-5 transition-colors duration-300', selected ? 'text-primary' : 'text-muted-foreground')} />
            <span className="text-sm font-medium text-foreground">{source.label}</span>
          </button>
        );
      })}
    </div>
    {referralSource === 'other' && (
      <div className="mt-4">
        <Input
          value={otherReferral}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="Tell us more..."
          className="bg-card border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary/30"
        />
      </div>
    )}
  </>
);

export default ReferralStep;
