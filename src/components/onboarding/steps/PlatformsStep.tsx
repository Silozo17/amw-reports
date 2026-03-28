import { cn } from '@/lib/utils';
import { PLATFORM_LOGOS, PLATFORM_LABELS, type PlatformType } from '@/types/database';

const CARD_BASE =
  'rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md hover:border-border';
const CARD_SELECTED =
  'bg-primary/8 border-primary/30 shadow-lg shadow-primary/10 scale-[1.02] ring-1 ring-primary/20';

const PLATFORM_IDS: PlatformType[] = [
  'facebook', 'instagram', 'tiktok', 'linkedin', 'youtube',
  'meta_ads', 'google_ads', 'google_search_console', 'google_analytics',
  'google_business_profile',
];

interface PlatformsStepProps {
  platformsUsed: string[];
  onToggle: (id: string) => void;
}

const PlatformsStep = ({ platformsUsed, onToggle }: PlatformsStepProps) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
    {PLATFORM_IDS.map((platformId) => {
      const selected = platformsUsed.includes(platformId);
      return (
        <button
          key={platformId}
          onClick={() => onToggle(platformId)}
          className={cn(CARD_BASE, 'flex flex-col items-center gap-3 p-4', selected && CARD_SELECTED)}
        >
          <img src={PLATFORM_LOGOS[platformId]} alt={PLATFORM_LABELS[platformId]} className="h-8 w-8 object-contain" />
          <span className="text-xs font-medium text-center leading-tight text-muted-foreground">
            {PLATFORM_LABELS[platformId]}
          </span>
        </button>
      );
    })}
  </div>
);

export default PlatformsStep;
