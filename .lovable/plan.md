

## Plan: Fix AMW Media Content Lab — three issues

### Issue 1: Stuck "ideating" run (highest priority)
Run `8135cb90-7b56-4c5c-a28b-ba096087d194` (B2B Creative & Video Production Agency for UK SMEs) has been in `ideating` status for ~19 hours. The pipeline's async ideate call clearly died but the status was never updated to `failed`.

**Fix**: Mark the run as `failed` with a clear error message so the user can re-run it. Pure data update.

```sql
UPDATE content_lab_runs
SET status = 'failed',
    error_message = 'Ideate step timed out and was reset by admin. Please re-run.',
    completed_at = now(),
    updated_at = now()
WHERE id = '8135cb90-7b56-4c5c-a28b-ba096087d194';
```

### Issue 2: AMW Media has no `content_lab_tier` set
The badge shows "3 / 1 runs" because `org_subscriptions.content_lab_tier` is NULL → frontend defaults to `creator` tier (1 run/month). With 1M admin credits this doesn't actually block runs (backend correctly allows credit-funded runs over the limit), but the UI looks broken.

**Fix**: Set AMW Media to `agency` tier (10 runs/month — matches admin status). Ledger entry not needed since this is a tier/plan change, not a credit grant.

```sql
UPDATE org_subscriptions
SET content_lab_tier = 'agency',
    updated_at = now()
WHERE org_id = '319ab519-4f9a-470f-b9f7-9d98e90f6d2f';
```

After this, the badge will read "3 / 10 runs · 1000000 credits".

### Issue 3: Verify nothing else is blocking
After both updates, the user should be able to click "Run report now" on any niche. The frontend `blocked` flag requires both `monthlyExhausted` AND `noCredits = true` — with 1M credits, credits never run out, so blocking is impossible at the page level. The pipeline backend matches this logic.

**No code changes** — both issues are pure data fixes in already-existing tables. No schema, no edge functions, no UI.

### Files touched
None.

### Side effects / risks
- Setting `content_lab_tier = 'agency'` on AMW Media gives all org members agency-tier behaviour platform-wide for Content Lab (10 runs/month allowance). This is correct for the admin org.
- Marking the stuck run as `failed` is safe — even if the ideate edge function eventually completes, the worst case is duplicated ideas which can be deleted.
- The user can immediately click "Run report now" on the B2B Creative niche after these run; it will start a fresh run and consume nothing from the monthly allowance until past 10 (then 1 credit per run, of which they have 1M).

### Open questions
None — straightforward data fix. Approve and I'll run both updates.

