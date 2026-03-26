
Research-backed diagnosis and proposed fix for the onboarding:

1. What the investigation found
- The core visibility bug is not isolated to one step. The page background is `bg-sidebar-background`, which is a very dark token in the design system, while your screenshots show a light beige surface. That means the onboarding is inheriting brand/theme overrides in a way the current color choices are not resilient to.
- The implementation still uses `text-sidebar-foreground` and `bg-sidebar-accent/*` throughout nearly every step. Those tokens are meant for dark sidebar surfaces, not a light full-screen onboarding canvas.
- Step 6 is still explicitly wrong in code: its title, body copy, secondary button, and shared `StepContainer` headings all still use sidebar colors.
- The existing redesign was cosmetic only. It changed card styling, but not the underlying color architecture, hierarchy, or onboarding flow quality.

2. Research conclusions driving the redesign
Based on NN/g guidance and onboarding UX references:
- Good onboarding should minimize cognitive load, use one clear task per step, and create strong visual hierarchy.
- Tutorials and decorative onboarding are weak if they front-load information; setup screens are justified only when collecting data needed to personalize the first-run experience.
- Users need clarity, transparency, and confidence: clear heading contrast, obvious progress, minimal choices per screen, and reassurance about what happens next.
- Premium onboarding is not about more effects. It is about legibility, calm pacing, polished spacing, meaningful imagery, and stronger trust cues.

3. Root causes in the current implementation
- Wrong token family: onboarding is built with sidebar tokens instead of page/card tokens.
- No contrast-safe layer system: text, cards, icons, buttons, and helper copy all rely on theme-dependent colors that can collapse on branded/light backgrounds.
- Typography is too weak for this use case: headings are not getting the premium/readable treatment your own design standards call for.
- The layout lacks an intentional shell: there is no dedicated onboarding surface, hero framing, step label, or contextual support to make it feel premium.
- The final step is visually disconnected from the rest and still unresolved.

4. Proposed implementation approach
Single-file overhaul in `src/pages/OnboardingPage.tsx`, but as a full system pass rather than isolated tweaks:

A. Rebuild the visual foundation
- Stop using `sidebar-*` tokens for onboarding surfaces and content.
- Use a dedicated light premium canvas based on `background`, `foreground`, `card`, `muted`, `border`, `primary`, and `secondary`.
- Add a centered onboarding shell:
  - outer full-screen ambient background
  - inner elevated panel/card for each step
  - consistent max width and vertical rhythm
- Keep the premium glow, but subordinate it to readability.

B. Rework typography and hierarchy
- Use readable body/display treatment consistent with project standards:
  - section eyebrow for step count
  - large readable heading with dark foreground
  - supportive subtitle with muted foreground
- Avoid relying on uppercase Anton-style treatment for these step headings.
- Make all heading and helper text contrast-safe regardless of brand overrides.

C. Redesign every selection pattern
- Replace the current “cheap tile” feel with structured cards:
  - card background
  - subtle border
  - soft shadow
  - stronger hover elevation
  - selected state using tinted surface + restrained ring + icon badge accent
- Keep logos where available, Lucide where not, but normalize them in shared icon containers.
- Increase spacing, label hierarchy, and card height consistency across steps 1, 2, 4, and 5.
- Rework client-count chips into premium segmented pills with clearer active state.

D. Improve step flow quality
- Add a proper step header with:
  - “Step X of Y”
  - short rationale for the question
  - consistent progress bar inside the shell
- Tighten copy so each step feels purposeful, not generic.
- Keep branching for agency users, but make step progression feel deliberate.

E. Fully redesign the last step
- Replace the current weak welcome state with a proper completion screen:
  - visible heading and body copy
  - strong next-step framing
  - two clear actions with differentiated hierarchy
  - optional short bullet summary of what happens next
- Remove any remaining low-contrast button/text combinations.
- Keep subtle celebratory motion, but not gimmicky/confetti-heavy.

F. Make the screen resilient to org branding
- Ensure onboarding does not break when organisation fonts/colors are applied globally by `BrandingProvider`.
- Use explicit classes for text readability and avoid brand-driven heading styles where they reduce legibility.
- If needed, locally constrain onboarding typography so organisation branding does not degrade first-run UX.

5. Concrete file changes
- `src/pages/OnboardingPage.tsx`
  - replace sidebar token usage throughout
  - introduce shared style constants/helpers for step shell and selectable cards
  - redesign `StepContainer`
  - redesign `StepActions`
  - rebuild step 6 completion state
  - normalize platform/logo rendering and icon containers
  - improve copy hierarchy and spacing

6. What this will fix
- All invisible/low-contrast headings and body text across every step
- The still-broken final step
- Cheap selection card styling
- Inconsistent premium feel
- Fragility caused by global brand token/font overrides

7. Expected outcome
The onboarding will feel like a premium guided setup: calm, legible, brand-aligned, and deliberate. It will also be structurally safer, because colors and typography will no longer depend on sidebar tokens that are inappropriate for this screen.
