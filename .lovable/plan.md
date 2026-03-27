

# Fix: Sync Progress Timer Labels

## Problem

The timer shows `00:48 min` which is confusing — is that 48 seconds or 48 minutes? The `min` suffix is always shown regardless of the actual duration.

## Fix

In `src/components/clients/SyncProgressBar.tsx` line 43, replace the single format string with human-readable labels:

- Under 60 seconds: `"~48 sec"`
- 1-59 minutes: `"~3 min 12 sec"`
- 60+ minutes: `"~1 hr 12 min"`

Replace line 43:
```ts
const timeLeft = totalCompleted > 0
  ? remaining < 60
    ? `~${secs} sec`
    : mins < 60
      ? `~${mins} min ${secs} sec`
      : `~${Math.floor(mins / 60)} hr ${mins % 60} min`
  : 'Estimating...';
```

## Files Modified

| File | Change |
|---|---|
| `src/components/clients/SyncProgressBar.tsx` | Update time format to use explicit sec/min/hr labels |

