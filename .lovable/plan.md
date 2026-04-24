# Fix likes + new animated run progress stepper

Two scoped changes. Nothing else touched.

## 1. Fix likes (heart not moving ideas to the top)

**Root cause:** `IdeaPhoneMockup` writes to `content_lab_idea_reactions`, but the sort key on `RunDetailPage` is `content_lab_ideas.like_count`, which is never updated. So the heart toggles, the count under the heart updates (it counts rows from `reactions`), but the card never re-orders.

**Fix:**

- Add a Postgres trigger on `content_lab_idea_reactions` that keeps `content_lab_ideas.like_count` in sync (`+1` on insert, `-1` on delete, floored at 0). One-time backfill to set current counts.
- In `IdeaPhoneMockup.tsx`, after a successful like/unlike, also invalidate `['cl-run-ideas', runId]` so the parent re-sorts immediately (currently it only invalidates `['cl-run-ideas']` without the id, which doesn't match the parent's query key `['cl-run-ideas', id]`).
- Add an optimistic update on the reactions query so the heart fills instantly even on slow networks.

No schema changes beyond the trigger. No RLS changes — trigger runs as `SECURITY DEFINER`.

## 2. New `RunProgressStepper` component

Replace the current plain `<ol>` inside the "Working on your report…" card on `RunDetailPage` with a polished animated stepper matching the reference screenshot.

**File:** `src/components/content-lab/RunProgressStepper.tsx` (new, reusable, ~150 lines).

**Props:**
```ts
interface StepDef { label: string; detail: string; badge?: string }
interface Props {
  steps: StepDef[];
  currentStepIndex: number;        // -1 = not started, steps.length = done
  estimatedSeconds?: number;       // drives top progress bar (default 120)
  title?: string;                  // default "Generating your report"
}
```

**Layout:**
- Header row: purple circle (40px) with `Layers` icon, title `font-display`, subtitle `Estimated time: Nm Ns`.
- Thin progress bar (`h-1 bg-muted` with `bg-primary` fill) that fills smoothly over `estimatedSeconds` using a CSS transition on `width`.
- Vertical stepper with connector line (`absolute left-[19px] top-0 bottom-0 w-px bg-border`).

**Step states (no external libs):**
- **Completed:** `bg-emerald-500/15 text-emerald-500` circle with `Check` icon (`animate-scale-in`). Label `text-muted-foreground`. Badge below detail using existing `Badge variant="secondary"` (`animate-fade-in`).
- **Active:** `bg-primary/15 border border-primary text-primary` circle with `Loader2` (`animate-spin`). Detail uses `animate-pulse text-primary`.
- **Pending:** `bg-muted text-muted-foreground` circle showing the step number. Both label and detail muted.

**Entry animation:** Each step uses `animate-fade-in` with inline `style={{ animationDelay: `${i * 150}ms` }}`. Reuses existing `fade-in`, `scale-in` keyframes already in `tailwind.config.ts`.

**Driving the steps:**
- Component is **fully controlled** via `currentStepIndex`. No internal timer (the real run is async).
- `RunDetailPage` derives `currentStepIndex` from the `content_lab_run_progress` rows it already polls every 4s:
  - For each of the 7 UI phases, find the latest matching DB phase row.
  - `currentStepIndex` = count of rows with `status === 'ok'`.
  - Pass `steps[i].badge` only for completed steps (pull counts from `run.summary` JSON when available, fallback to generic).

**The 7 steps** (mapped to existing DB phases):

| # | Label | DB phase |
|---|-------|----------|
| 1 | Indexing your connected platforms | `discover` (own) |
| 2 | Mapping competitor landscape | `discover` (competitors) |
| 3 | Resolving competitor social profiles | `validate` |
| 4 | Extracting content performance signals | `scrape` |
| 5 | Detecting viral content patterns | `analyse` |
| 6 | Benchmarking against industry metrics | `analyse` (second pass) |
| 7 | Compiling strategic recommendations | `ideate` |

If the DB doesn't emit a distinct phase for #2 and #6, they piggyback on #1 and #5 with synthesised completion (counts from `run.summary`).

**Integration in `RunDetailPage.tsx`:**
- Replace the existing `isProcessing` `Card` block (~lines 172–188) with:
  ```tsx
  <RunProgressStepper
    steps={STEPS}
    currentStepIndex={derivedIndex}
    estimatedSeconds={120}
  />
  ```
- Keep the failed-run card as-is.

## Out of scope

- No changes to edge functions, scrape pipeline, or AI generation.
- No new tables. The trigger is the only DB change.
- The animated stepper does **not** simulate fake progress — it reflects real DB phase rows so users see truthful state.

## Files

- new: `src/components/content-lab/RunProgressStepper.tsx`
- new: `supabase/migrations/<timestamp>_idea_like_count_trigger.sql`
- edit: `src/components/content-lab/IdeaPhoneMockup.tsx` (invalidation key + optimistic update)
- edit: `src/pages/content-lab/RunDetailPage.tsx` (swap progress UI, derive `currentStepIndex`)

Ready to build?
