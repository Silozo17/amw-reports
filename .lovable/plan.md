

## Fix: cost-circuit-breaker cron erroring every 5 minutes

### What's actually wrong
Your **site is reachable and working** — the preview is loading data successfully (network logs all 200 OK, dev-server clean, auth refresh recovered). The "Failed to fetch" lines in the browser console are transient token-refresh blips that already self-recovered.

The only real failure is a **background cron job** that has been logging an error every 5 minutes since the security pass deployed:

```
admin.rpc(...).catch is not a function
```

### Root cause
In `supabase/functions/cost-circuit-breaker/index.ts` line 61:

```ts
await admin.rpc('cleanup_request_idempotency').catch(() => undefined);
```

Supabase JS v2's `.rpc()` returns a thenable query builder, not a native Promise. `.catch()` is only available **after** `await` resolves it. Calling `.catch` directly throws synchronously, which the outer try/catch turns into a 500 — and the cron logs noise every 5 minutes.

### Fix (one line)
Replace line 61 with:

```ts
try { await admin.rpc('cleanup_request_idempotency'); } catch { /* noop */ }
```

That's it. Single-line change. No other files touched.

### Why nothing else is broken
- Frontend bundle: unchanged by the security pass (only `LandingPage.tsx` Turnstile additions, and those load fine — site rendered)
- Database migrations: applied cleanly (cost_events, platform_settings, request_idempotency tables exist; queries succeed)
- Edge functions: all other functions deploy and run normally; `check-security-events`, `process-scheduled-deletions` logs are clean
- The "Failed to fetch" console errors are pre-existing Supabase SDK behaviour during token refresh and resolved on retry (auth log shows `/token 200` immediately after)

### What this does NOT change
- No site behaviour change
- No new features
- No DB schema change
- Does not address the (separate, expected) freeze-active checks or any security wiring — those are working

