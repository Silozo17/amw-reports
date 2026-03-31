

# Partial-Month Normalization for Insights & Opportunities

## Problem
When viewing the current month (e.g. April 6th), the dashboard compares 6 days of April data against a full 30 days of March. Volume metrics (reach, engagement, clicks, spend) will always appear dramatically lower, triggering false "warning" alerts and suppressing "win" alerts.

## Approach
**Pro-rate the previous month's data** to match the number of elapsed days in the current month. This way, comparisons are apples-to-apples.

- If the current period is the current calendar month, calculate `dayOfMonth / daysInMonth` as a scaling factor
- Multiply previous month's volume metrics by this factor before comparing
- Only apply scaling when viewing the current month (historical full months need no adjustment)
- Rate/ratio metrics (CTR, CPC, CPL, engagement rate) are **not** scaled — they're already normalized by nature

## Changes

### File: `src/lib/opportunityAlerts.ts`

1. Add a new optional parameter `partialMonthRatio?: number` (0-1, e.g. `6/30 = 0.2` on April 6th)
2. When provided and < 1, scale previous month's volume metrics down by this ratio before comparison:
   - `prevEng * ratio`, `prevReach * ratio`, `prevFollowers * ratio`
3. Do **not** scale rate metrics (CPC, CPL, CTR) — they're already per-unit

### File: `src/components/clients/dashboard/OpportunityAlerts.tsx`

1. Accept new prop `selectedPeriod` from the parent
2. Calculate `partialMonthRatio`: if `selectedPeriod.type === "monthly"` and the month/year matches the current calendar month, compute `dayOfMonth / daysInCurrentMonth`; otherwise pass `1` (no scaling)
3. Pass the ratio to `computeOpportunityAlerts`

### File: `src/components/clients/ClientDashboard.tsx`

1. Pass `selectedPeriod` to the `OpportunityAlerts` component (already available in scope)

### Runtime error fix (same file batch)

The `aiAnalysis is not defined` error at line 475 of `useClientDashboard.ts` will also be fixed — likely a stale reference from the refactor to `analysisMap`. This will be addressed in the same change set.

