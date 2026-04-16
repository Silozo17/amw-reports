

# Add Per-Connection Sync Button with Rate Limiting

## What It Does
Adds a "Sync" button to each connection row in the Connections tab. The button is only visible to org owners and managers (hidden from client users). Syncing is rate-limited based on the subscription plan:
- **Freelancer & Agency**: once per day per connection
- **Creator**: once per week per connection

The cooldown is determined by checking `last_sync_at` on the connection record.

## Changes

### 1. `src/components/clients/tabs/ClientConnectionsTab.tsx`

- **Add props**: Pass `orgId`, `planSlug`, and `isOrgMember` (owner/manager) into the component and down to `ConnectionRow`
- **Add sync button** to each `ConnectionRow` for connected platforms (has `account_id` and `is_connected`):
  - Uses `useSyncJobs().enqueueSync` to trigger a single-month sync (current month, priority 3)
  - Shows a `RefreshCw` icon button with tooltip
  - Disabled + tooltip explains cooldown when rate limit not met
  - Hidden entirely when `isOrgMember` is false (client users)
- **Rate limit logic**: Inline helper compares `conn.last_sync_at` against:
  - Creator: 7 days ago
  - Freelancer/Agency: 24 hours ago
  - If `last_sync_at` is within the window, button is disabled with "Next sync available: [date]"
- **Spinning state**: Button shows spinning icon when there's an active sync job for that connection (checked against `activeJobs`)

### 2. `src/pages/clients/ClientDetail.tsx` (minor)

- Pass `orgId`, `planSlug` (from `useEntitlements`), and `isOrgMember` (from `useAuth`) as props to `ClientConnectionsTab`

## Technical Details

- No new hooks or files needed — reuses `useSyncJobs` and `useEntitlements` already in scope at `ClientDetail`
- Rate limiting is purely UI-enforced via `last_sync_at` comparison (server-side the sync queue already deduplicates pending jobs)
- `planSlug` values: `'creator'`, `'freelancer'`, `'agency'`
- Current month/year calculated via `new Date()` at click time
- The sync enqueues with `months: 1` and `target_months` for current month only

