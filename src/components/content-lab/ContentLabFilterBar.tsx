import { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  placeholder?: string;
  /** Right-aligned filter selects (already styled SelectTriggers). */
  children?: ReactNode;
}

/** Standardised filter row used by every list page in Content Lab. */
const ContentLabFilterBar = ({ search, onSearchChange, placeholder = 'Search…', children }: Props) => (
  <Card className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={placeholder}
        className="border-0 bg-muted/30 pl-9 focus-visible:ring-1"
      />
    </div>
    {children && <div className="flex flex-wrap items-center gap-2 md:shrink-0">{children}</div>}
  </Card>
);

export default ContentLabFilterBar;
