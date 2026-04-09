

# Fix: Scope Initial Sync to Only the Newly Connected Platform

## Problem
`handlePickerComplete` in `ClientDetail.tsx` (line 278-301) runs after account selection in the AccountPickerDialog. It queries **all** connected platforms for the client, then filters to those without existing snapshots. This means if you just connected Instagram but Facebook and Meta Ads also have no snapshots yet (e.g. they're still syncing), the system triggers sync for all three — causing duplicate/runaway syncs every time a new platform is added.

The same issue exists in the `oauthConnected` handler (line 87-117) but is less severe since it only syncs the single connection that just completed OAuth.

## Root Cause
`handlePickerComplete` has no knowledge of **which** connection just had its account selected. It broadly checks all connections missing data.

## Fix

### `src/pages/clients/ClientDetail.tsx`
1. Pass the `pickerConnection` (the specific connection that was just configured) into `handlePickerComplete` so it knows exactly which platform to sync.
2. Change `handlePickerComplete` to only sync **that one connection** instead of scanning all connections for missing snapshots.

Before:
```ts
const handlePickerComplete = async () => {
  await fetchData();
  const { data: updatedConns } = await supabase
    .from('platform_connections').select('*').eq('client_id', id!)
    .eq('is_connected', true).not('account_id', 'is', null);
  // ... finds ALL platforms without snapshots and syncs them all
};
```

After:
```ts
const handlePickerComplete = async () => {
  await fetchData();
  if (!pickerConnection) return;
  // Re-fetch the specific connection to get updated account_id
  const { data: conn } = await supabase
    .from('platform_connections').select('*')
    .eq('id', pickerConnection.id).single();
  if (!conn || !conn.account_id || !conn.is_connected) return;
  const months = await getSyncMonths();
  setSyncStartTime(Date.now());
  triggerInitialSync(conn.id, conn.platform, months, (progress) => {
    setActiveSyncs(prev => new Map(prev).set(conn.platform, progress));
  }).then(results => {
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) console.error(`Sync errors for ${conn.platform}:`, failures);
    setActiveSyncs(prev => { const next = new Map(prev); next.delete(conn.platform); return next; });
    fetchData();
  });
  toast.success('Historical data sync started — progress shown below');
};
```

This ensures only the platform whose account was just selected gets synced. No other files need changes.

