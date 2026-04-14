

## Make All KPI Cards Uniform Size

### Problem
The Hero KPIs use two tiers — "featured" (top 4, taller with larger text) and "standard" (remaining 8, shorter with smaller text). You want them all the same size.

### Changes

**File: `src/components/clients/dashboard/HeroKPIs.tsx`**

1. **Remove the featured/standard split** — render all KPIs in a single uniform grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4`).

2. **Pass `featured={false}` to all cards** (or remove the prop entirely) so every card uses the same sizing: same `min-h`, same text size (`text-xl sm:text-2xl`), same icon size, same tilt intensity, same metric visual size.

3. **Remove `FEATURED_COUNT` constant** and the `slice` logic that splits KPIs into two arrays.

4. **Keep sparklines on all cards** — currently only featured cards show the background sparkline. Either enable it for all or disable for all (recommend disable for cleaner uniform look).

