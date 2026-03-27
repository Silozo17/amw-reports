

## Fix: Trend Chart Y-Axis Floor at Zero

**Problem**: The normalization formula `(val - min) / (max - min)` maps the lowest data point to 0 on the Y-axis, making lines touch the bottom even when the actual value is far from zero.

**Solution**: Change the normalization to always use 0 as the minimum: `val / max` instead of `(val - min) / (max - min)`. This ensures lines only touch the bottom when the data is actually 0.

### Files to change

**1. `src/components/clients/dashboard/PerformanceOverview.tsx`** — Two normalization blocks:
- Line ~85: Change `max === min ? 0.5 : (v - min) / (max - min)` → `max === 0 ? 0 : v / max`
- Line ~290: Same change for the GSC chart normalization

Also update the range calculation to only track `max` (no need for `min` anymore), or simply keep the existing range objects but ignore `min` in the normalization formula.

**2. `src/components/clients/dashboard/PlatformSection.tsx`** — One normalization block:
- Line ~307: Change `range === 0 ? 0.5 : (val - min) / range` → `max === 0 ? 0 : val / max`

**3. Y-axis domain stays `[0, 1]`** — no change needed there since the normalized values will still be in the 0–1 range, just with a true zero floor.

Three surgical edits, no other changes.

