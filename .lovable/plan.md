

## Fix: Add 30% Top Breathing Room to Trend Charts

**Problem**: With `v / max` normalization, the highest data point normalizes to exactly `1.0`, making lines touch the top of the chart. Need 30% headroom.

**Solution**: Change the Y-axis domain from `[0, 1]` to `[0, 1.3]` on all three trend charts. This gives 30% breathing room at the top while keeping the zero floor.

### Files to change

**1. `src/components/clients/dashboard/PerformanceOverview.tsx`**
- Line 239: `domain={[0, 1]}` → `domain={[0, 1.3]}`
- Line 343: `domain={[0, 1]}` → `domain={[0, 1.3]}`

**2. `src/components/clients/dashboard/PlatformSection.tsx`**
- Line 350: `domain={[0, 1]}` → `domain={[0, 1.3]}`

Three one-character edits. Nothing else changes.

