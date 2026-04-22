

## Issues found in the latest Wheels VT run (`8a5efa95…b5cb`)

The run **completed and produced 12 ideas**, but the step logs show three real defects that degraded quality:

1. **`analyse` step crashed with a 504 idle timeout (150s).** Marked "non-fatal — pipeline continued", so the run kept going **without the analysis output**. That's why downstream ideation has no pattern/insight grounding for this niche.
2. **Facebook ideation hit a 504 idle timeout (150s) on the first attempt** before a retry succeeded. The retry worked, so 4 facebook ideas exist, but the function is running right at the edge of its limit.
3. **Wildcard ideas were never created.** Ideate function logs: `wildcard generation failed (non-fatal): ReferenceError: generateWildcards is not defined`. The pipeline calls `generateWildcards(...)` at line 227 of `content-lab-ideate/index.ts`, but the function is **not defined anywhere in that file** — it was referenced but never implemented (or was deleted). Result: 0 wildcards, instead of the 2 trend-setting ideas the spec promises. The run UI will show "12 ideas, 0 wildcards" forever.
4. **Completion email never sent.** `send-branded-email` returned `400 {"error":"Unknown template: content_lab_run_complete"}` because the `TEMPLATES` registry in `send-branded-email/index.ts` does **not** include a `content_lab_run_complete` builder. The notify function still recorded "send failed" and the user got no email when their run finished.

## Fixes (scoped to this run's actual defects, no broader refactor)

### 1) Implement the missing `generateWildcards` function — `supabase/functions/content-lab-ideate/index.ts`
- Add a real `generateWildcards({ niche, brandBrief, platform, count })` that calls the same Lovable AI gateway used by the main ideation path.
- Returns `{ ok: true, ideas: [...] }` shaped like the existing idea objects so the existing `toRow(...)` mapper at line 237 keeps working.
- Two ideas, `is_wildcard = true`, `based_on_post_id = null` (already enforced by the caller).
- Wrap in try/catch so a wildcard failure stays non-fatal (preserve current behaviour).

### 2) Register the missing email template — `supabase/functions/send-branded-email/index.ts`
- Add a `content_lab_run_complete` template builder following the same pattern as `report_delivery` and `monthly_digest`.
- Inputs from `notify-complete` already provide: `niche_label`, `idea_count`, `report_url`, `recipient_name`.
- Add it to the `TEMPLATES` map at line 571.
- Subject line: `"Your Content Lab report for {niche_label} is ready"`.
- Body: short branded HTML with the niche label, idea count, and a CTA button to `report_url`. Uses the same shared header/footer as the other branded templates so org branding still applies.

### 3) Stop the `analyse` and `ideate` 504 idle timeouts from silently degrading runs
The 150s idle timeout is the edge-runtime ceiling, so we cannot extend it. Two surgical mitigations:
- **`content-lab-analyse/index.ts`**: cap the model `max_tokens` to keep streaming under the limit, and add a short "analysis unavailable" fallback object so downstream ideation has *something* (currently the ideate step receives nothing when analyse times out).
- **`content-lab-ideate/index.ts`**: lower the per-platform prompt size (the Facebook attempt timed out because the prompt grew with 28 scraped posts) by capping examples to the top 8 benchmark posts per platform before calling the model. This is a one-line `.slice(0, 8)` change in the prompt builder and matches what the Instagram + TikTok paths already effectively get.

No retry-loop changes — the existing retry path is fine, we just want the first attempt to fit inside the budget.

### 4) Backfill the current Wheels VT run (one-off, no code)
After the code fixes deploy, run a single targeted re-trigger to:
- generate the 2 missing wildcards for run `8a5efa95-45e3-44a2-9716-00f86277b5cb`,
- send the completion email to the run owner.

Done as a one-off `psql` + edge-function invoke, not a UI feature.

## Files changed
1. `supabase/functions/content-lab-ideate/index.ts` — implement `generateWildcards`, cap benchmark examples to 8.
2. `supabase/functions/content-lab-analyse/index.ts` — cap `max_tokens`, return safe fallback on timeout.
3. `supabase/functions/send-branded-email/index.ts` — add `content_lab_run_complete` template + register in `TEMPLATES`.
4. One-off backfill (no source change): re-invoke wildcard generation + notify-complete for this run id.

## Out of scope
- No DB migrations.
- No UI changes.
- No changes to the credit/refund flow (the run completed and was billed correctly).
- No new languages / no scrape-source changes.
- The `Http: connection closed before message completed` warning in the ideate logs is a benign client disconnect after the response was already sent — not fixed here.

## Verification after merge
- Trigger a fresh Wheels VT run → step logs show `analyse: ok`, all three platforms `ideate: ok`, **and** a new `wildcards: ok` line; the run row ends with 14 ideas (12 + 2 wildcards).
- The owner receives a branded "Your Content Lab report is ready" email with a working CTA to the run page.
- Re-run on a heavy niche (28+ scraped posts) → no 504 on the first attempt for `analyse` or `ideate`.

