import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { METRIC_EXPLANATIONS } from '@/types/metrics';

interface MetricTooltipProps {
  metricKey: string;
}

const MetricTooltip = ({ metricKey }: MetricTooltipProps) => {
  const description = METRIC_EXPLANATIONS[metricKey];
  if (!description) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs">
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default MetricTooltip;
