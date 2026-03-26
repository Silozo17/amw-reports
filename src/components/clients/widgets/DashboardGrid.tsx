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

interface DragInfo {
  widgetId: string;
  /** Mouse position at drag start */
  startMouseX: number;
  startMouseY: number;
  /** Widget pixel position at drag start */
  startLeft: number;
  startTop: number;
  /** Current ghost grid cell */
  ghostX: number;
  ghostY: number;
  /** Current pixel offset from start */
  currentX: number;
  currentY: number;
  /** When true, widget is animating to ghost position after release */
  snapping: boolean;
}

/* ────────────────────────────────────────────
 * Layout algorithm – compact widgets vertically
 * with an optional ghost override for one widget
 * ──────────────────────────────────────────── */
function compactLayout(
  widgets: DashboardWidget[],
  ghostId?: string,
  ghostX?: number,
  ghostY?: number,
) {
  const items = widgets.map((w) => ({
    ...w,
    pos: {
      x: w.id === ghostId && ghostX !== undefined ? ghostX : w.position.x,
      y: w.id === ghostId && ghostY !== undefined ? ghostY : w.position.y,
      w: w.position.w,
      h: w.position.h,
    },
  }));

  // Sort: the ghost widget gets priority (placed first) so others reflow around it
  items.sort((a, b) => {
    if (a.id === ghostId) return -1;
    if (b.id === ghostId) return 1;
    return a.pos.y - b.pos.y || a.pos.x - b.pos.x;
  });

  const occupied: boolean[][] = [];
  const ensureRows = (maxY: number) => {
    while (occupied.length <= maxY + 10) occupied.push(new Array(COLS).fill(false));
  };
  ensureRows(100);

  for (const item of items) {
    const w = item.pos.w;
    const h = item.pos.h;
    const targetX = Math.min(Math.max(item.pos.x, 0), COLS - w);

    if (item.id === ghostId) {
      // Place ghost at its exact target position, mark cells
      const y = Math.max(item.pos.y, 0);
      ensureRows(y + h);
      item.pos.x = targetX;
      item.pos.y = y;
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          occupied[y + dy][targetX + dx] = true;
        }
      }
      continue;
    }

    // For non-ghost widgets, find the first row where they fit
    let placed = false;
    for (let tryY = 0; tryY < 300 && !placed; tryY++) {
      ensureRows(tryY + h);
      let fits = true;
      for (let dy = 0; dy < h && fits; dy++) {
        for (let dx = 0; dx < w && fits; dx++) {
          if (occupied[tryY + dy]?.[targetX + dx]) fits = false;
        }
      }
      if (fits) {
        item.pos.y = tryY;
        item.pos.x = targetX;
        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            occupied[tryY + dy][targetX + dx] = true;
          }
        }
        placed = true;
      }
    }
  }

  return items;
}

const DashboardGrid = ({ widgets, dataMap, onLayoutChange, onTypeChange, isEditMode }: DashboardGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const dragRef = useRef<DragInfo | null>(null);
  const rafRef = useRef<number | null>(null);

  const visibleWidgets = useMemo(() => widgets.filter((w) => w.visible), [widgets]);

  // Observe container width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const colW = (containerWidth - GAP * (COLS + 1)) / COLS;

  // Compute layout – reflows live when dragging
  const layout = useMemo(() => {
    if (drag) {
      return compactLayout(visibleWidgets, drag.widgetId, drag.ghostX, drag.ghostY);
    }
    return compactLayout(visibleWidgets);
  }, [visibleWidgets, drag]);

  // ─── Pixel helpers ─────────────────────────────────────────
  const gridToPixelX = useCallback((gx: number) => GAP + gx * (colW + GAP), [colW]);
  const gridToPixelY = useCallback((gy: number) => GAP + gy * (ROW_H + GAP), []);
  const pixelToGridX = useCallback(
    (px: number) => Math.round((px - GAP) / (colW + GAP)),
    [colW],
  );
  const pixelToGridY = useCallback(
    (py: number) => Math.round((py - GAP) / (ROW_H + GAP)),
    [],
  );

  // ─── Pointer handlers ─────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, widgetId: string, left: number, top: number) => {
      if (!isEditMode) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const widget = visibleWidgets.find((w) => w.id === widgetId);
      if (!widget) return;

      const info: DragInfo = {
        widgetId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startLeft: left,
        startTop: top,
        ghostX: widget.position.x,
        ghostY: widget.position.y,
        currentX: 0,
        currentY: 0,
        snapping: false,
      };
      dragRef.current = info;
      setDrag(info);
    },
    [isEditMode, visibleWidgets],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.snapping) return;
      e.preventDefault();

      const dx = e.clientX - d.startMouseX;
      const dy = e.clientY - d.startMouseY;

      const newLeft = d.startLeft + dx;
      const newTop = d.startTop + dy;

      const widget = visibleWidgets.find((w) => w.id === d.widgetId);
      if (!widget) return;

      const gx = Math.max(0, Math.min(pixelToGridX(newLeft), COLS - widget.position.w));
      const gy = Math.max(0, pixelToGridY(newTop));

      d.currentX = dx;
      d.currentY = dy;
      d.ghostX = gx;
      d.ghostY = gy;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setDrag({ ...d });
        rafRef.current = null;
      });
    },
    [visibleWidgets, pixelToGridX, pixelToGridY],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.snapping) return;
      e.preventDefault();
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Phase 1: mark as snapping — widget will transition to ghost position
      d.snapping = true;
      dragRef.current = { ...d };
      setDrag({ ...d });

      // Phase 2: after transition completes, commit layout and clear drag
      const finalLayout = compactLayout(visibleWidgets, d.widgetId, d.ghostX, d.ghostY);
      const updated = widgets.map((w) => {
        const found = finalLayout.find((l) => l.id === w.id);
        if (found) {
          return { ...w, position: { ...w.position, x: found.pos.x, y: found.pos.y } };
        }
        return w;
      });

      setTimeout(() => {
        dragRef.current = null;
        setDrag(null);
        onLayoutChange(updated);
      }, 200);
    },
    [widgets, visibleWidgets, onLayoutChange],
  );

  // ─── Empty state ───────────────────────────────────────────
  if (visibleWidgets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">No widgets visible. Use the Widgets panel to enable some.</p>
      </div>
    );
  }

  const maxY = Math.max(...layout.map((item) => item.pos.y + item.pos.h), 0);

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

      {layout.map((item) => {
        const left = gridToPixelX(item.pos.x);
        const top = gridToPixelY(item.pos.y);
        const width = item.pos.w * colW + (item.pos.w - 1) * GAP;
        const height = item.pos.h * ROW_H + (item.pos.h - 1) * GAP;

        const isDragging = drag?.widgetId === item.id;
        const isSnappingBack = isDragging && drag.snapping;

        // During drag: follow cursor. During snap: animate to ghost grid position. Otherwise: layout position.
        const renderLeft = isDragging
          ? (isSnappingBack ? left : drag.startLeft + drag.currentX)
          : left;
        const renderTop = isDragging
          ? (isSnappingBack ? top : drag.startTop + drag.currentY)
          : top;

        return (
          <div key={item.id}>
            {/* Ghost placeholder – shown at target grid position while dragging (hidden during snap since widget is heading there) */}
            {isDragging && !isSnappingBack && (
              <div
                className="absolute rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 transition-all duration-300 ease-in-out"
                style={{ left, top, width, height }}
              />
            )}

            {/* Actual widget */}
            <div
              className={cn(
                'absolute touch-none',
                isEditMode && 'cursor-grab',
                isDragging && !isSnappingBack && 'cursor-grabbing z-50 shadow-2xl ring-2 ring-primary/40 scale-[1.02] opacity-90',
                isSnappingBack && 'z-50 transition-all duration-200 ease-out',
                !isDragging && 'transition-all duration-300 ease-in-out',
              )}
              style={{
                left: renderLeft,
                top: renderTop,
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
          </div>
        );
      })}
    </div>
  );
};

export default DashboardGrid;
