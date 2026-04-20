import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { BenchmarkPoolQuality } from '@/hooks/useBenchmarkPoolStatus';

interface Props {
  quality: BenchmarkPoolQuality;
  verifiedCount: number;
}

const CONFIG: Record<BenchmarkPoolQuality, { label: string; className: string; description: string }> = {
  strong: {
    label: 'Strong benchmarks',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    description: '15+ verified accounts in this niche — high-confidence inspiration pool.',
  },
  good: {
    label: 'Good benchmarks',
    className: 'bg-primary/10 text-primary border-primary/30',
    description: '10–14 verified accounts — solid pool to draw inspiration from.',
  },
  limited: {
    label: 'Limited benchmarks',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    description: '5–9 verified accounts — usable but narrow. Add more hashtags to broaden the pool.',
  },
  building: {
    label: 'Building benchmarks',
    className: 'bg-muted text-muted-foreground border-border',
    description: 'Pool is still filling. Try broader hashtags if it stays low.',
  },
  unknown: {
    label: 'No benchmark pool',
    className: 'bg-muted text-muted-foreground border-border',
    description: 'No niche tag set on this run.',
  },
};

const BenchmarkQualityBadge = ({ quality, verifiedCount }: Props) => {
  const cfg = CONFIG[quality];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Badge variant="outline" className={`gap-1.5 font-body text-[11px] ${cfg.className}`}>
            {cfg.label}
            <span className="opacity-70">· {verifiedCount}</span>
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[260px] text-xs">
        {cfg.description}
      </TooltipContent>
    </Tooltip>
  );
};

export default BenchmarkQualityBadge;
