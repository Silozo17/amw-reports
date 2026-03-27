

# Client Reports Tab + Improved Reports Page + 12-Report Cap

## Overview

Three changes:
1. Add a "Reports" tab inside ClientDetail (after Upsells) showing that client's report history with preview/download/regenerate/email actions
2. Enforce a max 12 reports per client — when generating a new one, delete the oldest if at 12
3. Redesign the main Reports page with better filtering (client filter, status filter, search)

---

## 1. New "Reports" Tab in ClientDetail

**File: `src/pages/clients/ClientDetail.tsx`**

Add a `reports` tab after `upsells` in the TabsList (line 436):
```
<TabsTrigger value="reports">Reports</TabsTrigger>
```

Add a new `TabsContent value="reports"` section that:
- Fetches reports from the `reports` table filtered by `client_id = client.id`, ordered by year/month desc
- Joins email_logs for email status (same pattern as main Reports page)
- Shows each report as a row with: month/year label, status badge, generated date, email status
- Action buttons: Preview, Download, Regenerate, Send Email (reuse existing handlers from `@/lib/reports`)
- Shows a "Generate Report" button at the top with month/year pickers (reuses existing `reportMonth`/`reportYear` state already in the component)
- Empty state: "No reports generated for this client yet"

This is essentially a scoped version of the main Reports page, filtered to one client.

## 2. Enforce 12-Report Cap Per Client

**File: `supabase/functions/generate-report/index.ts`**

After successfully generating and saving a new report, add cleanup logic:

```sql
-- Delete oldest reports beyond the 12 most recent for this client
DELETE FROM reports
WHERE client_id = $clientId
AND id NOT IN (
  SELECT id FROM reports
  WHERE client_id = $clientId
  ORDER BY report_year DESC, report_month DESC
  LIMIT 12
)
```

Also delete the corresponding PDF files from the `reports` storage bucket for any deleted rows.

## 3. Redesign Main Reports Page

**File: `src/pages/Reports.tsx`**

Current issues: all controls crammed into one row at the top. Redesign:

- **Header row**: Title + "Generate Report" button (opens a small inline form or keeps the selectors)
- **Filter bar**: Client dropdown (with "All clients" option), status filter (All / Success / Failed / Pending), month/year pickers
- **Reports list**: Filtered by selected client. Group reports by client name when showing all. Each report card shows client name, period, status badge, email status, and action buttons
- When a client is selected in the filter, the "Generate Report" button uses that client automatically
- Add report count badge next to each client in the dropdown (e.g. "Acme Corp (3)")

---

## Files Modified

| File | Change |
|---|---|
| `src/pages/clients/ClientDetail.tsx` | Add "Reports" tab with scoped report list + actions |
| `src/pages/Reports.tsx` | Redesign with filters, client grouping, better layout |
| `supabase/functions/generate-report/index.ts` | Add 12-report cap cleanup after generation |

