import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import type { DashboardWidget, WidgetData, WidgetType } from '@/types/widget';
import WidgetRenderer from './WidgetRenderer';
import { cn } from '@/lib/utils';

interface DashboardGridProps {
  widgets: DashboardWidget[];
  dataMap: Record<string, WidgetData>;
  onLayoutChange: (updatedWidgets: DashboardWidget[]) => void;
  onTypeChange: (widgetId: string, newType: WidgetType) => void;
  isEditMode: boolean;
}

const COLS = 12;
const GAP = 16;
const ROW_H = 72;

interface DragState {
  widgetId: string;
  startMouseX: number;
  startMouseY: number;
  startLeft: number;
  startTop: number;
  offsetX: number;
  offsetY: number;
}

const DashboardGrid = ({ widgets, dataMap, onLayoutChange, onTypeChange, isEditMode }: DashboardGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  const visibleWidgets = useMemo(() => widgets.filter((w) => w.visible), [widgets]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const colW = (containerWidth - GAP * (COLS + 1)) / COLS;

  // Compact layout vertically
  const compactedLayout = useMemo(() => {
    const items = visibleWidgets.map((w) => ({
      ...w,
      pos: { ...w.position },
    }));

    items.sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x);

    const occupied: boolean[][] = [];
    const ensureRows = (maxY: number) => {
      while (occupied.length <= maxY + 10) occupied.push(new Array(COLS).fill(false));
    };
    ensureRows(100);

    for (const item of items) {
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

  // ─── Pointer-based drag ──────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, widgetId: string, left: number, top: number) => {
      if (!isEditMode) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const state: DragState = {
        widgetId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startLeft: left,
        startTop: top,
        offsetX: 0,
        offsetY: 0,
      };
      dragRef.current = state;
      setDragState(state);
      setDragOffset({ x: 0, y: 0 });
    },
    [isEditMode],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const dx = e.clientX - dragRef.current.startMouseX;
      const dy = e.clientY - dragRef.current.startMouseY;
      dragRef.current.offsetX = dx;
      dragRef.current.offsetY = dy;
      setDragOffset({ x: dx, y: dy });
    },
    [],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const state = dragRef.current;
      if (!state) return;
      e.preventDefault();
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      const finalLeft = state.startLeft + state.offsetX;
      const finalTop = state.startTop + state.offsetY;

      // Snap to grid
      const gridX = Math.round((finalLeft - GAP) / (colW + GAP));
      const gridY = Math.round((finalTop - GAP) / (ROW_H + GAP));

      const widget = widgets.find((w) => w.id === state.widgetId);
      if (widget) {
        const clampedX = Math.max(0, Math.min(gridX, COLS - widget.position.w));
        const clampedY = Math.max(0, gridY);

        const updated = widgets.map((w) =>
          w.id === state.widgetId
            ? { ...w, position: { ...w.position, x: clampedX, y: clampedY } }
            : w,
        );
        onLayoutChange(updated);
      }

      dragRef.current = null;
      setDragState(null);
      setDragOffset(null);
    },
    [widgets, onLayoutChange, colW],
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
      className={cn('relative select-none', isEditMode && 'dashboard-grid-editing')}
      style={{ minHeight: maxY * (ROW_H + GAP) + GAP }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Grid lines in edit mode */}
      {isEditMode && (
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage: `
              repeating-linear-gradient(90deg, hsl(var(--primary)) 0px, hsl(var(--primary)) 1px, transparent 1px, transparent ${colW + GAP}px),
              repeating-linear-gradient(0deg, hsl(var(--primary)) 0px, hsl(var(--primary)) 1px, transparent 1px, transparent ${ROW_H + GAP}px)
            `,
            backgroundPosition: `${GAP}px ${GAP}px`,
          }}
        />
      )}

      {compactedLayout.map((item) => {
        const left = GAP + item.pos.x * (colW + GAP);
        const top = GAP + item.pos.y * (ROW_H + GAP);
        const width = item.pos.w * colW + (item.pos.w - 1) * GAP;
        const height = item.pos.h * ROW_H + (item.pos.h - 1) * GAP;

        const isDragging = dragState?.widgetId === item.id;
        const dragX = isDragging && dragOffset ? dragOffset.x : 0;
        const dragY = isDragging && dragOffset ? dragOffset.y : 0;

        return (
          <div
            key={item.id}
            className={cn(
              'absolute touch-none',
              !isDragging && 'transition-all duration-200',
              isEditMode && 'cursor-grab',
              isDragging && 'cursor-grabbing z-50 shadow-2xl ring-2 ring-primary/40 scale-[1.02]',
            )}
            style={{
              left: left + dragX,
              top: top + dragY,
              width,
              height,
            }}
            onPointerDown={(e) => handlePointerDown(e, item.id, left, top)}
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
