

## Plan: Redesign Landing Page — Login Left, AMW Hero Right

### What Changes

Swap the 50/50 layout: **login/signup forms on the left** (light background), **dark AMW-style hero on the right** matching the `amwmedia.co.uk` website design with the warped grid, star decorations, glowing orbs, and bold typography.

### Implementation

#### 1. Create `WarpedGrid` component (`src/components/landing/WarpedGrid.tsx`)

Port the `WarpedGrid` component from the AMW Media project. This renders the animated SVG grid background with mouse-tracking displacement. Use the `"dark"` variant with stroke color `hsl(32 44% 92% / 0.06)`. Simplified version — no CMS dependencies, just the core SVG animation logic.

#### 2. Create `StarDecoration` component (`src/components/landing/StarDecoration.tsx`)

Port the `StarDecoration` component — simple 8-pointed star SVG with optional spin animation. Supports purple, blue, green, orange, offwhite color variants.

#### 3. Add CSS animations (`src/index.css`)

Add `@keyframes star-spin` (slow 360deg rotation) and `animate-star-spin` utility, plus `animate-pulse-glow` for the background orbs. Also add `.text-gradient-purple` utility class for the gradient text effect.

#### 4. Redesign `LandingPage.tsx`

Restructure the layout:

**Left side (light, `bg-background`):** Login/signup/OTP forms — same functionality, just moved to the left panel. Mobile header stays for small screens.

**Right side (dark, `bg-sidebar-background`):** AMW hero section matching the website:
- `WarpedGrid` component as full background
- Glowing purple and blue orbs with blur (matching hero's `.bg-primary/10` and `.bg-secondary/10` blurred circles)
- `StarDecoration` elements scattered (purple top-right, blue mid-right, green bottom-left, orange mid-left, offwhite bottom-right)
- Bold headline: `AUTOMATED MARKETING REPORTS THAT` + `ELEVATE` (in gradient purple) + `YOUR AGENCY`
- Subtitle text explaining the product
- 4 feature cards in a 2x2 grid with dark card backgrounds (`bg-sidebar-accent/40 backdrop-blur-sm`)
- AMW branding top-left, copyright bottom-left
- Hidden on mobile (forms go full-width)

All auth logic (login, signup, OTP, org creation) remains identical — only the visual layout changes.

### Files

**New files:**
- `src/components/landing/WarpedGrid.tsx` — Ported from AMW project
- `src/components/landing/StarDecoration.tsx` — Ported from AMW project

**Modified files:**
- `src/pages/LandingPage.tsx` — Swap left/right panels, add hero components
- `src/index.css` — Add star-spin, pulse-glow keyframes, text-gradient-purple

