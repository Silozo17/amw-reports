

## Fix Hero KPIs Visual Clarity + Upgrade Health Score Card

### Problem
The Hero KPI cards blend into the page background — the glassmorphism effect makes them look washed out and indistinguishable. The metric-specific visuals are too small and faint. The Health Score card is a plain white card with a basic SVG gauge.

### Changes

**File: `src/components/clients/dashboard/HeroKPIs.tsx`**

1. **Increase card contrast** — Replace the transparent glassmorphism with a solid white card background (`bg-card`) with a stronger left accent bar (w-1.5 instead of w-1). Add a subtle top gradient band in the accent color at ~5% opacity to give each card its own color identity without the washed-out glass look.

2. **Make metric visuals larger and bolder** — Increase size from 40/56px to 52/72px. Increase opacity from 0.5-0.6 to 0.7-0.85. Position them more prominently in the bottom-right corner.

3. **Stronger change badges** — Use solid background colors for the MoM change pills instead of transparent tints. Green pill for positive, red for negative, with white text.

4. **Remove the glassmorphism class** — Drop `kpi-card-glass` in favor of `bg-card` with a proper `shadow-sm` and `border border-border`. Cards should look like distinct, elevated objects — not transparent overlays.

5. **Keep 3D tilt + holographic overlay** — These are interactive effects that work well. Just ensure the card itself has enough contrast for the overlay to be visible.

**File: `src/components/clients/dashboard/HealthScore.tsx`**

1. **Premium card treatment** — Add a gradient background header strip with the score color. Use a larger gauge (w-40 h-40) with a thicker stroke and animated glow ring behind it.

2. **3D tilt effect** — Apply the same `useTilt` hook to make the Health Score card interactive on hover.

3. **Sub-score cards upgrade** — Replace the flat `bg-muted/30` boxes with mini progress bars showing the score as a horizontal fill. Add the accent color as a left border.

4. **Score label badge** — Display the label ("Excellent", "Good", etc.) as a colored pill badge below the gauge instead of tiny text inside it.

**File: `src/index.css`**

1. Remove `.kpi-card-glass` class (no longer needed).

### Layout stays the same
Featured 4 + Standard 8 grid is unchanged. Only the visual treatment of each card changes.

