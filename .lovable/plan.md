

## Plan: Fix Landing Page — Match AMW Media Website Design

### Problem
The right hero panel is rendering with a light/offwhite background instead of the dark AMW black. The typography, layout, and visual effects don't match the AMW website. The Slowdex accent font is missing entirely. The `text-gradient-purple` utility uses hardcoded HSL values instead of CSS variables.

### Changes

#### 1. Copy Slowdex font from AMW project
- Copy `public/fonts/Slowdex.otf` to this project

#### 2. Update `src/index.css`
- Add `@font-face` for Slowdex (loaded from `/fonts/Slowdex.otf`)
- Fix `text-gradient-purple` to use CSS variables: `hsl(var(--amw-purple))` and `hsl(var(--amw-blue))`
- Add AMW extended CSS variables (`--amw-offwhite`, `--amw-black`, `--amw-purple`, `--amw-blue`, `--amw-green`, `--amw-orange`) matching the AMW website values
- Add `animate-fade-up-in` and `animate-hero-grow-in` keyframes from the AMW project
- Update headings rule to `font-heading uppercase` to match AMW site

#### 3. Update `tailwind.config.ts`
- Add `font-heading` (Anton), `font-accent` (Slowdex) alongside existing `font-display` and `font-body`
- Add `amw` color palette (`amw.offwhite`, `amw.black`, `amw.purple`, `amw.blue`, `amw.green`, `amw.orange`)

#### 4. Redesign `src/pages/LandingPage.tsx`
- **Right panel**: Use explicit dark background `bg-[hsl(340,7%,13%)]` (the AMW black) with inline style as a fallback to ensure it renders dark regardless of CSS variable issues
- Add Slowdex accent text "We Are AMW Media" with blinking cursor, matching the website hero
- Increase headline size to `text-5xl xl:text-7xl` with proper `leading-[0.95]` and uppercase
- Fix the hero content layout to vertically center with proper spacing (matching AMW hero's grid layout)
- Keep feature cards but style them to match the dark panel properly

#### 5. Copy mascot SVG from AMW project
- Copy `src/assets/mascot.svg` — the purple astronaut illustration used on the AMW website hero
- Display it on the right panel for visual impact (hidden on smaller screens within the right panel)

### Files

**New files (copied from AMW project):**
- `public/fonts/Slowdex.otf`
- `src/assets/mascot.svg`

**Modified files:**
- `src/index.css` — Slowdex font-face, AMW CSS variables, fixed gradients, new animations
- `tailwind.config.ts` — font-heading, font-accent, amw colors
- `src/pages/LandingPage.tsx` — Proper dark hero, accent text, larger typography, mascot
- `src/components/landing/StarDecoration.tsx` — No changes needed (already correct)
- `src/components/landing/WarpedGrid.tsx` — No changes needed (already correct)

