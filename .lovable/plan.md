

## Scope
You asked to try again with the existing key and without rotating anything. I’ll keep the current key untouched and fix the retry path so we can resume ideation from the already-scraped run data.

## What I found
There are two real problems in the current implementation:

1. `content-lab-ideate` hides the real Anthropic failure.
   - On any non-2xx response it logs the body and just returns `null`.
   - The caller then collapses that into the vague error: `Ideation produced no ideas`.
   - So we currently cannot tell if the issue is credits, model access, auth, workspace scoping, or something else.

2. The pipeline cannot safely “resume”.
   - `content-lab-pipeline` always deletes `content_lab_posts` and `content_lab_ideas` at the start.
   - So reusing an existing `run_id` through the pipeline would wipe the successful scrape data and force another scrape.
   - That is exactly what we want to avoid.

## Plan

### 1. Make ideate failures fully observable
Update `supabase/functions/content-lab-ideate/index.ts` so it returns structured upstream errors instead of `null`.

I’ll add:
- explicit handling for Anthropic `400`, `401`, `402`, `403`, `429`, `500`
- response body passthrough into the returned error
- logging of upstream request metadata like status and request id
- a non-sensitive runtime fingerprint log to verify the deployed function is reading the expected secret without exposing the secret itself

This gives us a definitive answer on the next retry instead of another generic failure.

### 2. Add a real “resume ideation” path
Create a dedicated backend path that reuses existing posts and does not call scrape.

Best approach:
- add a small function or extend `content-lab-pipeline` with `resume_from: "ideate"`
- when resuming:
  - do not delete `content_lab_posts`
  - optionally clear only previous ideas for that run
  - do not increment monthly usage
  - set run status back to `analysing` / `ideating`
  - call `content-lab-analyse` best-effort
  - call `content-lab-ideate`
  - mark run `completed` on success or `failed` with the exact upstream error on failure

This avoids another Apify spend and makes retries deterministic.

### 3. Stop using migrations for one-off run status changes
The last two migrations were operational data updates for a single run. That is not the right long-term pattern.

Instead, the new resume path should update:
- `content_lab_runs.status`
- `error_message`
- `completed_at`

from backend logic at runtime. This keeps migrations schema-only and prevents more one-off SQL patches for retries.

### 4. Add a retry button in the UI
Update `src/pages/content-lab/RunDetailPage.tsx` to show a retry action when:
- run status is `failed`
- posts already exist for the run

Button behavior:
- call the new resume path
- show a toast that retry started without a new scrape
- refresh run / ideas / posts queries
- keep the user on the run detail page so they can watch status change

This gives you a permanent, safe recovery flow for future ideation failures too.

### 5. Validate on the existing failed run
After implementation, I’ll test against run:
`e28d9af5-63b0-4a33-906c-90bdc57b9e18`

Validation checklist:
- confirm `content_lab_posts` count stays unchanged
- confirm no scrape function is called
- confirm usage is not incremented
- confirm exact Anthropic response is surfaced if it still fails
- if Anthropic succeeds, confirm ideas are inserted and run becomes `completed`

## Files to change
- `supabase/functions/content-lab-ideate/index.ts`
- `supabase/functions/content-lab-pipeline/index.ts` or new `supabase/functions/content-lab-resume/index.ts`
- `src/pages/content-lab/RunDetailPage.tsx`
- `src/hooks/useContentLab.ts` if needed for a retry mutation/helper

## Technical details
- Current blocker is not “scraping”; scrape already worked.
- Current blocker is poor failure handling plus lack of a resume path.
- The safest fix is not to retry the whole pipeline, because current pipeline startup clears posts.
- The resume path must be idempotent and must never charge usage or trigger scrape.
- Error reporting from Anthropic should be preserved all the way to `content_lab_runs.error_message` and step logs.

## Expected result
After this change, clicking retry on a failed run will:
- reuse the 73 existing posts
- skip Apify entirely
- either complete ideation successfully or show the exact Anthropic error instead of a misleading generic message

