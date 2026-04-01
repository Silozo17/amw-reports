

# Custom Date Range Reports

## Problem
Reports are currently locked to single calendar months. The system needs to support arbitrary date ranges (e.g. 1 Jan – 15 Mar) for PDF generation.

## Key Constraint
The underlying data source (`monthly_snapshots`) stores metrics per calendar month. A custom-range report must aggregate across multiple monthly snapshots. Partial-month precision (e.g. "1st–15th March") is not possible at the data level — the system will include full months that fall within the selected range.

## Approach
Add optional `date_from` / `date_to` fields alongside the existing `report_month` / `report_year` fields. When a date range is provided, the system aggregates all monthly snapshots that fall within the range. The existing single-month flow remains unchanged as the default.

---

## Database Changes

**Migration — `reports` table:**
- Add `date_from` (date, nullable) and `date_to` (date, nullable)
- Add a new unique constraint on `client_id, date_from, date_to` for custom-range reports
- Keep existing `client_id, report_month, report_year` constraint for standard monthly reports

## UI Changes — `ClientReportsTab.tsx`

- Add a toggle: "Monthly" (default) vs "Custom Range"
- In "Custom Range" mode, show two date pickers (from/to) instead of month/year selects
- Display custom-range reports in the list with formatted date range labels (e.g. "1 Jan – 15 Mar 2026") instead of "Jan 2026"
- Pass `date_from` / `date_to` to the generate function when in custom mode

## Client Library — `src/lib/reports.ts`

- Update `generateReport` to accept an optional `{ dateFrom, dateTo }` parameter
- When custom dates provided: insert report with `date_from`/`date_to` (and set `report_month`/`report_year` to the end-date month for ordering)
- Pass dates through to the edge function

## Edge Function — `generate-report/index.ts`

**Request interface:** Add optional `date_from` and `date_to` (ISO date strings).

**Data fetching:** When custom dates are provided:
- Compute the list of month/year pairs that fall within the range
- Fetch all `monthly_snapshots` for those months
- Aggregate metrics: sum additive metrics (clicks, impressions, spend), average rate metrics (CTR, bounce_rate), take latest for cumulative metrics (followers)
- For comparison, fetch the same-length period immediately prior

**PDF rendering:**
- Cover page shows date range instead of single month
- Intro text: "This report covers performance from {date_from} to {date_to}"
- Header/footer shows date range
- Comparison labels change from "Last Month" → "Previous Period"
- Storage path: `{client_id}/{date_from}_{date_to}.pdf`

## Files Changed

| File | Change |
|---|---|
| Migration | Add `date_from`, `date_to` to `reports` table |
| `src/components/clients/ClientReportsTab.tsx` | Add monthly/custom toggle, date pickers, display logic |
| `src/lib/reports.ts` | Accept optional date range params, pass to edge function |
| `supabase/functions/generate-report/index.ts` | Accept date range, aggregate multi-month snapshots, update PDF labels |

## Metrics Aggregation Strategy

| Metric Type | Examples | Aggregation |
|---|---|---|
| Additive | clicks, impressions, spend, conversions | Sum |
| Rate/Average | CTR, bounce_rate, engagement_rate, CPC | Weighted average |
| Cumulative/Snapshot | followers, subscribers | Take latest month's value |
| Count | posts_published, videos_published | Sum |

## Translation Updates
Add new translation keys: `customPeriod`, `previousPeriod`, `thisPeriod` across all supported languages (en, fr, de, es, it, nl, pt, pl, da).

