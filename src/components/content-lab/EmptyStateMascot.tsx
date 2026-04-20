import { ReactNode } from 'react';
import mascot from '@/assets/mascot.svg';
import { Card } from '@/components/ui/card';

interface EmptyStateMascotProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Friendly empty-state with mascot, used across Content Lab surfaces. */
const EmptyStateMascot = ({ title, description, action }: EmptyStateMascotProps) => {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 p-10 text-center">
      <img
        src={mascot}
        alt=""
        className="h-24 w-24 opacity-80 [filter:drop-shadow(0_4px_12px_hsl(var(--primary)/0.15))]"
      />
      <div className="space-y-1">
        <p className="font-display text-lg">{title}</p>
        {description && (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </Card>
  );
};

export default EmptyStateMascot;
