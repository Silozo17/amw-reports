

# Fix Scheduled Sync: 5 AM UK Time for All Plans

## Problems Found

1. **Cron runs at 5 AM UTC, not UK time.** The `daily-sync-5am` cron schedule is `0 5 * * *` which is UTC. During BST (late March–late October), this fires at **6 AM UK time**, not 5 AM.

2. **Creator plan syncs on the 4th of the month, not Mondays.** Line 191: `now.getDate() !== 4` means Creator only syncs on the 4th day of each month. The user wants every Monday.

3. **`now` uses UTC, not UK time.** The day-of-week and date checks use `new Date()` which is UTC in Edge Functions, so even the Freelancer Monday check (`now.getDay() !== 1`) can be off by a day near midnight.

## Changes

### 1. Update `scheduled-sync/index.ts`
- Add a UK-time helper that converts UTC `now` to `Europe/London` for all schedule gating decisions.
- Fix Creator gating: change from `now.getDate() !== 4` to `ukDay !== 1` (Monday).
- Fix Freelancer gating: use UK day-of-week instead of UTC day-of-week.
- Agency plan: no day gating (syncs daily) — this is already correct.

### 2. Update cron schedule (SQL insert via Supabase tool)
- Delete and recreate the `daily-sync-5am` cron job to run at **4 AM UTC** (`0 4 * * *`) during BST and **5 AM UTC** during GMT. Since pg_cron doesn't support timezones natively, the cleanest approach is to **run the cron hourly between 4–5 AM UTC** and let the edge function itself determine if it's 5 AM UK time, OR simply accept a fixed `0 5 * * *` schedule and handle the UK-time check inside the function. The simplest reliable fix: keep cron at `0 5 * * *` and adjust the function to interpret "5 AM UK" by converting the current UTC time to UK time for all gating logic. (The 1-hour BST drift is minor — if exact 5 AM UK is critical, we change cron to `0 4 * * *` and add an in-function UK-hour check to only proceed when it's 5 AM UK.)

**Recommended approach:** Change cron to `0 4 * * *` (covers BST) and add a UK-time guard in the function that also accepts hour 5 (covers GMT). This ensures it always fires at 5 AM UK regardless of DST.

### Summary of code changes

- **`supabase/functions/scheduled-sync/index.ts`**: Add `toLocaleString('en-GB', {timeZone: 'Europe/London'})` to derive UK hour/day, gate execution to only run when UK hour is 5, fix Creator to Monday-only, fix Freelancer to Monday-only using UK time.
- **Cron job**: Update schedule from `0 5 * * *` to `0 4,5 * * *` so the function is invoked at both possible UTC hours that could be 5 AM UK (GMT vs BST). The function itself will exit early if it's not 5 AM UK.

