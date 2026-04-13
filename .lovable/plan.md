
Goal: fix LinkedIn Organic properly, based on the April 2026 docs and the actual failure in your screenshots, without touching LinkedIn Ads.

Do I know what the issue is? Yes.

What’s actually wrong
1. The current Organic sync is sending the wrong query format.
   - `sync-linkedin` sends `X-Restli-Protocol-Version: 2.0.0`
   - but still builds time-bound requests with dotted params like:
     - `timeIntervals.timeGranularityType=MONTH`
     - `timeIntervals.timeRange.start=...`
     - `timeIntervals.timeRange.end=...`
   - Your LinkedIn 400 screenshot matches this exactly: `QUERY_PARAM_NOT_ALLOWED`.
   - With Rest.li 2.0, those requests must use a single `timeIntervals=(...)` param instead.

2. Brand/showcase pages still hit the wrong page-stats endpoint.
   - Current code always calls `organizationPageStatistics`
   - April 2026 docs show brand pages must use:
     - `brandPageStatistics?q=brand&brand=urn:li:organizationBrand:...`

3. The backend snapshot I checked currently has:
   - `0` `linkedin` rows
   - `1` `linkedin_ads` row
   So part of this needs a full audit of the connection flow itself: either Organic is not being persisted, or the UI is surfacing the wrong connection state.

4. Organic and Ads are separate in routing already, but I need to harden the UI/backend so they cannot be confused in practice.

Implementation plan
1. Audit the LinkedIn Organic connection flow end-to-end
   - trace creation of a new `linkedin` connection row
   - verify OAuth callback updates the same organic row
   - verify the picker saves `account_id` and `metadata.selected_organization`
   - confirm the UI is not showing a `linkedin_ads` row as Organic

2. Fix request construction in `supabase/functions/sync-linkedin/index.ts`
   - replace all time-bound LinkedIn stat requests with proper Rest.li 2.0 `timeIntervals=(...)` syntax
   - build URLs with `URL` / `URLSearchParams` instead of manual string concatenation
   - keep URNs encoded correctly

3. Route Organic page-stat calls by entity type
   - `urn:li:organization:*` → `organizationPageStatistics`
   - `urn:li:organizationBrand:*` → `brandPageStatistics`
   - keep share stats using the correct organic endpoint
   - verify follower stats behavior for brand pages against docs and fail clearly if unsupported

4. Re-check OAuth discovery and selection persistence
   - ensure Organic discovery stores full URN + `entityType`
   - ensure the selected Organic page is the one used for sync
   - ensure Ads metadata remains completely separate

5. Make Organic failures explicit
   - preserve fail-fast behavior
   - store the exact LinkedIn API error on the connection
   - stop any “connected but silently wrong” state for Organic

6. Validate after implementation
   - create/reconnect a real `linkedin` Organic connection
   - confirm the backend contains a `linkedin` row, not just `linkedin_ads`
   - trigger Organic sync
   - verify no more `QUERY_PARAM_NOT_ALLOWED` errors
   - verify snapshots contain real Organic metrics
   - verify the Connections tab and dashboard show LinkedIn Organic data correctly

Files to update
- `supabase/functions/sync-linkedin/index.ts`
- `supabase/functions/oauth-callback/index.ts`
- `src/components/clients/AccountPickerDialog.tsx`
- likely the connection UI file(s) that surface connection state:
  - `src/components/clients/tabs/ClientConnectionsTab.tsx`
  - possibly `src/pages/ClientPortalAuth.tsx` / `src/pages/Connections.tsx`

Expected outcome
- LinkedIn Organic uses the correct April 2026 request format
- Company pages and brand/showcase pages use the right Organic endpoints
- Organic and Ads remain fully separate in both storage and UI
- a real LinkedIn Organic page can be connected and synced without the current 400 errors

No database schema changes expected.
