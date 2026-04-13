
Scope confirmed: this is a LinkedIn organic pages fix only. LinkedIn organic and LinkedIn Ads are already wired as separate integrations in this codebase, and I would keep them separate.

What I verified
- Organic uses `linkedin-connect` + `sync-linkedin` with `LINKEDIN_CLIENT_ID/SECRET`.
- Ads uses `linkedin-ads-connect` + `sync-linkedin-ads` with `LINKEDIN_ADS_CLIENT_ID/SECRET`.
- So the main problem is not that ads and organic are mixed together globally. The real issue is that the organic flow still has company-page-only assumptions and a frontend metric mismatch.

What is still wrong in the current organic setup
1. OAuth discovery loses the real LinkedIn entity identity
- `handleLinkedIn` in `supabase/functions/oauth-callback/index.ts` fetches `organizationAcls` correctly with `role=ADMINISTRATOR&state=APPROVED`.
- But it only stores `{ id, name }` and strips the full URN.
- The April 2026 docs make clear organic pages can be:
  - `urn:li:organization:{id}` for company pages
  - `urn:li:organizationBrand:{id}` for showcase/brand pages
- Right now the code throws away that distinction.

2. The picker is still wrong for LinkedIn organic
- `AccountPickerDialog.tsx` shows LinkedIn organizations separately, which is good.
- But it allows multi-select behavior for LinkedIn even though the backend only supports one selected page.
- Worse: it does not actually require a LinkedIn page to be selected before saving.
- If nothing is selected, save can still clear `account_id/account_name`.
- If multiple are selected, it just picks the first match from the array order, not the actual intended page.

3. Organic sync rebuilds the wrong URN
- `sync-linkedin/index.ts` always rebuilds the entity as `urn:li:organization:${id}`.
- That is wrong for showcase/brand pages and is the biggest setup flaw I found.
- The selected entity’s original URN/type must be stored and reused exactly.

4. The sync output does not match what the dashboard expects
- Sync currently writes keys like:
  - `follower_gains_organic`
  - `follower_gains_paid`
  - `page_views_desktop`
  - `page_views_mobile`
- But the dashboard/config expects LinkedIn keys like:
  - `follower_growth`
  - `follower_removes`
  - `page_views`
- So even if sync succeeds, important data can still appear missing or poorly surfaced.

5. The organic sync still drops debugging value
- It now fails louder on core calls, which is good.
- But it still writes `raw_data: {}` so there is no useful stored payload for diagnosis when metrics look wrong.
- Top-content is still best-effort, which is fine, but core stat responses should be preserved enough to debug.

Implementation plan
1. Fix LinkedIn organic discovery in `supabase/functions/oauth-callback/index.ts`
- Keep the current organic and ads handlers fully separate.
- For organic only, store each discovered page with full metadata:
  - `id`
  - `name`
  - `urn`
  - `entityType` (`organization` vs `organizationBrand`)
- Use the correct lookup flow per April 2026 docs instead of assuming every entity can be treated as a plain company organization.
- Keep `role=ADMINISTRATOR` and `state=APPROVED`.
- Add pagination handling for discovery so all administered pages can be listed.

2. Fix LinkedIn organic selection UX in `src/components/clients/AccountPickerDialog.tsx`
- Change LinkedIn organic from multi-select UI to true single-select.
- Block save until exactly one LinkedIn page is chosen.
- Save:
  - `account_id`
  - `account_name`
  - `metadata.selected_organization = { id, name, urn, entityType }`
- Keep LinkedIn Ads selection logic untouched.

3. Rewrite organic sync to use the saved entity URN exactly in `supabase/functions/sync-linkedin/index.ts`
- Stop reconstructing `urn:li:organization:${id}`.
- Read `metadata.selected_organization.urn` and use that exact URN in all organic API calls.
- Validate entity type before calling endpoints; if a specific endpoint does not support the chosen entity type, fail with a clear error instead of saving zeros.

4. Align parsing and metric names with the dashboard
- Keep the April 2026 response parsing fixes.
- Write dashboard-compatible LinkedIn organic metrics such as:
  - `total_followers`
  - `follower_growth`
  - `impressions`
  - `engagement`
  - `engagement_rate`
  - `likes`
  - `comments`
  - `shares`
  - `clicks`
  - `page_views`
  - `posts_published`
- If useful, keep detailed breakdown keys too, but not instead of the UI keys.
- Update `src/types/database.ts` and, if needed, `src/components/clients/dashboard/PlatformSection.tsx` so LinkedIn organic clearly surfaces page views and follower growth.

5. Preserve real diagnostics
- Store meaningful `raw_data` for the organic snapshot or at least a structured debug summary of the core endpoint responses used.
- Keep fail-fast behavior for required endpoints.
- Ensure `last_error` and sync log messages reflect the real LinkedIn API failure.

6. Validate end-to-end against the current connection
- Reuse the current LinkedIn organic connection if it already has a valid token.
- Reconnect only if the saved metadata lacks the full URN/type needed for organic sync.
- Verify:
  - picker shows real LinkedIn organic pages only
  - LinkedIn Ads remains unchanged
  - selected organic page saves correctly
  - sync uses one selected page only
  - snapshot contains real LinkedIn organic metrics
  - dashboard shows those metrics under LinkedIn

Files I expect to change
- `supabase/functions/oauth-callback/index.ts`
- `src/components/clients/AccountPickerDialog.tsx`
- `supabase/functions/sync-linkedin/index.ts`
- `src/types/database.ts`
- possibly `src/components/clients/dashboard/PlatformSection.tsx`

Database changes
- None expected.

Main conclusion
The organic and ads integrations are already separated at the routing/function level. The remaining breakage is inside the organic path itself:
- discovery drops the real page URN/type
- selection is ambiguous and can save no page at all
- sync assumes every organic page is `urn:li:organization:*`
- synced metric keys do not line up with what the dashboard renders

That is the part I would fix next, strictly against the April 2026 LinkedIn Community Management docs, without touching LinkedIn Ads behavior.
