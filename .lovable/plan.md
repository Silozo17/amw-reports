

# Fluid Drag-and-Drop Grid Overhaul

## Problem
The current drag system moves the dragged widget with raw pixel offsets but other widgets stay frozen. On drop, the widget snaps to a grid cell but doesn't push neighbors out of the way. The result feels broken and unintuitive.

## Solution
Implement a **live-reflow** drag system where:
1. The dragged widget follows the cursor freely (pixel-perfect)
2. While dragging, a **ghost target position** is computed (snapped to grid)
3. All other widgets reflow around that ghost position in real-time with smooth CSS transitions
4. On release, the dragged widget animates into its final snapped position

## How It Works

```text
Before drag:        During drag:           After drop:
┌──┐┌──┐┌──┐       ┌──┐      ┌──┐        ┌──┐┌──┐┌──┐
│ A││ B││ C│       │ A│ [B]  │ C│        │ A││ C││ B│
└──┘└──┘└──┘       └──┘ ↑    └──┘        └──┘└──┘└──┘
                   floating   C shifts     B inserted,
                              left         C moved right
```

## Implementation — Single file rewrite: `DashboardGrid.tsx`

### 1. Track ghost grid position during drag
- As the user drags, continuously compute the nearest grid cell `(ghostX, ghostY)` from the cursor position
- Store this in a ref + state so the layout can react

### 2. Live reflow with collision resolution
- Replace the static `compactedLayout` with a **reactive layout** that takes an optional `(ghostWidgetId, ghostX, ghostY)` parameter
- The layout algorithm:
  1. Takes all widgets, replaces the dragged widget's position with the ghost position
  2. Sorts by `y` then `x`
  3. Runs vertical compaction (same as current) — this naturally pushes widgets down/aside
- This runs on every `pointermove` tick (debounced via `requestAnimationFrame`)

### 3. Smooth transitions on non-dragged widgets
- Non-dragged widgets get `transition: left 300ms ease, top 300ms ease` so they glide to new positions as the ghost moves
- The dragged widget has NO transition (follows cursor instantly)
- On drop, the dragged widget gets a brief `150ms` transition to snap into final position

### 4. Visual placeholder
- Render a subtle dashed-border placeholder at the ghost grid position showing where the widget will land
- This gives clear visual feedback

### 5. Drop and commit
- On `pointerup`, commit the ghost position as the widget's final position
- Run one final compaction pass and call `onLayoutChange` with the new layout

## Key Details
- **No new dependencies** — pure pointer events + CSS transitions
- **requestAnimationFrame** throttle on `pointermove` to keep reflow smooth (60fps)
- **Collision resolution**: when the ghost overlaps another widget, that widget shifts down (same compaction logic, just re-run with the ghost in place)
- Dragged widget renders at `z-index: 50` with shadow + slight scale for "picked up" feel
- All other widgets use `transition-all duration-300 ease-in-out` for fluid movement

## Files Modified
1. **`src/components/clients/widgets/DashboardGrid.tsx`** — full rewrite of drag logic and layout computation

