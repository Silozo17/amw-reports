

# Health Score Card — Reduce Tilt & Dynamic Sub-Score Colors

## Changes

### 1. Reduce tilt effect
In `src/components/clients/dashboard/HealthScore.tsx` line 111, change `useTilt(6)` to `useTilt(2)` and remove the `scale(1.02)` in the tilt hook by also reducing maxTilt default. Since 6 is passed explicitly, just changing to 2 is sufficient — the scale bump in `useTilt.ts` (line 29) should also be reduced from `1.02` to `1.005`.

### 2. Dynamic sub-score bar colors
Replace the 3-bucket `getScoreColor` function in `src/lib/healthScore.ts` (lines 268-272) with a smooth gradient interpolation from dark red (score ~0) through orange/yellow to green (score 100). This will affect both the sub-score progress bars and the circular gauge — all score-colored elements will use the continuous scale.

New `getScoreColor` implementation:
- Score 0: dark red `hsl(0, 80%, 40%)`
- Score 50: orange `hsl(30, 90%, 50%)`
- Score 75: yellow-green `hsl(60, 80%, 45%)`
- Score 100: green `hsl(120, 60%, 45%)`
- Interpolate linearly between these stops

### Files touched
- `src/hooks/useTilt.ts` — reduce scale from `1.02` to `1.005`
- `src/components/clients/dashboard/HealthScore.tsx` — change `useTilt(6)` → `useTilt(2)`
- `src/lib/healthScore.ts` — replace `getScoreColor` with smooth interpolation

