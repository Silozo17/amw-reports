
Fix plan: make shared portal links use one period source of truth end-to-end.

What I found:
- `src/components/clients/ShareDialog.tsx` builds the URL from only `selectedMonth` + `selectedYear`, and only appends `?period=` when `offset > 0`. This means:
  - current month never shows `period=0`
  - non-monthly ranges lose their type
  - the link is inferred after the fact instead of using the exact dashboard selection
- `src/pages/clients/ClientDetail.tsx` only stores `dashboardMonth` and `dashboardYear`, so the parent loses `selectedPeriod.type`.
- `src/pages/ClientPortal.tsx` only reads `period` from the URL. It ignores `type/month/year/startDate/endDate`, so there is no exact-state path.
- `src/hooks/useClientDashboard.ts` still lets `autoDetectPeriod()` mutate `selectedPeriod` inside the fetch path. Even with the ref guard, the hook is not treating the URL selection as the sole source of truth.
- `supabase/functions/portal-data/index.ts` has a separate fallback default that resolves monthly requests to the previous month when no month is supplied, which is inconsistent with the dashboard frontend.

Implementation plan:
1. Preserve the full selected period in the parent
- Replace `dashboardMonth/dashboardYear` in `ClientDetail.tsx` with a full `SelectedPeriod` state.
- Update `ClientDashboard` callback to return the full selected period, not just month/year.

2. Generate links from the exact selected period, not from inferred month math
- Update `ShareDialog.tsx` to accept the full `SelectedPeriod`.
- For monthly mode:
  - always include explicit period info
  - emit `?period=0` for current month and `?period=n` for rolling months
  - also include absolute `month` + `year` as a fallback so the link is inspectable and stable
- For quarterly / YTD / last year / custom / maximum:
  - emit `type`, `month`, `year`, and `startDate/endDate` when relevant
- Stop relying on `offset > 0` as the only condition.

3. Make the portal URL the source of truth
- Refactor `ClientPortal.tsx` to parse a full initial period object from query params:
  - prefer explicit `type/month/year/startDate/endDate`
  - support legacy `period=n` for rolling monthly links
- Pass that full initial period into `ClientDashboard`.

4. Remove period overwrites from data-loading
- Refactor `useClientDashboard.ts` so `selectedPeriod` is initialized from a stable initial ref and never rewritten by the fetch function.
- Move auto-detect into a separate effect that only runs when there is no explicit period from the URL.
- Add a hard guard: if the URL supplied any explicit period data, auto-detect cannot change month/year/type.

5. Align backend fallback behavior
- Update `portal-data` default monthly fallback to match frontend behavior.
- Keep backend period handling passive: if month/year/type are supplied, use them exactly; if not, use one consistent default only.

6. QA
- Generate/open links for:
  - current month -> `?period=0`
  - previous month -> `?period=1`
  - older months -> `?period=n`
  - quarterly / YTD / custom
- Confirm the opened portal keeps the requested period after data loads and does not snap back.
- Confirm copied links visibly include the expected query params.

Technical details:
- Files to update:
  - `src/pages/clients/ClientDetail.tsx`
  - `src/components/clients/ClientDashboard.tsx`
  - `src/components/clients/ShareDialog.tsx`
  - `src/pages/ClientPortal.tsx`
  - `src/hooks/useClientDashboard.ts`
  - `supabase/functions/portal-data/index.ts`
- Core rule after the fix:
```text
share dialog selection
  -> URL query params
  -> ClientPortal parser
  -> useClientDashboard initial state
  -> fetch only
  -> never overwritten by auto-detect
```

This is the proper fix because it removes the guesswork completely: the shared link itself will carry the selected period, the portal will parse that exact value, and the dashboard hook will stop replacing it after data arrives.
