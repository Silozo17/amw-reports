

# Research: Marketing Health Score Approaches + Fix Plan

## What the Industry Does

After researching marketing reporting platforms (AgencyAnalytics, DashThis, Whatagraph, HubSpot, AdStellar) and health scoring methodologies, there are two dominant approaches:

### Approach A — Pure Trend-Based (what you have now)
Score is entirely based on month-over-month change. 0% change = 60, +20% = 90, -20% = 30.

**Problem:** The score is unstable and confusing. A client with steady, strong metrics gets a "Fair" 60 because nothing changed. Two identical months = mediocre score. Clients see a number and assume higher = better performance, but it actually means "more growth than last month."

### Approach B — Hybrid: Absolute Benchmarks + Trend Bonus (industry standard)
Used by most scoring systems (Signal Stack formula, AdStellar, HubSpot frameworks). The score is primarily based on **where the metrics sit relative to benchmarks**, with a smaller weight for **trend direction**.

```text
Score = (Benchmark Score × 70%) + (Trend Score × 30%)
```

This is what platforms like AgencyAnalytics and campaign scoring systems use. It means:
- Strong CTR + stable = high score (not penalised for no growth)
- Weak CTR + improving = mid score (rewarded for trend)
- Weak CTR + declining = low score

## The Core Bug (Separate from Approach)

Regardless of which approach you keep, the **change indicator is broken** because `scorePaid(previous, [])` compares last month against nothing, producing phantom baselines. This is the approved plan from earlier that hasn't been implemented yet.

## Recommended Plan: Hybrid Scoring + Fix Change Indicator

Keep your current three-category structure (Paid, Social, SEO) but switch each sub-scorer to a hybrid model and fix the change calculation with `prePrevious` data.

### 1. `src/lib/healthScore.ts` — Hybrid scoring formula

For each category, compute two components:

**Benchmark component (70%)** — score metrics against absolute thresholds:
- Paid: CTR tiers (current logic, keep), ROAS tiers, CPC absolute bands
- Social: Engagement rate tiers, follower growth rate bands
- SEO: CTR tiers, position bands (top 3 = excellent, top 10 = good, etc.)

**Trend component (30%)** — keep the existing `trendScore` function but weight it at 30%.

**Fix change indicator:** Accept optional `prePrevious` snapshots. Compute previous month's score as `computeHealthScore(previous, prePrevious).overall` instead of the broken `scorePaid(previous, [])` pattern.

### 2. `src/hooks/useClientDashboard.ts` — Fetch N-2 month data

Add a query for month N-2 snapshots (you already have 12-24 months of historical data). Expose `prePreviousSnapshots` alongside `currentSnapshots` and `previousSnapshots`.

### 3. `src/components/clients/ClientDashboard.tsx` — Pass prePrevious

Pass the new `prePreviousSnapshots` array to the `HealthScore` component.

### 4. `src/components/clients/dashboard/HealthScore.tsx` — Accept prePrevious prop

Accept and forward `prePrevious` to `computeHealthScore`.

## Scoring Examples (Before vs After)

```text
Scenario: Client has 3% CTR, steady month-over-month

BEFORE (pure trend): CTR bucket = 70, CPC trend = 60 (no change)
  → Score: 65 "Fair" — feels wrong for good performance

AFTER (hybrid): Benchmark = 70 (good CTR), Trend = 60 (stable)
  → Score: 70×0.7 + 60×0.3 = 67 "Fair" — similar but now stable
  → If CTR was 5%: 90×0.7 + 60×0.3 = 81 "Good" — correct!

Scenario: Score 43 month 1, 48 month 2, change indicator

BEFORE: Previous scored against [] = ~53 (phantom), change = 48-53 = -5 ↓ WRONG
AFTER: Previous scored against real N-2 data = 43, change = 48-43 = +5 ↑ CORRECT
```

## Files to Edit

| File | Change |
|---|---|
| `src/lib/healthScore.ts` | Hybrid formula (benchmark 70% + trend 30%), accept `prePrevious`, fix change calc |
| `src/hooks/useClientDashboard.ts` | Fetch month N-2 snapshots |
| `src/components/clients/ClientDashboard.tsx` | Pass `prePrevious` prop |
| `src/components/clients/dashboard/HealthScore.tsx` | Accept `prePrevious` prop |

