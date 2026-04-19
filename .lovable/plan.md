

## Goal
Re-run ideate (and analyse) on the existing successful scrape data from run `e28d9af5-63b0-4a33-906c-90bdc57b9e18` without spending another Apify call.

## Why this is safe
That run already has 73 posts in `content_lab_posts` (15 own + 40 competitor + 18 benchmark). Scrape succeeded — only ideate failed (Claude 402 out of credits). Now that Claude is topped up, we just need to resume from the ideate step.

## Approach

Add a small "Retry ideate" path that skips scrape entirely and reuses existing posts:

1. **Reset the failed run's status** — flip `status` from `failed` back to `analysing`, clear `error_message`, keep `started_at` + posts intact.
2. **Call `content-lab-analyse`** for that `run_id` (best-effort, may already have summaries — it's idempotent).
3. **Call `content-lab-ideate`** for that `run_id` — this is the one that will now succeed with topped-up credits.
4. **Mark `completed`** on success.

Two ways to expose this — pick one:

### Option A — One-off: I trigger it directly via curl (no UI)
I call `content-lab-ideate` directly with the existing `run_id` using the edge function tool, then update the run row. Zero code changes. Fastest path to verify Claude works.

### Option B — Add a "Retry" button on failed runs (small UI change)
On `RunDetailPage`, when `status === 'failed'` and posts exist, show a "Retry ideation" button that calls a new tiny edge function `content-lab-resume` (or reuses `content-lab-pipeline` with a `resume_from: 'ideate'` flag). Doesn't charge a usage credit (already paid for the scrape).

**I recommend Option A right now** — it's the fastest verification that the Claude top-up worked. If it succeeds, we can then add Option B as a permanent affordance for future failed runs (saves money every time ideate hiccups).

## Files touched (Option A)
- None. Pure tool calls:
  1. Update `content_lab_runs` row → `status='analysing'`, `error_message=null`.
  2. `curl` `content-lab-ideate` with `{ run_id: 'e28d9af5...' }`.
  3. Verify ideas appear in `content_lab_ideas`.
  4. Mark run `completed`.

## Files touched (Option B — if you want it after A works)
- `supabase/functions/content-lab-pipeline/index.ts` — accept `resume_from: 'ideate'` to skip scrape + usage charge.
- `src/pages/content-lab/RunDetailPage.tsx` — "Retry ideation" button on failed runs that have posts.
- `src/hooks/useContentLab.ts` — expose a `retryIdeate(runId)` mutation.

## Risks
- If Claude still 402s, top-up didn't propagate yet — wait a few minutes and retry.
- If ideate produces 0 ideas (different error), we'll see the actual prompt/response failure cleanly in logs because scrape isn't masking it any more.

## Recommendation
Approve **Option A** — I'll trigger the resume directly, confirm Claude is working, and report back. Once verified, say the word and I'll add Option B as a permanent retry button.

