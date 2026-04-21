import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface Props {
  eyebrow: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/**
 * Shared page header for every Content Lab sub-page so they read like one product.
 * Eyebrow + display-font H1 + one-line subtitle + right-aligned action slot.
 */
const ContentLabHeader = ({ eyebrow, icon: Icon, title, subtitle, actions }: Props) => (
  <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {eyebrow}
      </div>
      <h1 className="mt-2 font-display text-3xl md:text-4xl">{title}</h1>
      {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 [&>button]:flex-1 sm:[&>button]:flex-initial md:shrink-0">{actions}</div>}
  </header>
);

export default ContentLabHeader;
