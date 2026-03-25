import { useMemo, useCallback } from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ReactGridLayout = require('react-grid-layout');
const { Responsive: ResponsiveBase, WidthProvider: WP } = ReactGridLayout;
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { DashboardWidget, WidgetData, WidgetType } from '@/types/widget';
import WidgetRenderer from './WidgetRenderer';
import { cn } from '@/lib/utils';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridProps {
  widgets: DashboardWidget[];
  dataMap: Record<string, WidgetData>;
  onLayoutChange: (updatedWidgets: DashboardWidget[]) => void;
  onTypeChange: (widgetId: string, newType: WidgetType) => void;
  isEditMode: boolean;
}

const DashboardGrid = ({ widgets, dataMap, onLayoutChange, onTypeChange, isEditMode }: DashboardGridProps) => {
  const visibleWidgets = useMemo(() => widgets.filter((w) => w.visible), [widgets]);

  const layouts = useMemo(() => {
    const lg = visibleWidgets.map((w) => ({
      i: w.id,
      x: w.position.x,
      y: w.position.y,
      w: w.position.w,
      h: w.position.h,
      minW: w.position.minW ?? 2,
      minH: w.position.minH ?? 2,
      isDraggable: isEditMode,
      isResizable: isEditMode,
    }));

    // Medium breakpoint: reduce to 8 columns
    const md = visibleWidgets.map((w) => ({
      i: w.id,
      x: Math.min(w.position.x, 8 - Math.min(w.position.w, 8)),
      y: w.position.y,
      w: Math.min(w.position.w, 8),
      h: w.position.h,
      minW: Math.min(w.position.minW ?? 2, 4),
      minH: w.position.minH ?? 2,
    }));

    // Small breakpoint: everything full width
    const sm = visibleWidgets.map((w, i) => ({
      i: w.id,
      x: 0,
      y: i * w.position.h,
      w: 4,
      h: w.position.h,
      minW: 2,
      minH: w.position.minH ?? 2,
    }));

    return { lg, md, sm };
  }, [visibleWidgets, isEditMode]);

  const handleLayoutChange = useCallback(
    (_currentLayout: any[], allLayouts: Record<string, any[]>) => {
      if (!isEditMode) return;
      const lgLayout = allLayouts.lg ?? _currentLayout;
      const updated = widgets.map((w) => {
        const item = lgLayout.find((l: any) => l.i === w.id);
        if (!item) return w;
        return {
          ...w,
          position: {
            ...w.position,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          },
        };
      });
      onLayoutChange(updated);
    },
    [widgets, isEditMode, onLayoutChange],
  );

  if (visibleWidgets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">No widgets visible. Use the Widgets panel to enable some.</p>
      </div>
    );
  }

  return (
    <div className={cn('dashboard-grid', isEditMode && 'dashboard-grid-editing')}>
      <ResponsiveGridLayout
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 900, sm: 0 }}
        cols={{ lg: 12, md: 8, sm: 4 }}
        rowHeight={72}
        margin={[16, 16]}
        compactType="vertical"
        isDraggable={isEditMode}
        isResizable={isEditMode}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-drag-handle"
      >
        {visibleWidgets.map((widget) => (
          <div key={widget.id} className={cn(isEditMode && 'widget-drag-handle cursor-grab active:cursor-grabbing')}>
            <WidgetRenderer
              widget={widget}
              data={dataMap[widget.dataSource] ?? {}}
              onTypeChange={onTypeChange}
              isEditMode={isEditMode}
            />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
};

export default DashboardGrid;
