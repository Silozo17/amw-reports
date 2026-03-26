import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import type { DashboardWidget, WidgetData, WidgetType } from '@/types/widget';
import WidgetRenderer from './WidgetRenderer';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

interface DashboardGridProps {
  widgets: DashboardWidget[];
  dataMap: Record<string, WidgetData>;
  onLayoutChange: (updatedWidgets: DashboardWidget[]) => void;
  onTypeChange: (widgetId: string, newType: WidgetType) => void;
  isEditMode: boolean;
}

const COLS = 12;
const GAP = 16;
const ROW_H = 80;
const MIN_W = 2;
const MIN_H = 2;
const MAX_W = 12;
const MAX_H = 8;

interface DragInfo {
  widgetId: string;
  startMouseX: number;
  startMouseY: number;
  startLeft: number;
  startTop: number;
  ghostX: number;
  ghostY: number;
  currentX: number;
  currentY: number;
  snapping: boolean;
}

interface ResizeInfo {
  widgetId: string;
  startMouseX: number;
  startMouseY: number;
  startW: number;
  startH: number;
  currentW: number;
  currentH: number;
  snapping: boolean;
}

/* ────────────────────────────────────────────
 * Layout algorithm – compact widgets vertically
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
  const [resize, setResize] = useState<ResizeInfo | null>(null);
  const dragRef = useRef<DragInfo | null>(null);
  const resizeRef = useRef<ResizeInfo | null>(null);
  const rafRef = useRef<number | null>(null);

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

  // Compute layout with resize overrides
  const widgetsWithResize = useMemo(() => {
    if (!resize) return visibleWidgets;
    return visibleWidgets.map((w) => {
      if (w.id !== resize.widgetId) return w;
      return { ...w, position: { ...w.position, w: resize.currentW, h: resize.currentH } };
    });
  }, [visibleWidgets, resize]);

  const layout = useMemo(() => {
    if (drag) {
      return compactLayout(widgetsWithResize, drag.widgetId, drag.ghostX, drag.ghostY);
    }
    return compactLayout(widgetsWithResize);
  }, [widgetsWithResize, drag]);

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

  // ─── Drag Pointer handlers ────────────────────────────────
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
      // Handle resize
      const r = resizeRef.current;
      if (r && !r.snapping) {
        e.preventDefault();
        const dx = e.clientX - r.startMouseX;
        const dy = e.clientY - r.startMouseY;

        const widget = visibleWidgets.find((w) => w.id === r.widgetId);
        if (!widget) return;

        const minW = widget.position.minW ?? MIN_W;
        const minH = widget.position.minH ?? MIN_H;

        // Convert pixel delta to grid units
        const deltaColsRaw = dx / (colW + GAP);
        const deltaRowsRaw = dy / (ROW_H + GAP);
        const newW = Math.max(minW, Math.min(MAX_W, Math.round(r.startW + deltaColsRaw)));
        const newH = Math.max(minH, Math.min(MAX_H, Math.round(r.startH + deltaRowsRaw)));

        r.currentW = newW;
        r.currentH = newH;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          setResize({ ...r });
          rafRef.current = null;
        });
        return;
      }

      // Handle drag
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
    [visibleWidgets, pixelToGridX, pixelToGridY, colW],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      // Handle resize release
      const r = resizeRef.current;
      if (r && !r.snapping) {
        e.preventDefault();
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);

        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }

        // Commit resize
        const updated = widgets.map((w) => {
          if (w.id !== r.widgetId) return w;
          return { ...w, position: { ...w.position, w: r.currentW, h: r.currentH } };
        });

        resizeRef.current = null;
        setResize(null);
        onLayoutChange(updated);
        return;
      }

      // Handle drag release
      const d = dragRef.current;
      if (!d || d.snapping) return;
      e.preventDefault();
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      d.snapping = true;
      dragRef.current = { ...d };
      setDrag({ ...d });

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

  // ─── Resize handler ────────────────────────────────────────
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, widgetId: string) => {
      if (!isEditMode) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const widget = visibleWidgets.find((w) => w.id === widgetId);
      if (!widget) return;

      const info: ResizeInfo = {
        widgetId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startW: widget.position.w,
        startH: widget.position.h,
        currentW: widget.position.w,
        currentH: widget.position.h,
        snapping: false,
      };
      resizeRef.current = info;
      setResize(info);
    },
    [isEditMode, visibleWidgets],
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
        const isResizing = resize?.widgetId === item.id;

        const renderLeft = isDragging
          ? (isSnappingBack ? left : drag.startLeft + drag.currentX)
          : left;
        const renderTop = isDragging
          ? (isSnappingBack ? top : drag.startTop + drag.currentY)
          : top;

        return (
          <div key={item.id}>
            {/* Ghost placeholder */}
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
                isEditMode && !isResizing && 'cursor-grab',
                isDragging && !isSnappingBack && 'cursor-grabbing z-50 shadow-2xl ring-2 ring-primary/40 scale-[1.02] opacity-90',
                isSnappingBack && 'z-50 transition-all duration-200 ease-out',
                !isDragging && !isResizing && 'transition-all duration-300 ease-in-out',
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

              {/* Resize handle – bottom-right corner in edit mode */}
              {isEditMode && (
                <div
                  className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-10 flex items-center justify-center rounded-tl-md bg-muted/80 hover:bg-primary/20 transition-colors"
                  onPointerDown={(e) => handleResizePointerDown(e, item.id)}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted-foreground">
                    <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DashboardGrid;
