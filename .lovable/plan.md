

## Onboarding Redesign — Premium Overhaul

### Problems Identified
1. **Emojis** used for platform icons instead of the branded `.webp` logos already available in `PLATFORM_LOGOS` (from `src/types/database.ts`)
2. **Title text invisible** — heading colour blends into the light background (`sidebar-background` is a warm beige, and `sidebar-foreground` may be too similar or the `font-heading` is barely rendering)
3. **Cheap-looking selection cards** — thick `border-2` on every card with low-contrast fill creates a flat, budget feel
4. **No premium polish** — missing subtle depth, spacing, and visual hierarchy

### Design Direction
Replace the current flat-bordered grid with a glassmorphism/elevated card style:
- **No borders on unselected cards** — use subtle background + shadow instead
- **Selected state** — soft primary glow/shadow + slight scale, no thick border
- **Platform step** — swap all emojis for the actual `PLATFORM_LOGOS` images already in the codebase
- **Titles** — use `text-foreground` (dark) instead of `text-sidebar-foreground`, increase weight
- **Account type icons** — keep Lucide icons but render them in a softer, more premium container (no dark circle)

### Technical Changes

**File: `src/pages/OnboardingPage.tsx`**

1. **Import `PLATFORM_LOGOS` and `PLATFORM_LABELS`** from `@/types/database` — remove the local `PLATFORMS` array with emojis; build platform list from the existing constants instead

2. **Fix title visibility** — change `StepContainer` heading from `font-heading` (Anton, which may render poorly at this size on light backgrounds) to explicit dark colour classes: `text-foreground` with proper font weight

3. **Restyle all selection cards** (steps 1–5):
   - Unselected: `bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md` — no border
   - Selected: `bg-primary/8 shadow-lg shadow-primary/15 ring-1 ring-primary/30 scale-[1.02]` — subtle ring instead of thick border
   - Transition: `transition-all duration-300`

4. **Platform grid (step 2)**: Replace `<span className="text-2xl">{p.icon}</span>` with `<img src={PLATFORM_LOGOS[p.id]} className="h-8 w-8 object-contain" />`

5. **Account type cards (step 1)**: Remove dark circle around icons; use a lighter, more refined icon container

6. **Client count pills (step 3)**: Replace `border-2` with shadow-based styling, softer selected state

7. **Reason cards (step 4)** and **Referral cards (step 5)**: Same card restyle — drop borders, add depth

8. **Progress bar**: Make slightly thicker (h-1.5) with rounded ends for polish

9. **Ambient glow**: Increase opacity slightly so it's actually visible as a premium touch

