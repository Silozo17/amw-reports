import { useMemo, useCallback } from 'react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { DashboardWidget, WidgetData, WidgetType } from '@/types/widget';
import WidgetRenderer from './WidgetRenderer';
import { cn } from '@/lib/utils';

// @ts-expect-error react-grid-layout CJS default export
import GridLayout from 'react-grid-layout';

interface DashboardGridProps {
  widgets: DashboardWidget[];
  dataMap: Record<string, WidgetData>;
  onLayoutChange: (updatedWidgets: DashboardWidget[]) => void;
  onTypeChange: (widgetId: string, newType: WidgetType) => void;
  isEditMode: boolean;
}

const DashboardGrid = ({ widgets, dataMap, onLayoutChange, onTypeChange, isEditMode }: DashboardGridProps) => {
  const visibleWidgets = useMemo(() => widgets.filter((w) => w.visible), [widgets]);

  const layout = useMemo(
    () =>
      visibleWidgets.map((w) => ({
        i: w.id,
        x: w.position.x,
        y: w.position.y,
        w: w.position.w,
        h: w.position.h,
        minW: w.position.minW ?? 2,
        minH: w.position.minH ?? 2,
        isDraggable: isEditMode,
        isResizable: isEditMode,
      })),
    [visibleWidgets, isEditMode],
  );

  const handleLayoutChange = useCallback(
    (newLayout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
      if (!isEditMode) return;
      const updated = widgets.map((w) => {
        const item = newLayout.find((l) => l.i === w.id);
        if (!item) return w;
        return {
          ...w,
          position: { ...w.position, x: item.x, y: item.y, w: item.w, h: item.h },
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
      <GridLayout
        layout={layout}
        cols={12}
        rowHeight={72}
        width={1200}
        margin={[16, 16] as [number, number]}
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
      </GridLayout>
    </div>
  );
};

export default DashboardGrid;
