

# Fix Portal Period Selection Being Ignored

## Problem
When a portal link includes `?period=N`, the `resolveRelativePeriod` correctly calculates the target month/year, and `useClientDashboard` initialises `selectedPeriod` with those values. However, after data loads, the `autoDetectPeriod` function checks if the current period has data — and if the selected month happens to be empty, it overrides `selectedPeriod` to the latest month with data. This defeats the explicit period selection.

## Fix

### `src/hooks/useClientDashboard.ts`
- Skip `autoDetectPeriod` when `initialMonth` and `initialYear` were explicitly provided.
- Add a simple guard: pass a flag or check if initial values were set, and if so, mark `hasAutoDetected = true` from the start so `autoDetectPeriod` becomes a no-op.

Concretely, change the initial state of `hasAutoDetected` (line 110):
```ts
const [hasAutoDetected, setHasAutoDetected] = useState(
  !!(initialMonth && initialYear)
);
```

This single change ensures that when the portal resolves `?period=1` to e.g. March 2026, the dashboard stays on March 2026 and doesn't auto-jump to whatever month has data.

| File | Change |
|---|---|
| `src/hooks/useClientDashboard.ts` | Initialise `hasAutoDetected` to `true` when `initialMonth`/`initialYear` are provided |

