import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const METRIC_DESCRIPTIONS: Record<string, string> = {
  spend: 'Total advertising spend for the period.',
  impressions: 'Number of times your ads or content were displayed.',
  clicks: 'Number of times users clicked on your ads.',
  link_clicks: 'Clicks that led users to your website or landing page.',
  ctr: 'Click-Through Rate — the percentage of impressions that resulted in a click.',
  conversions: 'Actions completed by users after clicking (purchases, sign-ups, etc.).',
  conversion_rate: 'Percentage of clicks that resulted in a conversion.',
  cpc: 'Cost Per Click — average amount paid for each click.',
  cost_per_conversion: 'Average cost for each conversion.',
  reach: 'Number of unique users who saw your content.',
  leads: 'Number of potential customers who showed interest.',
  total_followers: 'Total number of followers on the account.',
  follower_growth: 'Net new followers gained during the period.',
  audience_growth_rate: 'Percentage increase in followers.',
  page_likes: 'Total likes on your Facebook Page.',
  profile_visits: 'Number of times users visited your profile.',
  engagement: 'Total interactions (likes, comments, shares, saves).',
  engagement_rate: 'Percentage of people who engaged with your content out of those who saw it.',
  likes: 'Number of likes received on posts.',
  comments: 'Number of comments received on posts.',
  shares: 'Number of times your content was shared.',
  saves: 'Number of times users saved your posts.',
  video_views: 'Number of video views.',
  posts_published: 'Number of posts published during the period.',
};

interface MetricTooltipProps {
  metricKey: string;
}

const MetricTooltip = ({ metricKey }: MetricTooltipProps) => {
  const description = METRIC_DESCRIPTIONS[metricKey];
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
