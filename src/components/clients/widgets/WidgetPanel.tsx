import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DashboardWidget } from '@/types/widget';
import { PLATFORM_LABELS } from '@/types/database';

interface WidgetPanelProps {
  widgets: DashboardWidget[];
  onToggle: (widgetId: string, visible: boolean) => void;
  onResetLayout: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  kpi: 'Key Metrics',
  chart: 'Charts & Visualisations',
  table: 'Data Tables',
  platform: 'Platform Metrics',
};

const WidgetPanel = ({ widgets, onToggle, onResetLayout }: WidgetPanelProps) => {
  // Group by category, then platform for platform widgets
  const kpiWidgets = widgets.filter((w) => w.category === 'kpi');
  const chartWidgets = widgets.filter((w) => w.category === 'chart');
  const tableWidgets = widgets.filter((w) => w.category === 'table');
  const platformWidgets = widgets.filter((w) => w.category === 'platform');

  // Group platform widgets by platform
  const platformGroups = new Map<string, DashboardWidget[]>();
  for (const w of platformWidgets) {
    const platform = w.id.split('-')[1] ?? 'other';
    const group = platformGroups.get(platform) ?? [];
    group.push(w);
    platformGroups.set(platform, group);
  }

  const renderGroup = (label: string, items: DashboardWidget[]) => {
    if (items.length === 0) return null;
    return (
      <div key={label}>
        <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">{label}</h4>
        <div className="space-y-1">
          {items.map((w) => (
            <div key={w.id} className="flex items-center justify-between py-1.5 px-1 rounded-md hover:bg-muted/50">
              <div className="min-w-0 flex-1 mr-3">
                <p className="text-sm font-medium truncate">{w.label}</p>
              </div>
              <Switch
                checked={w.visible}
                onCheckedChange={(checked) => onToggle(w.id, checked)}
                className="shrink-0"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-3.5 w-3.5" />
          Widgets
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[340px] sm:w-[380px]">
        <SheetHeader>
          <SheetTitle className="font-display">Dashboard Widgets</SheetTitle>
          <p className="text-xs text-muted-foreground">Toggle widgets on or off to customise your view</p>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100vh-140px)]">
          <div className="space-y-6 pr-4">
            {renderGroup('Key Metrics', kpiWidgets)}
            {renderGroup('Charts & Visualisations', chartWidgets)}
            {renderGroup('Data Tables', tableWidgets)}
            {Array.from(platformGroups.entries()).map(([platform, items]) =>
              renderGroup(PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] ?? platform, items),
            )}
            <div className="pt-4 border-t">
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={onResetLayout}>
                Reset to Default Layout
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default WidgetPanel;
