<final-text>Goal: make Content Lab reliably runnable again by removing the false frontend block, hardening the async pipeline, and breaking ideation into timeout-safe units.

What is blocking runs right now
1. The Content Lab page disables “Run report now” when the shared benchmark pool has fewer than 5 verified accounts.
   - File: `src/pages/content-lab/ContentLabPage.tsx`
   - Current logic in `NicheCard`: `disabled={isRunning || blocked}` where `blocked = !!pool && !canRun`
   - This is the direct reason the buttons are disabled in the preview.
2. That gate is wrong for this codebase.
   - File: `supabase/functions/content-lab-scrape/index.ts`
   - Scraping already falls back to `top_global_benchmarks` saved on the niche when the shared benchmark pool is empty.
   - So backend can run without a verified pool, but the frontend prevents it.
3. The pool builder is unreliable and currently failing.
   - File: `supabase/functions/content-lab-pool-refresh/index.ts`
   - Current AMW Media job for the B2B niche failed with `function timeout — verification too slow`.
   - The niche has `verified_pool_count = 0`, which keeps the UI permanently blocked.
4. The run orchestrators are not protected as true background jobs.
   - Files: `supabase/functions/content-lab-pipeline/index.ts`, `supabase/functions/content-lab-resume/index.ts`
   - They start async work and return immediately, but do not use `EdgeRuntime.waitUntil`.
   - This matches the stuck run pattern already seen in step logs: a run entered ideation, one platform step started, then never finished.
5. Multi-platform ideation is too timeout-prone.
   - File: `supabase/functions/content-lab-ideate/index.ts`
   - A single call generates ideas for all selected platforms in sequence with large AI payloads.
   - The stuck B2B run shows Instagram ideation completed, then TikTok ideation started and never finished.

Implementation plan
1. Remove the false “pool must be ready before running” gate
   - Update `src/pages/content-lab/ContentLabPage.tsx`
   - Keep the benchmark quality badge and tooltip as informational only.
   - Allow runs whenever:
     - the org is not blocked by monthly usage + zero credits
     - the niche has enough configured handles to scrape
   - Replace the disabled pool state with soft messaging like “Benchmarks are still building; this run will use saved niche benchmarks for now.”

2. Keep run eligibility aligned with actual backend rules
   - Add a small helper so the button only disables for real blockers:
     - currently running
     - no handles configured
     - monthly exhausted and no credits
   - Do not use `useBenchmarkPoolStatus().canRun` as a hard gate anymore.

3. Harden async orchestration properly
   - Update `supabase/functions/content-lab-pipeline/index.ts`
   - Update `supabase/functions/content-lab-resume/index.ts`
   - Move background execution to `EdgeRuntime.waitUntil(...)`
   - Return `202 Accepted` immediately once the run/job is queued
   - Keep status writes explicit at every stage so the UI can poll safely

4. Split ideation into timeout-safe units
   - Refactor `supabase/functions/content-lab-ideate/index.ts`
   - Best approach: support running ideation for one platform at a time, then have pipeline/resume invoke it once per selected platform
   - Result:
     - Instagram / TikTok / Facebook ideation become separate bounded calls
     - one slow platform cannot strand the whole run in `ideating`
     - step logs remain precise per platform

5. Add stale-run recovery
   - In pipeline/resume flow, mark runs as failed if a step crashes or exceeds a sane threshold
   - Ensure unfinished `started` step logs are closed when a run is force-failed
   - This prevents another “ideating forever” state

6. Make pool refresh non-blocking instead of silently broken
   - Keep `content-lab-pool-refresh` as a background enrichment process, not a prerequisite to run reports
   - Reduce work per refresh so it completes more reliably:
     - lower candidate/sample volume
     - avoid expensive over-sampling when not needed
   - Optionally update niche-level status when refresh jobs fail/succeed so the UI can explain what happened

7. Clean up related UI/debugging issues while touching Content Lab
   - Fix the tooltip ref warning in `src/components/content-lab/BenchmarkQualityBadge.tsx`
   - Wrap the badge trigger in a real DOM element so Radix can attach refs correctly

Files to change
- `src/pages/content-lab/ContentLabPage.tsx`
- `src/components/content-lab/BenchmarkQualityBadge.tsx`
- `supabase/functions/content-lab-pipeline/index.ts`
- `supabase/functions/content-lab-resume/index.ts`
- `supabase/functions/content-lab-ideate/index.ts`
- `supabase/functions/content-lab-pool-refresh/index.ts`

Data/runtime cleanup after code changes
- Reset any currently stuck active run older than the timeout threshold to `failed`
- Re-run the affected B2B niche after deploy to confirm:
  - the button is enabled
  - the run transitions through statuses
  - ideas are generated for all selected platforms
- Pool refresh can remain failed temporarily without blocking report generation

Expected result
- “Run report now” becomes clickable again for AMW Media niches
- Empty or failed benchmark pools no longer stop report generation
- Multi-platform runs stop getting stranded in `ideating`
- Background run processing becomes reliable and status-driven
- Pool refresh becomes helpful enrichment, not a hard dependency

Technical notes
- The current frontend hard gate and the current backend scrape fallback contradict each other; fixing that mismatch is the highest-priority unblocker.
- The step-log evidence strongly suggests background task shutdown during ideation, so `EdgeRuntime.waitUntil` is required on the orchestrators.
- Splitting ideation per platform is the safest way to stay under function time limits without weakening output quality.</final-text>