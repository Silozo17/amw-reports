

## Granular Sync Controls for Admin Org Detail

### What changes

Replace the single "Sync All (12 months)" button with a flexible sync dialog that lets admins choose the scope of their sync.

**New `SyncDialog` component** with 4 sync scope options:

1. **Single Channel** — Pick a client, then pick one of its connected channels → sync only that connection for 12 months
2. **Single Client** — Pick a client → sync all its active connections for 12 months
3. **Whole Organisation** — Sync all active connections across all clients (current behaviour)
4. **Whole Platform** — Pick a platform (e.g. "Google Ads") → sync only that platform's connections across all clients

**UI flow:**
- Admin clicks "Sync (12 months)" button → Dialog opens
- Step 1: Select scope via radio group (Channel / Client / Organisation / Platform)
- Step 2: Depending on scope, show a filtered dropdown/select:
  - Channel: Client select → Channel select (filtered to selected client's active connections)
  - Client: Client select
  - Organisation: No further selection needed
  - Platform: Platform select (populated from distinct platforms in active connections)
- Step 3: Confirm button starts the sync with progress display

The existing inline bulk sync logic moves into the dialog's confirm handler, filtered by scope.

### Files to create/edit

| File | Action |
|---|---|
| `src/components/admin/AdminSyncDialog.tsx` | New component with scope selection + filtered sync execution |
| `src/pages/admin/AdminOrgDetail.tsx` | Replace inline sync button/logic with `<AdminSyncDialog>` trigger |

### Technical details

- Props: `clients`, `connections`, `onComplete` callback (to invalidate queries)
- Reuses `SYNC_FUNCTION_MAP` from `@/lib/triggerSync`
- Scope filtering logic determines which subset of `connections` to iterate over
- Progress string updates per-month as before
- Uses existing `Select`, `RadioGroup`, `Dialog`, `Button` UI components

