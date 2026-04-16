

# Add "Sync All" Button to Connections Tab

## What It Does
Adds a "Sync All" button in the CardHeader next to the existing "Connect" button. It syncs all fully-connected connections that are not on cooldown, in a single click. Same visibility and rate-limiting rules as individual sync buttons.

## Changes

### `src/components/clients/tabs/ClientConnectionsTab.tsx`

1. **Derive syncable connections**: Filter `connections` to those that are fully connected (`is_connected && account_id`) and pass cooldown check via `getSyncCooldownInfo`.

2. **Add `handleSyncAll`**: Iterates over syncable connections, calls `enqueueSync` for each (same params as individual sync: `months: 1, priority: 3`). Shows a single toast summarising how many were queued.

3. **Add button in CardHeader**: Place a "Sync All" button (with `RefreshCw` icon) between the title and the ConnectionDialog button. Only visible when `isOrgMember` is true and there's at least one fully connected connection. Disabled when no connections are eligible (all on cooldown) or any sync-all is in progress. Tooltip explains state.

4. **Track sync-all state**: A simple `isSyncingAll` boolean state to disable the button and show spinner during the batch enqueue.

No other files need changes — all props are already passed from `ClientDetail.tsx`.

