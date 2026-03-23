import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatusCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

const VARIANT_CLASSES = {
  default: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

const StatusCard = ({ title, value, icon, description, variant = 'default' }: StatusCardProps) => {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-body font-medium text-muted-foreground">{title}</p>
            <p className={cn('text-3xl font-display mt-1', VARIANT_CLASSES[variant])}>{value}</p>
            {description && (
              <p className="text-xs font-body text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className={cn('p-2 rounded-md bg-muted', VARIANT_CLASSES[variant])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatusCard;
