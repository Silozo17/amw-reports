# Content Lab — Crash, Mobile & Idea-Count Fixes

## Issues found

### 1. React error #310 on the run page (the "Something went wrong" screen)
`src/pages/content-lab/RunDetailPage.tsx` early-returns at line 160 (`if (!run) return ...`) **before** calling `useMemo` on lines 168 and 179. When the run loads, the hook order changes between renders → React error #310. This is the crash you saw.

### 2. Only 20 ideas saved instead of 30
- `content-lab-ideate` runs 3 parallel batches of 10 with `Promise.allSettled`. When one batch fails (rate limit / parse error), it is silently dropped and `INSERT` proceeds with only 20.
- `content-lab-run` then logs a **hardcoded** "Generated 30 ideas" message regardless of the real count (line 696), masking the failure.
- AI schema currently allows `minItems: 8, maxItems: 12` per batch — variance compounds the problem.

### 3. Mobile responsiveness — Content Lab
- `RunDetailPage` tabs (`Ideas / Your content / Local competitors / Viral`) overflow on a 402px viewport.
- `IdeaPhoneMockup` uses `lg:grid-cols-[280px_1fr]` (good) but the parent grid forces `lg:grid-cols-2` even on tablet portrait, and the phone frame has fixed `max-w-[280px]` that doesn't shrink centred on small screens — the right-hand breakdown becomes squashed under it on phones because nothing tells it to stack cleanly.
- Header on `RunDetailPage` puts the title + `UsageHeader` in `flex-wrap` — on mobile the credits pill ends up on a half-line. Needs to stack.
- Section labels & dialog widths inside `IdeaPhoneMockup` (Comments + Share dialogs) need mobile-safe widths.

### 4. Bonus issue spotted
`PostGrid` is rendered on RunDetailPage **without** passing `runId` (line 256, 272, 279) → "Save post" stores `source_run_id: null` for every saved post.

---

## Plan

### A. Fix the crash (Issue 1)
In `RunDetailPage.tsx`:
- Move both `useMemo` calls (`currentStepIndex`, `stepsWithBadges`) **above** the `if (!run) return …` early return.
- Compute their inputs defensively when `run` is `null` (treat as not-yet-processing).

### B. Fix the 30-idea generation (Issue 2)
In `supabase/functions/content-lab-ideate/index.ts`:
- Tighten schema to **exactly 10 per batch**: `minItems: 10, maxItems: 10`.
- Detect failed batches: if any of the 3 settle as `rejected`, retry **once sequentially** before giving up.
- Log per-batch outcome (`console.log` "[ideate] batch N → ok/failed: …") so we can see failures in function logs.
- Return `{ inserted: rows.length }` and surface a warning if `< 30`.

In `supabase/functions/content-lab-run/index.ts`:
- Replace the hardcoded `"Generated 30 ideas"` log with the actual `inserted` count returned by `content-lab-ideate`.

### C. Mobile responsiveness (Issue 3)
- **`RunDetailPage` header**: stack title + `UsageHeader` vertically on `<sm`, keep flex-row on `≥sm`.
- **Tabs**: wrap `<TabsList>` in a horizontal scroll container with `whitespace-nowrap` so all 4 tabs are reachable on 360px.
- **Ideas grid**: keep `grid-cols-1` on mobile/tablet, only switch to `lg:grid-cols-2` at `xl:` (≥1280px) so each card has room for the 2-column phone+breakdown layout.
- **`IdeaPhoneMockup`**:
  - On mobile, render phone full-width-but-capped (`max-w-[260px] mx-auto`) above the breakdown — already does via `lg:grid-cols-[280px_1fr]`, just verify spacing/padding shrinks (`p-3 md:p-5`).
  - Hooks list, script, caption sections use smaller text + tighter padding on mobile.
  - Comments and Share dialogs: `max-w-[calc(100vw-2rem)]` so they fit phones.
- **`PostGrid`**: already `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` — leave it but verify text sizes are legible at 320px.
- **`ContentLabPage`**: client cards already stack well; verify the "Your clients" row search input wraps under the heading on mobile (currently `ml-auto` keeps it on the same row → squashes the heading).

### D. Bonus fix (Issue 4)
Pass `runId={id}` to all three `<PostGrid>` instances on `RunDetailPage`.

---

## Files touched
- `src/pages/content-lab/RunDetailPage.tsx` — fix hook order, header stacking, tabs scroll, ideas grid breakpoints, pass `runId` to PostGrid.
- `src/components/content-lab/IdeaPhoneMockup.tsx` — mobile padding/typography, dialog max-widths.
- `src/pages/content-lab/ContentLabPage.tsx` — search row stacking on mobile.
- `supabase/functions/content-lab-ideate/index.ts` — exact-10 schema, retry on rejection, per-batch logging.
- `supabase/functions/content-lab-run/index.ts` — log real inserted count.

## Out of scope (will not touch unless asked)
- Hook Library, Trends, Saves pages — confirm responsiveness in a follow-up if you flag them.
- Visual redesign of the phone mockup itself.
- Changing AI model / prompt content.

Approve and I'll implement all five files in one pass.
