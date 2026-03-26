import { Badge } from '@/components/ui/badge';

interface UsageBadgeProps {
  current: number;
  max: number;
  label: string;
}

const UsageBadge = ({ current, max, label }: UsageBadgeProps) => {
  const isUnlimited = !isFinite(max);
  const isAtLimit = !isUnlimited && current >= max;
  const isNearLimit = !isUnlimited && current >= max * 0.8;

  return (
    <Badge
      variant={isAtLimit ? 'destructive' : isNearLimit ? 'secondary' : 'outline'}
      className="font-body text-xs"
    >
      {current}/{isUnlimited ? '∞' : max} {label}
    </Badge>
  );
};

export default UsageBadge;
