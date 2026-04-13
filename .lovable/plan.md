
Goal: fix LinkedIn Organic for real using the April 2026 docs and the actual live failure, not more guesswork.

What I confirmed
- LinkedIn Organic and LinkedIn Ads are already separate in this project:
  - Organic connection row exists as `platform = linkedin`
  - Ads connection row exists separately as `platform = linkedin_ads`
- The live Organic connection is real and selected correctly:
  - client: `c2b194b6-3b2c-4f5a-9f00-95e13ca28027`
  - organic connection id: `47d8a260-a7f4-41f2-8ca0-f98e9b49cad0`
  - selected page: `urn:li:organization:104033760`
- The current blocking error is also real:
  - `Invalid timeIntervals parameter ... End time must be greater than start time by at least one multiple of the granularity type [MONTH]`

Actual root cause
- `supabase/functions/sync-linkedin/index.ts` is building monthly windows incorrectly.
- It currently uses:
  - start = first day of month at 00:00
  - end = last day of month at 23:59:59.999
- LinkedIn’s MONTH granularity expects full month boundary intervals, not “month-end minus 1ms”.
- So the request is 1 ms short of a full month and LinkedIn rejects it.
- This is why Organic fails before any dashboard rendering happens.

Implementation plan
1. Fix month interval construction in `supabase/functions/sync-linkedin/index.ts`
- Replace the current local-time month range with a UTC month-boundary helper:
  - `start = Date.UTC(year, month - 1, 1, 0, 0, 0, 0)`
  - `end = Date.UTC(year, month, 1, 0, 0, 0, 0)`
- Stop using `23:59:59.999` entirely for LinkedIn MONTH queries.
- Use that helper for every LinkedIn Organic MONTH-based stats request.

2. Keep Rest.li 2.0 request formatting strict
- Preserve `X-Restli-Protocol-Version: 2.0.0`
- Preserve tuple syntax:
  - `timeIntervals=(timeRange:(start:...,end:...),timeGranularityType:MONTH)`
- Build URLs with `URL` / `searchParams` or a small dedicated helper so the request format is not hand-assembled inconsistently.

3. Align endpoint behavior to the docs, but only where needed
- Keep Organic scoped to the selected Organic page only.
- Keep the existing entity routing:
  - company page → `organizationPageStatistics`
  - brand/showcase page → `brandPageStatistics`
- Keep LinkedIn Ads untouched.

4. Make failure reporting complete
- In `sync-linkedin`, update the `sync_logs` row to `failed` with `error_message` in the catch path, not just `platform_connections.last_error`.
- Keep fail-fast behavior so real API problems stay visible.

5. Validate against the live Organic connection
- Re-test the actual failing Organic connection, not a hypothetical one.
- Verify:
  - no more MONTH interval error
  - Organic sync returns success
  - `last_sync_at` is populated for the Organic row
  - a `monthly_snapshots` row is created for platform `linkedin`
  - the dashboard then renders LinkedIn metrics from that snapshot

Files to change
- `supabase/functions/sync-linkedin/index.ts`

Technical details
- Live evidence shows the failure is not OAuth, not picker selection, and not an Organic/Ads mix-up.
- The selected Organic page is already persisted.
- The bad request is specifically the monthly interval shape.
- The safe fix is to use exact month-start to next-month-start UTC boundaries for MONTH granularity.

Expected outcome
- LinkedIn Organic sync stops failing on `timeIntervals`
- Organic snapshots start saving under `platform = linkedin`
- Dashboard can display LinkedIn Organic data once the snapshot exists
- LinkedIn Ads remains fully separate and unchanged
