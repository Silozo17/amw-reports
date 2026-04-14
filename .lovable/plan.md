

## Redesign Hero KPI Cards: 3D, Glassmorphism, Metric-Specific Visuals + Featured Layout

### Overview

Transform the 12 Hero KPI cards from identical flat rectangles into dynamic, interactive cards with:
- **3D mouse-tilt** with holographic light reflection
- **Glassmorphism** with per-metric colored glow halos
- **Metric-specific visuals** (stars for rating, gauge for spend, growth ring for followers, etc.)
- **Featured + Standard layout** — top 4 cards are larger, remaining 8 are compact

### Layout

```text
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   TOTAL SPEND    │ │   VIDEO VIEWS    │ │      REACH       │ │     CLICKS       │
│   (Featured)     │ │   (Featured)     │ │   (Featured)     │ │   (Featured)     │
│   Larger card    │ │   Larger card    │ │   Larger card    │ │   Larger card    │
│   with gauge     │ │   with bars      │ │   with rings     │ │   with arrow     │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Engagement│ │Followers │ │Posts Pub. │ │Avg Rating│ │  Leads   │ │Page Views│ │Phone Call│ │Web Clicks│
│(Standard)│ │(Standard)│ │(Standard)│ │(Standard)│ │(Standard)│ │(Standard)│ │(Standard)│ │(Standard)│
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Changes

**File: `src/components/clients/dashboard/HeroKPIs.tsx`** (major rewrite)

1. **3D Tilt Hook** — new inline `useTilt` hook that tracks mouse position relative to card, applies `perspective(800px) rotateX(Ydeg) rotateY(Xdeg)` via `onMouseMove` / `onMouseLeave`. Tilt intensity: ~8deg for featured, ~5deg for standard. Includes a moving light reflection overlay (`radial-gradient` at cursor position).

2. **Glassmorphism Base** — replace `Card` with a custom div using `backdrop-blur-xl bg-white/5 dark:bg-white/5 border border-white/10`. Each card gets a colored glow halo behind it using `box-shadow` with the metric's accent color at low opacity, pulsing gently via CSS animation.

3. **Metric-Specific Visuals** — a `MetricVisual` sub-component renders a unique decorative element per metric type:
   - **Spend** — animated semi-circular gauge arc (SVG) filling to proportional value
   - **Video Views** — small animated bar chart (3 bars at staggered heights)
   - **Reach** — concentric expanding rings (CSS animation)
   - **Clicks** — animated upward arrow with trail
   - **Engagement** — pulsing heart/chat icon
   - **Followers** — growth ring (SVG circle with stroke-dashoffset animation)
   - **Posts Published** — small calendar grid dots
   - **Avg. Rating** — animated gold stars (5 stars, filled proportionally)
   - **Leads** — target/bullseye icon with pulse
   - **Page Views** — mini sparkline rendered inline
   - **Phone Calls** — ringing phone icon with vibration animation
   - **Website Clicks** — cursor click animation

4. **Featured vs Standard sizing** — first 4 KPIs render in `lg:col-span-1` within a 4-col grid (taller cards, larger text `text-3xl sm:text-4xl`). Remaining 8 render in a separate 4-col grid below (compact cards, `text-xl sm:text-2xl`). Featured cards include the sparkline background; standard cards omit it for density.

5. **CSS additions in `index.css`**:
   - `@keyframes glow-pulse` — subtle box-shadow pulse
   - `@keyframes ring-expand` — for reach rings
   - `@keyframes phone-vibrate` — shake animation for phone icon
   - `.kpi-card-glass` utility class for the glassmorphism base

**File: `src/hooks/useTilt.ts`** (new file)
- Custom hook returning `ref`, `style`, and `overlayStyle`
- Uses `onMouseMove` to calculate rotation angles from cursor position relative to card center
- Returns to neutral on `onMouseLeave` with a smooth CSS transition
- Accepts `maxTilt` parameter (8 for featured, 5 for standard)

**File: `tailwind.config.ts`**
- Add `glow-pulse`, `ring-expand`, `phone-vibrate` keyframes and animation entries

### Technical Notes

- No external 3D library needed — pure CSS `transform: perspective() rotateX() rotateY()` with a React ref
- Glassmorphism uses `backdrop-filter: blur()` which is well-supported in modern browsers
- Metric visuals are lightweight SVG/CSS — no canvas or heavy rendering
- All animations use `will-change: transform` for GPU acceleration
- Mobile: tilt disabled (no hover), cards stack single-column, animations reduced via `prefers-reduced-motion`
- The sparkline background chart remains on featured cards only

