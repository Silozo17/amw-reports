

## Fix the broken Content Lab usage badge

Today the header badge renders `usage.runsThisMonth / usage.runsLimit runs · creditBalance credits`. For the AMW Media org (tier `agency`), `runLimitForTier('agency')` returns `Number.MAX_SAFE_INTEGER` (`9007199254740991`), which is printed verbatim. The credit balance (`1000000`) is also printed as a raw integer with no formatting.

You asked for: only show available credits, and optionally how many runs were done this month. No more "X / Y runs" display.

### Change scope (1 file)

`src/pages/content-lab/ContentLabPage.tsx`

1. **Replace the badge label (line 122)** with a clean, agency-aware string:
   - Always show: `"{creditBalance.toLocaleString()} credits"` (formats `1000000` → `1,000,000`).
   - Append `" · {runsThisMonth} runs this month"` so you still see usage at a glance.
   - No more "X / Y runs". The denominator is gone entirely.

2. **Fix the dialog hint copy (lines 180–184)** so it doesn't print the unlimited sentinel either:
   - Agency tier: `"Unlimited monthly runs ({runsThisMonth} used so far this month)."`
   - Other tiers: keep current wording but format `runsLimit` normally (no MAX_SAFE_INTEGER risk for paid tiers).

3. **Fix the "blocked" toast (line 101)** for the same reason — for agency tier it can never trigger anyway, but the message should never reference the sentinel. Show `"No credits left. Top up to keep running."` when `noCredits` is true regardless of tier.

4. **No changes to** `useContentLab.ts`, `contentLabPricing.ts`, the database, or the edge functions. The data model stays as-is; only the presentation is fixed. `MAX_SAFE_INTEGER` is still the correct internal "unlimited" sentinel for the gating logic in `content-lab-pipeline` etc.

### Out of scope
- No tier rename, no new "unlimited" enum, no schema change.
- No change to how credits are charged or displayed elsewhere (`UsageBadge`, paywall screens).
- Number formatting elsewhere in Content Lab is not touched in this pass.

### Verification
- AMW Media (agency tier, 1,000,000 credits, 5 runs this month) shows: **`1,000,000 credits · 5 runs this month`**.
- A starter-tier org (3/month, 0 credits, 2 runs done) shows: **`0 credits · 2 runs this month`**, dialog hint reads `"Uses 1 of 3 monthly runs (2 used so far)."`.
- No occurrence of `9007199254740991` anywhere in the UI.

