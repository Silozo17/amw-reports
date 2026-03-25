import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { DashboardWidget, WidgetData, WidgetType } from '@/types/widget';
import WidgetRenderer from './WidgetRenderer';
import { cn } from '@/lib/utils';

/* react-grid-layout is imported but we use a custom grid instead */

interface DashboardGridProps {
  widgets: DashboardWidget[];
  dataMap: Record<string, WidgetData>;
  onLayoutChange: (updatedWidgets: DashboardWidget[]) => void;
  onTypeChange: (widgetId: string, newType: WidgetType) => void;
  isEditMode: boolean;
}

const DashboardGrid = ({ widgets, dataMap, onLayoutChange, onTypeChange, isEditMode }: DashboardGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const visibleWidgets = useMemo(() => widgets.filter((w) => w.visible), [widgets]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const COLS = 12;
  const GAP = 16;
  const ROW_H = 72;

  // Compact layout vertically
  const compactedLayout = useMemo(() => {
    const items = visibleWidgets.map((w) => ({
      ...w,
      pos: { ...w.position },
    }));

    // Sort by y then x
    items.sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x);

    // Simple vertical compaction
    const occupied: boolean[][] = [];
    const ensureRows = (maxY: number) => {
      while (occupied.length <= maxY + 10) {
        occupied.push(new Array(COLS).fill(false));
      }
    };
    ensureRows(100);

    for (const item of items) {
      // Find first y where item fits
      let placed = false;
      for (let tryY = 0; tryY < 200 && !placed; tryY++) {
        ensureRows(tryY + item.pos.h);
        const x = Math.min(item.pos.x, COLS - item.pos.w);
        let fits = true;
        for (let dy = 0; dy < item.pos.h && fits; dy++) {
          for (let dx = 0; dx < item.pos.w && fits; dx++) {
            if (occupied[tryY + dy]?.[x + dx]) fits = false;
          }
        }
        if (fits) {
          item.pos.y = tryY;
          item.pos.x = x;
          for (let dy = 0; dy < item.pos.h; dy++) {
            for (let dx = 0; dx < item.pos.w; dx++) {
              occupied[tryY + dy][x + dx] = true;
            }
          }
          placed = true;
        }
      }
    }

    return items;
  }, [visibleWidgets]);

  const colW = (containerWidth - GAP * (COLS + 1)) / COLS;

  const handleDragEnd = useCallback(
    (widgetId: string, newX: number, newY: number) => {
      if (!isEditMode) return;
      const gridX = Math.round(newX / (colW + GAP));
      const gridY = Math.round(newY / (ROW_H + GAP));
      const updated = widgets.map((w) =>
        w.id === widgetId
          ? { ...w, position: { ...w.position, x: Math.max(0, Math.min(gridX, COLS - w.position.w)), y: Math.max(0, gridY) } }
          : w,
      );
      onLayoutChange(updated);
    },
    [widgets, isEditMode, onLayoutChange, colW],
  );

  if (visibleWidgets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">No widgets visible. Use the Widgets panel to enable some.</p>
      </div>
    );
  }

  const maxY = Math.max(...compactedLayout.map((item) => item.pos.y + item.pos.h), 0);

  return (
    <div
      ref={containerRef}
      className={cn('relative', isEditMode && 'dashboard-grid-editing')}
      style={{ minHeight: maxY * (ROW_H + GAP) + GAP }}
    >
      {/* Grid lines in edit mode */}
      {isEditMode && (
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{
          backgroundImage: `
            repeating-linear-gradient(90deg, hsl(var(--primary)) 0px, hsl(var(--primary)) 1px, transparent 1px, transparent ${colW + GAP}px),
            repeating-linear-gradient(0deg, hsl(var(--primary)) 0px, hsl(var(--primary)) 1px, transparent 1px, transparent ${ROW_H + GAP}px)
          `,
          backgroundPosition: `${GAP}px ${GAP}px`,
        }} />
      )}

      {compactedLayout.map((item) => {
        const left = GAP + item.pos.x * (colW + GAP);
        const top = GAP + item.pos.y * (ROW_H + GAP);
        const width = item.pos.w * colW + (item.pos.w - 1) * GAP;
        const height = item.pos.h * ROW_H + (item.pos.h - 1) * GAP;

        return (
          <div
            key={item.id}
            className={cn(
              'absolute transition-all duration-200',
              isEditMode && 'cursor-grab active:cursor-grabbing',
            )}
            style={{ left, top, width, height }}
            draggable={isEditMode}
            onDragEnd={(e) => {
              if (!isEditMode) return;
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              handleDragEnd(item.id, e.clientX - rect.left, e.clientY - rect.top);
            }}
          >
            <WidgetRenderer
              widget={item}
              data={dataMap[item.dataSource] ?? {}}
              onTypeChange={onTypeChange}
              isEditMode={isEditMode}
            />
          </div>
        );
      })}
    </div>
  );
};

export default DashboardGrid;
