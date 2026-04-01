

# Add MoM Change Indicator to Overall Health Score

## Summary
The overall Marketing Health Score gauge shows a number (0-100) and a label but no up/down indicator comparing to last month. The sub-score cards already have this. We need to compute the previous month's overall score and display the change on the gauge.

## Changes

### 1. `src/lib/healthScore.ts`
- Add `change?: number` to `HealthScoreResult` interface
- In `computeHealthScore`, compute a `previousOverall` by running the same category scoring logic on the `previous` snapshots (using an empty array as their "previous") to get a baseline score
- Set `result.change = overall - previousOverall` when previous data exists

### 2. `src/components/clients/dashboard/HealthScore.tsx`
- Update `CircularGauge` to accept and display `change?: number`
- Below the score label, show an arrow indicator (up/down/neutral) with the point difference, styled green for positive, red for negative, muted for zero — matching the existing sub-score card pattern

| File | Change |
|---|---|
| `src/lib/healthScore.ts` | Add `change` to result, compute previous overall |
| `src/components/clients/dashboard/HealthScore.tsx` | Display change indicator on gauge |

