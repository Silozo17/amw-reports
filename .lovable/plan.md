
Plan:

1. Fix the “CTR below 2%” insight to use the same corrected percentage logic as the cards
- Update `src/lib/opportunityAlerts.ts`
- Normalize CTR before evaluating the `< 2` rule and before rendering the alert text
- Keep alerts fully dynamic from the currently selected dashboard data (`current` / `previous` snapshots), not tied to AI analysis generation
- Result: if the platform data says CTR is ~10%, the insight will stop showing “below 2%”

2. Keep insights truly live with dashboard state
- Confirm and preserve the current pattern in `src/components/clients/ClientDashboard.tsx` where alerts are computed from `filtered` and `filteredPrev`
- Make the alert logic consistent with the rest of the dashboard formatting so filters/month changes immediately update alerts without re-running AI

3. Fix voice briefing currency to use each client’s selected currency
- Update `supabase/functions/voice-briefing/index.ts` to fetch the client’s `preferred_currency` along with `company_name`
- Derive the proper currency symbol/code and include that explicitly in the AI prompt
- Instruct the model to mention money only in the client’s selected currency and never assume USD
- This is likely enough without changing the frontend request shape, since the function already knows the client id

4. Make the month rollover happen on the 1st
- Update `src/hooks/useClientDashboard.ts` so the dashboard defaults to the current month/year from day 1, instead of defaulting to the previous month
- Update `src/lib/reports.ts` so `getCurrentReportPeriod()` also returns the current month from the 1st, removing the current “wait until the 5th” behavior
- This brings dashboard, reports, and client detail flows into one consistent rule

5. Remove the conflicting default-month logic
- Use one shared date rule everywhere possible so different parts of the app don’t show different default months
- Verify any screens currently using `getCurrentReportPeriod()` stay aligned with the dashboard after the change

Technical details:
- Root cause for alerts: `src/lib/opportunityAlerts.ts` uses `m.ctr` directly, but some sources store CTR as a ratio while cards now normalize it before display
- Root cause for voice: `supabase/functions/voice-briefing/index.ts` only fetches `company_name`, so the AI gets no currency context and defaults to USD wording
- Root cause for month behavior:
  - `src/hooks/useClientDashboard.ts` defaults to previous month
  - `src/lib/reports.ts` switches to current month only after the 5th
- Files to update:
  - `src/lib/opportunityAlerts.ts`
  - `supabase/functions/voice-briefing/index.ts`
  - `src/hooks/useClientDashboard.ts`
  - `src/lib/reports.ts`

Expected outcome:
- Insights/opportunities reflect the live selected period/platform data correctly
- Voice briefings speak the client’s chosen currency
- A new month becomes visible and selected by default on the 1st of each month
