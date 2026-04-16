

# Fix: Realtime Channel Crash on Client Detail Page

## Problem

The `useSyncJobs` hook creates a Supabase realtime channel named `sync-jobs-${clientId}`. When React's strict mode (or fast re-renders) unmounts and remounts the effect, `supabase.channel()` returns the **already-subscribed** channel object. Calling `.on()` on an already-subscribed channel throws the error shown in the screenshot, which bubbles up to the ErrorBoundary and kills the entire page.

## Fix

**File: `src/hooks/useSyncJobs.ts`** (lines 54-78)

Before creating the channel, remove any existing channel with the same name. This ensures a fresh channel is always created:

```typescript
useEffect(() => {
  if (!clientId) return;

  fetchJobs();

  const channelName = `sync-jobs-${clientId}`;

  // Remove any stale channel with the same name before creating a new one
  const existing = supabase.channel(channelName);
  supabase.removeChannel(existing);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sync_jobs',
        filter: `client_id=eq.${clientId}`,
      },
      () => {
        fetchJobs();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [clientId, fetchJobs]);
```

One file, ~3 lines changed. No other changes needed.

