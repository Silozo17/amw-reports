

## Show Pending Deletion on Client Cards & Dashboard

### What changes

**1. Client List (`/clients`) — `ClientList.tsx`**
- Fetch `scheduled_deletion_at` alongside existing client fields (already in the `select('*')`)
- For each client card where `scheduled_deletion_at` is set and in the future:
  - Replace the Active/Inactive badge with a red "Deleting in Xh Ym" countdown badge
  - Add a subtle red border or red background tint to the card to visually distinguish it
- Add a `useEffect` with `setInterval` (every 60s) to tick countdown values

**2. Dashboard (`/dashboard`) — `Index.tsx`**
- In the `fetchStats` query, also fetch clients with `scheduled_deletion_at` in the future
- Add a new "Pending Deletion" attention card (similar to "Needs Attention" section) that lists clients scheduled for deletion with their countdown timers
- Only shown when there are clients pending deletion
- Each row links to the client detail page where deletion can be cancelled

### Files to edit

| File | Change |
|---|---|
| `src/pages/clients/ClientList.tsx` | Add countdown badge + red tint on cards for clients pending deletion |
| `src/pages/Index.tsx` | Add "Pending Deletion" notice section with countdown timers |

### Technical details

- Countdown helper: shared inline function `formatCountdown(scheduledAt: string)` returns `"Xh Ym"` string from the difference between `scheduledAt` and `now`
- `setInterval` at 60s updates a `now` state to re-trigger countdown renders
- No new components needed — changes are inline within existing card markup
- Dashboard uses a separate query for pending-deletion clients: `supabase.from('clients').select('id, company_name, scheduled_deletion_at').not('scheduled_deletion_at', 'is', null).gt('scheduled_deletion_at', new Date().toISOString()).eq('org_id', orgId)`

