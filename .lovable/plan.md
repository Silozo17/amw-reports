

# Fix Health Score Change Indicator Logic

## Problem

The Marketing Health Score is trend-based — it scores the current month by comparing metrics against the previous month. But the change indicator computes the "previous month's score" by scoring `previous` snapshots against an empty array `[]`, which uses a completely different calculation path (no-baseline defaults return 50-75). This produces a phantom baseline that doesn't match what was actually displayed last month.

**Result:** Score goes 43→48 but indicator says "↓ 5 pts" because the recalculated previous score is ~53.

## Root Cause

Line 165: `scorePaid(previous, [])` — scoring previous data against nothing produces inflated scores via the `previous === 0` branch in `trendScore` (returns 75).

## Solution

The change indicator should compare the score that **would have been shown last month** vs the score shown **this month**. To get "what would have been shown last month", we need the month before `previous` — but we don't have that data available.

**Two options:**

### Option A — Remove the change indicator from the overall gauge (simplest)
Only show the raw 0-100 score. The sub-score cards already show their own per-category change. Removes the misleading indicator entirely.

### Option B — Pass a third snapshot array (`prePrevious`) to compute the real previous score
This requires fetching month N-2 data and passing it through. The previous month's score would be `computeHealthScore(previous, prePrevious).overall`, which accurately reflects what was displayed last month.

**I recommend Option B** — it fixes the indicator properly.

### Changes

**1. `src/hooks/useClientDashboard.ts`**
- Fetch snapshots for month N-2 (two months ago) in addition to N and N-1
- Expose `prePrevious` snapshots alongside `current` and `previous`

**2. `src/components/clients/ClientDashboard.tsx`**
- Pass `prePrevious` to the `HealthScore` component

**3. `src/components/clients/dashboard/HealthScore.tsx`**
- Accept `prePrevious` prop
- Pass it to `computeHealthScore`

**4. `src/lib/healthScore.ts`**
- Change `computeHealthScore` signature to accept `prePrevious?: SnapshotLike[]`
- Compute previous overall as: `computeHealthScore(previous, prePrevious ?? []).overall`
- This recursion is one level deep (the inner call won't recurse because it won't compute change)
- Remove the broken `scorePaid(previous, [])` pattern entirely

| File | Change |
|---|---|
| `src/lib/healthScore.ts` | Accept `prePrevious`, compute previous overall correctly |
| `src/components/clients/dashboard/HealthScore.tsx` | Accept and pass `prePrevious` |
| `src/components/clients/ClientDashboard.tsx` | Pass `prePrevious` snapshots |
| `src/hooks/useClientDashboard.ts` | Fetch month N-2 snapshots |

