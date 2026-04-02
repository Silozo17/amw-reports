

# Fix: Scheduled Client Deletions Never Execute

## Problem

The `process-scheduled-deletions` edge function exists and the code is correct, but **nothing ever calls it**. There is no cron job, no scheduled invocation, no trigger — the function is dead code. When a client is scheduled for deletion, the 24-hour timer expires and nothing happens.

## Root Cause

No cron schedule was set up to periodically invoke the `process-scheduled-deletions` function. The `supabase/config.toml` only contains the project ID — no cron configuration exists anywhere in the project.

## Fix

Use the `pg_cron` extension (available in the database) to create a cron job that calls the edge function every hour. This is the simplest, most reliable approach — no new infrastructure needed.

### 1. Create a database migration with a cron job

Add a `pg_cron` job that invokes the `process-scheduled-deletions` edge function every hour via `pg_net` (HTTP extension):

```sql
SELECT cron.schedule(
  'process-scheduled-deletions',
  '0 * * * *',  -- every hour
  $$
  SELECT net.http_post(
    url := 'https://kcdixfmjiifpnbtplodv.supabase.co/functions/v1/process-scheduled-deletions',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

If the `service_role_key` isn't available via `current_setting`, we'll use the vault or hardcode the invocation via the `SUPABASE_SERVICE_ROLE_KEY` secret approach that other scheduled functions in this project already use.

### 2. Deploy the edge function

Ensure `process-scheduled-deletions` is deployed (it may not be since it was never referenced).

### 3. No code changes needed

The edge function logic and the frontend scheduling/cancellation code are both correct. Only the trigger is missing.

## Files

| File | Change |
|---|---|
| New migration | Add `pg_cron` schedule to call the edge function hourly |
| `supabase/functions/process-scheduled-deletions/index.ts` | Deploy (no code changes) |

## After the fix

- Every hour, the cron job calls the function
- The function finds clients where `scheduled_deletion_at <= now()`
- Those clients are deleted via the service role (bypasses RLS)
- The "Wheels VT" client (and any others past their 24h window) will be deleted on the next hourly run

