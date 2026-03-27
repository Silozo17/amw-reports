

## Scheduled Client Deletion with Name Confirmation

### What changes

**1. Database migration** — Add a `scheduled_deletion_at` timestamp column to `clients` table (nullable, default null). When set, it means the client is queued for deletion at that time.

**2. Backend function: `process-scheduled-deletions`** — A new edge function (invoked by cron or manually) that deletes clients where `scheduled_deletion_at <= now()`. This ensures actual deletion happens server-side after 24h.

**3. Updated delete flow in `ClientDetail.tsx`**:
- Replace the current `AlertDialog` with a `Dialog` containing:
  - Text: "Type **{client name}** to confirm"
  - An input field the user must type the exact client name into
  - A "Confirm" button, disabled until the typed text matches the client name exactly
- On confirm: sets `scheduled_deletion_at = now() + 24h` on the client row (no immediate delete)

**4. Delete button becomes a countdown / cancel button**:
- When `client.scheduled_deletion_at` is set and in the future:
  - The delete button transforms into a countdown timer showing remaining time (e.g. "23h 41m") with "Cancel Delete" text
  - Clicking it sets `scheduled_deletion_at = null`, cancelling the deletion
- When not set: shows the normal "Delete" button that opens the confirmation dialog

**5. Visual treatment during pending deletion**:
- Show a warning banner at the top of the client detail page: "This client is scheduled for deletion in X hours Y minutes"

### Files to create/edit

| File | Action |
|---|---|
| `supabase/migrations/..._add_scheduled_deletion.sql` | Add `scheduled_deletion_at timestamptz` to `clients` |
| `supabase/functions/process-scheduled-deletions/index.ts` | New edge function to execute pending deletions |
| `src/pages/clients/ClientDetail.tsx` | Replace delete dialog, add countdown/cancel logic |
| `src/components/clients/DeleteClientDialog.tsx` | New component: name-confirmation dialog |

### Technical details

- The countdown timer uses `setInterval` (every 60s) to update the displayed time remaining.
- The name match check is case-insensitive trim comparison.
- RLS: the `scheduled_deletion_at` column follows existing client row policies — only org members can update it.
- The edge function queries `SELECT id FROM clients WHERE scheduled_deletion_at <= now()` then runs the existing cascade delete logic for each.

