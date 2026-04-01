
# Fix Shared Links Ignoring `?period=`

## What’s actually happening
I checked the real code path, and the issue is not the portal page parser itself. `src/pages/ClientPortal.tsx` does parse `?period=N` and passes `initialMonth` / `initialYear` into `ClientDashboard`.

The bug is in `src/hooks/useClientDashboard.ts`:

- `selectedPeriod` is initialised from `initialMonth` / `initialYear`
- but there is also:
  - `useEffect(() => { setHasAutoDetected(false); }, [clientId]);`
- On first portal load, that effect runs after mount and clears the guard
- then `autoDetectPeriod(...)` runs and is allowed to override the requested period
- if the requested month has no data, it jumps to the latest month with data, which looks like “current month” fallback

So the explicit shared-link period is being reset after mount.

## Fix
Make the portal’s explicit initial period authoritative.

### 1. Update `src/hooks/useClientDashboard.ts`
Change the auto-detect guard so it does not get cleared for portal links that already provided an explicit month/year.

Replace the current client-change reset:
```ts
useEffect(() => { setHasAutoDetected(false); }, [clientId]);
```

With logic that preserves the guard when an explicit initial period exists:
```ts
useEffect(() => {
  setHasAutoDetected(!!(initialMonth && initialYear));
}, [clientId, initialMonth, initialYear]);
```

### 2. Keep existing `selectedPeriod` initialisation
No need to redesign the parser unless you want a different URL format later. This part is already working:
- `ClientPortal.tsx` reads `period`
- resolves it to month/year
- passes those values down

### 3. Optional hardening in `autoDetectPeriod`
Add a small explicit guard at the top so the function is a no-op when the portal supplied a fixed period:
```ts
if (initialMonth && initialYear) return;
```
This is defensive and makes the intent obvious.

## Files to edit
| File | Change |
|---|---|
| `src/hooks/useClientDashboard.ts` | Preserve `hasAutoDetected` when `initialMonth`/`initialYear` are provided; optionally guard `autoDetectPeriod` |

## Expected result
- `/portal/<token>?period=1` opens last month
- `/portal/<token>?period=2` opens two months ago
- the dashboard no longer jumps to the latest/current month just because that month has data
- normal non-portal dashboards still auto-detect the latest month with data

## Technical note
This matches the bug you’re seeing better than the earlier theory about parsing. The parser in `ClientPortal.tsx` is fine; the mounted hook state is what is undoing it.
