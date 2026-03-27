

## Fix Connection Flow Issues

### 4 Issues to Address

**1. Remove redundant Facebook Page step from Meta Ads flow**

The Meta Ads OAuth callback (`handleMetaAds`) only discovers `ad_accounts` — it never populates `pages`. But `AccountPickerDialog` always renders a 3-step wizard (Ad Account → Facebook Page → Confirm) for `meta_ads`. Step 2 always shows "No Facebook Pages discovered."

**Fix**: Change the Meta Ads picker from a 3-step wizard to a 2-step flow (Ad Account → Confirm). Remove the `pages` step entirely since Meta Ads is ads-only. The pages step only belongs in the standalone Facebook connection flow.

- Edit: `src/components/clients/AccountPickerDialog.tsx` — update the step indicator and navigation to skip the `pages` step when `platform === 'meta_ads'`

**2. Add search/filter to account picker**

Currently the account list has no search. When users have many accounts, finding the right one is tedious.

**Fix**: Add a search input at the top of every account list in `AccountPickerDialog.tsx`. Filter the displayed accounts by matching the search text against `acct.name` (case-insensitive). Apply to both the Meta multi-step flow and the single-step flow.

- Edit: `src/components/clients/AccountPickerDialog.tsx` — add `searchQuery` state, an `<Input>` with search icon, and filter `accounts` / `pages` / `organizations` before rendering

**3. Paginate API discovery calls so all accounts appear**

The Meta `/me/adaccounts` endpoint defaults to 25 results. Same for `/me/accounts` (Facebook pages). Users with many accounts see a truncated list.

**Fix**: Add cursor-based pagination loops to the OAuth callback discovery functions. After each fetch, check for `paging.next` and keep fetching until all results are collected. Apply to: `handleMetaAds` (ad accounts), `handleFacebook` (pages), `handleInstagram` (pages). Also increase the UI `max-h-64` to `max-h-96` for more visible items.

- Edit: `supabase/functions/oauth-callback/index.ts` — add pagination loop to Meta/Facebook/Instagram discovery
- Edit: `src/components/clients/AccountPickerDialog.tsx` — increase scroll container height

**4. Google Ads account names not displaying**

The current code calls `GET /v20/customers/{custId}` with `login-customer-id: custId`. This fails with `USER_PERMISSION_DENIED` for client accounts accessed through a manager account — the `login-customer-id` must be the manager account ID, not the client's own ID.

From Google Ads API docs: `listAccessibleCustomers` returns resource names but no descriptive names. To get names, you must use `GoogleAdsService.SearchStream` with query `SELECT customer_client.descriptive_name, customer_client.client_customer FROM customer_client WHERE customer_client.level <= 1` — and this requires calling from the manager account context.

**Fix**: After `listAccessibleCustomers`, identify which returned customer IDs are manager accounts (try fetching each, manager accounts allow self-referencing `login-customer-id`). Then for each manager, run a GAQL query to get `customer_client.descriptive_name` for all sub-accounts. For accounts that aren't under a manager, the existing direct fetch approach works. Fall back to `Google Ads (ID)` only when names truly can't be retrieved.

- Edit: `supabase/functions/oauth-callback/index.ts` — refactor `handleGoogleAds` discovery to use GAQL `customer_client` query from manager accounts

### Files to edit

| File | Change |
|---|---|
| `src/components/clients/AccountPickerDialog.tsx` | Remove FB page step from Meta Ads wizard, add search input, increase list height |
| `supabase/functions/oauth-callback/index.ts` | Add pagination to Meta/FB/IG discovery, fix Google Ads name resolution via GAQL |

