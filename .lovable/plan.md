

## Two unrelated fixes

### Fix 1 — Restore Content Lab tier limits (no "agency unlimited")

**Root cause:** I wrongly carried over an `agency: Number.MAX_SAFE_INTEGER` entry in `RUN_LIMITS_BY_TIER` in both `src/lib/contentLabPricing.ts` and `supabase/functions/_shared/contentLabTiers.ts`. There is no `agency` Content Lab product — the real tiers are **Starter (3), Growth (5), Scale (20)**. AMW Media's `org_subscriptions.content_lab_tier` was set to `agency`, so it resolved to "unlimited" by accident.

**Changes:**
1. `src/lib/contentLabPricing.ts` — remove the `agency` line from `RUN_LIMITS_BY_TIER`. The map now contains only `starter`, `growth`, `scale` (derived from `CONTENT_LAB_TIERS`).
2. `supabase/functions/_shared/contentLabTiers.ts` — remove the `agency` line. Mirror the frontend exactly: `starter: 3, growth: 5, scale: 20`.
3. **Data fix (migration)**: update AMW Media's `org_subscriptions.content_lab_tier` from `'agency'` to `'scale'` (highest real Content Lab tier — 20 runs/mo). Credits still cover overflow runs as designed.
4. Revert the leftover "agency unlimited" hint copy in `src/pages/content-lab/ContentLabPage.tsx` (the `>= MAX_SAFE_INTEGER` branch becomes dead and is removed).

**Result:** AMW Media badge → `5 / 20 runs this month · 1,000,000 credits`. Once 20 runs used, credits start ticking down 1-per-run (this credit-overflow gate stays — you approved it earlier and it's the intended behaviour for paid tiers).

### Fix 2 — Syncs no longer get stuck (Facebook stuck at 10/24 case)

**Root cause confirmed in DB & code:**
- `process-sync-queue` runs each month sequentially via `await invoke(syncFn)`. Facebook ≈ 15-20s/month × 24 months ≈ 7 min total.
- The parent `process-sync-queue` invocation hits its own edge-function CPU/wall-clock limit mid-loop and dies silently.
- Job row stays `status='processing'` with `started_at` frozen.
- Stale-reset (10 min threshold) only runs **when `process-sync-queue` is invoked again** — but **nothing invokes it**. There is no cron schedule for it; the only triggers are the initial frontend `enqueueSync` and the function's own self-continuation (which can't fire if the function died). Result: jobs sit stuck forever.
- Live evidence: job `1fb66ad9…cf1c` — Facebook, processing, 10/24, started 17:49, 11 snapshots actually written (last 17:52), then no progress for 25+ minutes.

**Changes (no schema changes beyond a cron schedule):**

1. `supabase/functions/process-sync-queue/index.ts`:
   - **Per-job watchdog**: track wall-clock per `processJob`. If a single platform-month `invoke` takes >25s, abort it, mark that month as failed-with-retry, continue to the next month — no more silent hangs blocking the whole job.
   - **Resume-friendly loop**: at the start of each `processJob` iteration, re-check elapsed time vs a 90s budget for the whole queue invocation. If exceeded, set the job back to `pending` (preserving `progress_completed`) so the next invocation picks up from where it left off, and exit the loop cleanly. No more dying mid-loop with the row frozen as `processing`.
   - **Always self-continue at the end**, even on errors, as long as pending jobs exist.
   - **Tighter stale threshold**: drop `STALE_JOB_THRESHOLD_MS` from 10 min → 3 min. Combined with the cron below, stuck rows get reaped within 3-4 min instead of forever.
   - **`isBackfillJob` already filters out completed months**, so resuming is cheap and correct.

2. **New pg_cron schedule (migration)**: invoke `process-sync-queue` every minute. This is the safety net — even if every self-continuation chain breaks, queued/stale jobs are picked up within 60s and stale ones reset within ~3 min. Light load: function returns immediately when queue is empty.

3. `src/components/clients/SyncProgressBar.tsx`: when a `processing` job hasn't moved its `progress_completed` for >2 min, switch the bar copy from `"X% — Syncing…"` to `"Recovering — resuming shortly…"` so the user sees the system is self-healing instead of "stuck".

4. **One-shot data fix (migration)**: reset the currently stuck job (`1fb66ad9…cf1c`) to `pending`, clear `started_at`, so the new cron picks it up immediately on the next minute tick.

**No changes** to the individual `sync-*` functions — they already work; the bug is purely in queue orchestration.

### Verification
- AMW Media badge shows `5 / 20 runs this month · 1,000,000 credits`. No `9007199254740991` anywhere.
- The stuck Facebook job resumes within ~60s of cron deploying, completes the remaining 13 months in ≤2 more cron cycles.
- Future syncs: any platform-month that hangs >25s is skipped with a retry; queue invocations that approach their own limit cleanly hand off to the next cron tick instead of dying mid-loop. No job stays `processing` for more than ~3 min without progress.
- No new user-facing features. No Stripe/product changes. No connector changes.

