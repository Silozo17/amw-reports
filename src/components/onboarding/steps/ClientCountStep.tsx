import { cn } from '@/lib/utils';

const CLIENT_COUNTS = ['1–5', '6–20', '21–50', '50+'];

interface ClientCountStepProps {
  clientCount: string;
  onSelect: (count: string) => void;
}

const ClientCountStep = ({ clientCount, onSelect }: ClientCountStepProps) => (
  <div className="flex flex-wrap justify-center gap-4">
    {CLIENT_COUNTS.map((count) => (
      <button
        key={count}
        onClick={() => onSelect(count)}
        className={cn(
          'rounded-full px-8 py-3.5 text-sm font-semibold border border-border/60 bg-card shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md',
          clientCount === count
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 border-primary/30 scale-[1.05]'
            : 'text-foreground hover:border-border'
        )}
      >
        {count}
      </button>
    ))}
  </div>
);

export default ClientCountStep;
