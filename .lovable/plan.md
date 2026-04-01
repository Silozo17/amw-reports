

# Fix Share Links to Include Selected Month

## Problem
The `ShareDialog` component generates portal URLs without any period information. When a user is viewing a specific month and shares the link, the recipient sees the default (current) month instead of the selected one.

## Approach
Use the `?period=N` rolling parameter we just built. The `ShareDialog` needs to know the currently selected month/year so it can calculate the offset from the current month and append `?period=N` to the URL.

## Changes

### 1. `src/pages/clients/ClientDetail.tsx`
- Lift the selected period out of the dashboard by adding local state (`selectedMonth`, `selectedYear`) at the page level
- Pass these down to `ClientDashboard` as `initialMonth`/`initialYear` and also receive period changes via a new `onPeriodChange` callback
- Pass `selectedMonth` and `selectedYear` to `ShareDialog`

### 2. `src/components/clients/ClientDashboard.tsx`
- Accept an optional `onPeriodChange?: (month: number, year: number) => void` prop
- Call it whenever `selectedPeriod` changes (via a `useEffect`)

### 3. `src/components/clients/ShareDialog.tsx`
- Accept optional `selectedMonth` and `selectedYear` props
- In `getShareUrl`, calculate the period offset: months between now and the selected month
- Append `?period=N` to the URL (omit if `period=0`, i.e. current month)

### 4. No backend changes needed
The `?period=N` resolution already works in `ClientPortal.tsx`.

## Example
User viewing March 2026 in April 2026 → `period=1` → URL becomes:
`https://domain.com/portal/client-slug-1234?period=1`

| File | Change |
|---|---|
| `src/pages/clients/ClientDetail.tsx` | Track selected period, pass to ShareDialog |
| `src/components/clients/ClientDashboard.tsx` | Add `onPeriodChange` callback prop |
| `src/components/clients/ShareDialog.tsx` | Accept month/year, append `?period=N` to URLs |

