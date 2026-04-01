

# Rolling Period Links for Portal Share URLs

## What This Does
Adds DashThis-style `?period=N` query parameter support to portal share links, where:
- `period=0` = current month
- `period=1` = last month
- `period=2` = two months ago
- etc.

These links are **rolling** — they always resolve relative to the current date, so `?period=1` always shows "last month" regardless of when the link was shared.

## Why It Matters
Agencies can create bookmarkable/emailable links that always show a specific relative month — e.g. a monthly email can always include `?period=1` to show last month's results without updating the URL each time.

## Changes

### 1. `src/pages/ClientPortal.tsx`
- Read `?period=N` from URL search params using `useSearchParams`
- Calculate the target month/year by subtracting N months from the current date
- Pass the resolved `initialMonth` and `initialYear` as new props to `ClientDashboard`

### 2. `src/components/clients/ClientDashboard.tsx`
- Accept optional `initialMonth` / `initialYear` props
- Pass them through to `useClientDashboard`

### 3. `src/hooks/useClientDashboard.ts`
- Accept optional `initialMonth` / `initialYear` in params
- Use them (if provided) instead of `defaultMonth` / `defaultYear` for the initial `selectedPeriod` state

### 4. `supabase/functions/portal-data/index.ts`
No changes needed — it already accepts `month` and `year` in the request body, and the frontend already sends `selectedPeriod.month` / `selectedPeriod.year`.

## Example URLs
- `https://reports.amwmedia.co.uk/portal/client-name-1234?period=0` → current month
- `https://reports.amwmedia.co.uk/portal/client-name-1234?period=1` → last month
- `https://reports.amwmedia.co.uk/portal/client-name-1234` → current month (default, unchanged)

## Files Changed

| File | Change |
|---|---|
| `src/pages/ClientPortal.tsx` | Parse `?period=N`, compute month/year, pass to dashboard |
| `src/components/clients/ClientDashboard.tsx` | Accept & forward `initialMonth`/`initialYear` props |
| `src/hooks/useClientDashboard.ts` | Use initial month/year when provided |

