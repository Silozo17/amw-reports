
Add a temporary diagnostic block to `supabase/functions/sync-facebook-page/index.ts` to test which Facebook organic/paid insights metrics are actually valid for the AMW Media page in April 2026.

**Plan:**
1. Locate the page loop in `sync-facebook-page/index.ts` and find the `pageToken` decryption line.
2. Insert the provided diagnostic block immediately after that line — fetches 11 candidate organic/paid metrics with `period=day` and logs status, per-metric totals, and any error.
3. Redeploy `sync-facebook-page`.

**Notes:**
- Diagnostic only — no production logic changes.
- User will trigger the April 2026 resync manually after deploy, then I pull logs to identify which metrics Meta accepts and pick the correct organic/paid pair.
- Block is clearly marked `TEMPORARY DIAGNOSTIC - REMOVE AFTER` for cleanup.
