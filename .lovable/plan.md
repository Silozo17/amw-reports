

# Plan: Add Account Picker After OAuth Connection

## The Problem

Right now, when you connect via OAuth, the system auto-picks the first account it finds. But you manage multiple clients, each with their own ad account / Facebook page / Instagram account. You need to **choose** which one belongs to each client.

## How It Will Work (New Flow)

1. You go to a client, click "Add Connection", select a platform, click "Add & Connect"
2. You get redirected to Facebook/Google/etc. to grant access — this part stays the same
3. After granting access, you come back to the client page
4. **NEW:** A picker dialog automatically opens showing all discovered accounts/pages
5. You select the correct ad account, Facebook page, and/or Instagram account for that client
6. The connection saves with your chosen account

## Technical Changes

### 1. Update `oauth-callback/index.ts`
- Stop auto-selecting the first account — just store ALL discovered accounts in `metadata`
- Set `is_connected = true` but leave `account_id` and `account_name` as `null` (meaning "needs selection")
- Add a query param `oauth_pending_selection=true` to the redirect URL

### 2. Create new component: `src/components/clients/AccountPickerDialog.tsx`
- Opens automatically when `oauth_pending_selection` is detected in URL params
- Reads the connection's `metadata` to show available options:
  - **Meta Ads**: Shows list of ad accounts + Facebook pages + linked Instagram accounts with checkboxes
  - **Google Ads**: Shows list of accessible customer accounts
  - **TikTok**: Shows list of advertiser accounts
  - **LinkedIn**: Shows list of ad accounts + company pages
- User selects the ones for this client → saves `account_id` and `account_name` to the connection
- For Meta: also creates separate `facebook` and `instagram` connection records for the selected page/IG account

### 3. Update `ConnectionDialog.tsx`
- Add a "Change Account" button on connected platforms so users can re-pick without re-authenticating
- Show the selected account name clearly

### 4. Update `ClientDetail.tsx`
- Detect `oauth_pending_selection` query param
- Find the connection that was just authenticated (no `account_id` yet)
- Open the `AccountPickerDialog` automatically

### Files Changed
- `supabase/functions/oauth-callback/index.ts` — stop auto-selecting first account
- `src/components/clients/AccountPickerDialog.tsx` — new file, the picker UI
- `src/components/clients/ConnectionDialog.tsx` — add "Change Account" button
- `src/pages/clients/ClientDetail.tsx` — wire up the picker dialog on OAuth return

