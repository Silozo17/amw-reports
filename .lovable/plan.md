

# Fix Drop Animation Glitch

## Problem
On release, `drag` is set to `null` immediately, causing the widget to jump back to its old layout position before the new layout is committed. This creates a visible "snap back then re-animate" glitch.

## Root Cause
When `setDrag(null)` fires, the dragged widget loses its cursor-following position and falls back to the grid position from the previous layout. Then 180ms later `onLayoutChange` commits the new positions, causing a second jump.

## Fix

Change the drop flow to a two-phase approach:

### Phase 1: Snap to ghost (on pointerup)
- Instead of clearing `drag`, set a new flag `isSnapping = true` on the drag state
- When snapping, the dragged widget stops following the cursor and instead transitions smoothly to the ghost grid position (the dashed placeholder)
- Other widgets are already in their reflowed positions, so nothing else moves

### Phase 2: Commit (after transition)
- After ~200ms (matching the CSS transition), clear `drag` and call `onLayoutChange`
- Since the widget is already visually at the ghost position, there's zero visual jump

## Implementation — `DashboardGrid.tsx`

1. Add `snapping` boolean to `DragInfo` interface
2. In `handlePointerUp`: set `drag.snapping = true` + `setDrag({...d, snapping: true})` instead of `setDrag(null)`
3. In the render logic: when `isDragging && drag.snapping`, use the ghost grid pixel position (same as the placeholder) instead of cursor offset — and apply `transition-all duration-200 ease-out`
4. In the `setTimeout` callback (200ms): clear drag, commit layout — no visual jump since widget is already in position
5. Remove the separate `isSnapping` state (no longer needed, it's part of drag state now)

## Files Modified
1. `src/components/clients/widgets/DashboardGrid.tsx`

