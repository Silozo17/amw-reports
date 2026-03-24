

# Plan: Fix Quarterly Navigation + Full Period Selector Dropdown

## Problem
1. **Quarterly arrows step by 1 month** — `handlePrevMonth`/`handleNextMonth` always call `subMonths`/`addMonths` by 1, so it takes 3 clicks to move one quarter.
2. **No period type selector beyond Monthly/Quarterly** — user wants Weekly, Monthly, Quarterly, Year to Date, Last Year, Maximum, and Custom with date pickers.

## Changes

### File: `src/components/clients/DashboardHeader.tsx`

**1. Expand `PeriodType` and `SelectedPeriod`:**
```typescript
export type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'ytd' | 'last_year' | 'maximum' | 'custom';
```
- `startDate` and `endDate` are used for `custom` type
- `ytd`, `last_year`, `maximum` are computed ranges (no arrows needed)

**2. Replace toggle buttons with a Select dropdown:**
- Use shadcn `Select` component with options: Weekly, Monthly, Quarterly, Year to Date, Last Year, Maximum, Custom
- When "Custom" is selected, show two date pickers (From / To) using shadcn `Popover` + `Calendar`

**3. Fix arrow navigation to step by the correct unit:**
- `weekly`: step by 7 days (adjust month/year accordingly)
- `monthly`: step by 1 month (current behavior)
- `quarterly`: step by 3 months
- `ytd` / `last_year` / `maximum`: hide arrows entirely (fixed ranges)
- `custom`: hide arrows (user picks dates manually)

**4. Compute period label dynamically:**
- Weekly: "Week of Mar 17, 2026"
- Monthly: "March 2026"
- Quarterly: "Q1 2026"
- YTD: "Jan – Mar 2026"
- Last Year: "2025"
- Maximum: "All Time"
- Custom: "Mar 1 – Mar 24, 2026"

### File: `src/components/clients/ClientDashboard.tsx`

**5. Update `fetchSnapshots` to handle all period types:**
- `weekly`: filter snapshots where `report_month` matches the week's month (note: weekly is approximate since data is monthly — show the month containing the selected week)
- `monthly`: current logic (unchanged)
- `quarterly`: current logic (unchanged)
- `ytd`: fetch months 1 through current month of current year
- `last_year`: fetch all 12 months of previous year
- `maximum`: fetch all snapshots (no month/year filter)
- `custom`: fetch all months between `startDate` and `endDate` using `.gte`/`.lte` on year/month

**6. Update previous-period comparison logic:**
- For quarterly: compare to previous quarter
- For ytd: compare to same period last year
- For last_year: compare to year before
- For maximum/custom: no MoM comparison (hide trend arrows)

### File: `src/components/clients/DashboardHeader.tsx` — Custom Date Picker UI

**7. When `custom` is selected, render:**
- Two `Popover` + `Calendar` components inline (From date, To date)
- Styled consistently with the period selector
- Use `pointer-events-auto` on Calendar as per shadcn guidelines
- Disable future dates
- On date selection, call `onPeriodChange` with updated `startDate`/`endDate`

## Technical Notes
- Weekly view shows the monthly snapshot for that week's month (since data granularity is monthly). Add a subtle note: "Showing monthly data — weekly breakdowns require daily snapshots."
- The quarterly arrow bug is a simple fix: use `subMonths(date, 3)` / `addMonths(date, 3)` when `type === 'quarterly'`.
- No database changes needed — all filtering uses existing `report_month` / `report_year` columns.

