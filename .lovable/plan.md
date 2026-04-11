
Goal: fix LinkedIn organic properly against the Community Management docs so a connected LinkedIn page can be selected, synced, and rendered with real stats instead of silent zeroes.

What I found in the current code:
1. `src/components/clients/AccountPickerDialog.tsx` is partly wired to the wrong metadata for LinkedIn:
   - `platform === 'linkedin'` currently reads `metadata.ad_accounts` in `getAccountOptions()`
   - LinkedIn organic discovery is actually stored in `metadata.organizations`
   This is a bad mismatch and can break selection/change flow.

2. `supabase/functions/sync-linkedin/index.ts` is hiding real API failures:
   - every LinkedIn helper catches errors and returns `0` / empty arrays
   - that means the app can save a “successful” zero snapshot even when the API call actually failed
   This is the main “stop guessing” issue.

3. The page stats parser is wrong versus the docs:
   - current code reads `views.allPageViews`
   - the docs show nested objects like `views.allPageViews.pageViews`
   So page-view metrics are being parsed incorrectly.

4. OAuth org discovery needs tightening to match the docs:
   - current callback uses `organizationAcls?q=roleAssignee&role=ADMINISTRATOR`
   - docs also show approved-role filtering
   - current code assumes only `urn:li:organization:*`; the docs also mention `urn:li:organizationBrand:*`
   We should store the full URN and not assume every page is the same entity type.

Implementation plan:
1. Inspect live backend state first
   - check the current LinkedIn connection row, recent sync logs, recent snapshots, and `sync-linkedin` function logs for this client
   - confirm the exact failing endpoint(s) before editing anything

2. Fix LinkedIn page discovery in OAuth callback
   - update `supabase/functions/oauth-callback/index.ts`
   - make org discovery follow the Community Management access-control docs
   - filter to approved admin entries
   - preserve the full organizational entity URN/type
   - fetch display names safely for both organization and brand/showcase entities
   - store clean LinkedIn organic metadata for the picker

3. Fix the LinkedIn account picker
   - update `src/components/clients/AccountPickerDialog.tsx`
   - make LinkedIn organic read from `metadata.organizations`, not `metadata.ad_accounts`
   - save the selected LinkedIn page cleanly into `account_id`, `account_name`, and `metadata.selected_organization`
   - keep the existing Meta/other-platform behavior unchanged

4. Rewrite LinkedIn sync to be doc-driven and fail-fast
   - update `supabase/functions/sync-linkedin/index.ts`
   - keep sync scoped to the selected LinkedIn page only
   - verify each endpoint against the Community Management docs:
     - org/page access
     - follower statistics
     - share statistics
     - page statistics
   - fix response parsing, especially nested page-view objects
   - stop swallowing endpoint errors; if a required endpoint fails, mark the sync failed and persist the real error
   - only treat optional data as optional if the docs clearly support that behavior

5. Align stored LinkedIn metrics with the dashboard
   - if the sync now produces keys like follower gains/page views that are not surfaced well, update the frontend metric labels/order so LinkedIn stats render clearly
   - likely files:
     - `src/types/database.ts`
     - possibly `src/components/clients/dashboard/PlatformSection.tsx`
   This is only to display the fixed sync data properly, not a UI redesign.

6. Validate end-to-end after deployment
   - reconnect only if the existing connection metadata is invalid; otherwise reuse the existing connection
   - verify:
     - page picker shows real LinkedIn pages
     - selected page saves correctly
     - sync logs show actual success/failure details
     - `monthly_snapshots` contains non-zero LinkedIn metrics where data exists
     - the client dashboard renders the LinkedIn section with the synced stats

Files likely to change:
- `supabase/functions/oauth-callback/index.ts`
- `supabase/functions/sync-linkedin/index.ts`
- `src/components/clients/AccountPickerDialog.tsx`
- possibly `src/types/database.ts`
- possibly `src/components/clients/dashboard/PlatformSection.tsx`

Database changes:
- none expected

Important behavior change:
- after this fix, LinkedIn sync errors will no longer be silently converted into zero data; they will surface as real sync failures, which is what we want while stabilizing this integration.
