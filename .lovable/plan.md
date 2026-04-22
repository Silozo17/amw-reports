
Fix scope: Content Lab run orchestration, Content Lab data visibility, and viral-feed data quality. No redesign, no billing/product changes, no new user-facing features.

## Root causes found

### 1) Runs can still “complete” partially or die without self-recovery
Files:
- `supabase/functions/content-lab-pipeline/index.ts`
- `supabase/functions/content-lab-step-runner/index.ts`
- `supabase/functions/content-lab-resume/index.ts`
- `supabase/functions/content-lab-analyse/index.ts`
- `supabase/functions/content-lab-ideate/index.ts`

Actual defects:
- `content-lab-step-runner` finalises a run if **any ideas exist**, even when one or more target platforms failed (`failed_ideate_platforms` is written, then the run can still become `completed`).
- `analyse` is explicitly non-fatal, so runs can continue with degraded output instead of a true recovered completion.
- `chainNext` can exhaust retries, leave a breadcrumb, and then rely on the stale reaper to fail the run later.
- `content-lab-pipeline` stale reaper force-fails active runs after 20 minutes instead of resuming the same run.
- usage charging happens in `runScrapeStep`; retries/rescrapes can hit the same run again unless billing state is made idempotent per run.

### 2) Users can lose visibility of their own content because frontend scope readiness is wrong
Files:
- `src/hooks/useAuth.tsx`
- `src/contexts/OrgContext.tsx`
- `src/hooks/useContentLab.ts`
- `src/hooks/useContentLabAccess.ts`
- `src/components/content-lab/PatternInsightsWidget.tsx`
- Content Lab pages using those hooks

Actual defects:
- `useAuth` sets `isLoading=false` before profile / role / client-user resolution finishes.
- `OrgProvider` only resolves org membership from `org_members`; client-scoped users do not populate that path.
- Content Lab hooks are gated on `orgId` only. When auth/org resolution lags, queries stay disabled or render false negatives.
- Pages interpret “not loaded yet” as “no access” and can show paywalls / empty states before scope is ready.

### 3) Viral feed can contain junk rows that render as “empty”
Files:
- `supabase/functions/content-lab-scrape/index.ts`
- `src/pages/content-lab/RunDetailPage.tsx`
- `src/components/content-lab/ViralPostCard.tsx`

Actual defects:
- scrape inserts posts even when they have almost no usable presentation data.
- feed rendering accepts rows with missing media + missing caption + missing link + zero signal, so cards can look blank/useless.
- there is no server-side “minimum viable feed row” filter and no client-side fallback filter.

## Implementation plan

### A) Make every run self-healing and only complete when truly complete
1. Replace “partial success is fine” logic in `content-lab-step-runner` with strict completion rules:
   - do not finalise if any required platform is still missing
   - do not finalise if expected wildcard generation is missing
   - do not finalise if ideation count for a target platform is below target
2. Change ideation failure handling:
   - retry the same platform internally with bounded attempt counts
   - keep the run in active recovery instead of marking platform failed and moving on
3. Change analyse handling:
   - retry first
   - if retries still fail, write a deterministic fallback analysis payload so ideation still has structured input
   - no more silent degraded “analyse failed but continue blindly”
4. Change stale-run handling in `content-lab-pipeline`:
   - stale active runs are resumed/recovered first
   - only become terminally failed after bounded automated recovery attempts
5. Make chaining durable:
   - if `chainNext` exhausts retries, persist recovery metadata on the run and re-dispatch the same run instead of leaving it to die
6. Make charging idempotent per run:
   - store a run-level “usage already consumed” marker
   - retries/resumes on the same run must never consume usage or credits again

### B) Fix auth/scope readiness so users can always see their own content
1. Harden `useAuth.tsx`:
   - separate session restoration from profile/client-user resolution
   - keep auth-dependent UI in loading until identity scope is fully resolved
2. Add one shared “content scope” source:
   - org members use `orgId`
   - client-scoped users use `clientUserInfo.org_id`
   - nothing renders access-denied until that scope is ready
3. Update these hooks to use the shared ready scope instead of raw `orgId`:
   - `useContentLabAccess`
   - `useContentLabNiches`
   - `useContentLabRuns`
   - `useAllIdeas`
   - any other org-scoped Content Lab hook/widget using `useOrg()` directly
4. Update Content Lab pages/widgets so loading stays loading:
   - no paywall
   - no “empty library”
   - no “no content”
   until scope resolution has finished

### C) Clean the viral feed at both ingestion and rendering layers
1. In `content-lab-scrape/index.ts`, normalize and filter inserted posts:
   - reject rows that have no usable display signal
   - require at least one meaningful content field set
   - drop placeholder/unknown handles where the row has no other usable data
   - preserve strong posts even if one field is missing
2. In `RunDetailPage.tsx`, derive `viralPosts` from a stricter “renderable post” filter so dead rows never appear in the feed tab
3. In `ViralPostCard.tsx`, add robust fallbacks so a sparse row never renders as an empty shell

## Files to change
- `supabase/functions/content-lab-pipeline/index.ts`
- `supabase/functions/content-lab-step-runner/index.ts`
- `supabase/functions/content-lab-resume/index.ts`
- `supabase/functions/content-lab-analyse/index.ts`
- `supabase/functions/content-lab-ideate/index.ts`
- `src/hooks/useAuth.tsx`
- `src/contexts/OrgContext.tsx`
- `src/hooks/useContentLab.ts`
- `src/hooks/useContentLabAccess.ts`
- `src/components/content-lab/PatternInsightsWidget.tsx`
- `src/pages/content-lab/RunDetailPage.tsx`
- `src/components/content-lab/ViralPostCard.tsx`
- any additional Content Lab page/hook still using raw `orgId` gating after audit

## Verification standard
A fix is only done when all of these are true:
- starting one run results in one self-recovering run, not a manual second run
- a run never ends `completed` with missing target platforms or missing wildcards
- retries/resumes do not double-charge the same run
- stale runs auto-recover before becoming terminal
- valid users do not see false paywalls or false empty states while scope resolves
- users can consistently see their own Content Lab data after login / refresh
- viral feed contains only renderable posts and no blank cards

## Deliverable
One reliability pass that turns Content Lab into a self-healing pipeline, removes false access loss caused by auth/scope races, and sanitizes viral-feed data so users stop seeing empty content.
