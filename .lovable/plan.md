

## Plan: Fix Voice Briefing Infinite Re-render Loop

### Root Cause
The `VoiceBriefing` component has a dependency cycle in its `useEffect`:

1. `checkExisting` effect depends on `[clientId, month, year, cleanup, setupAudio]`
2. `cleanup` is a `useCallback` that depends on `audioUrl` state
3. `setupAudio` calls `setAudioUrl(url)`, which changes `audioUrl`
4. Changed `audioUrl` → new `cleanup` reference → effect re-fires → calls `cleanup()` (destroys audio) → fetches again → loop

This means the audio gets created, then immediately destroyed, then re-fetched, destroyed again — the user sees "Loading..." or a broken player.

### Fix

**File: `src/components/clients/dashboard/VoiceBriefing.tsx`**

1. Remove `audioUrl` from `cleanup`'s dependency — use a ref to track the current blob URL instead of reading from state
2. Store the blob URL in a ref (`audioUrlRef`) alongside the state, so `cleanup` can revoke it without depending on `audioUrl` state
3. Remove `cleanup` and `setupAudio` from the `useEffect` dependency array — use refs for stable references

Specifically:
- Add `const audioUrlRef = useRef<string | null>(null)` 
- In `cleanup`: use `audioUrlRef.current` instead of `audioUrl` state, making cleanup's deps `[]`
- In `setupAudio`: set both `audioUrlRef.current = url` and `setAudioUrl(url)`
- The check-existing `useEffect` will now only depend on `[clientId, month, year]` — no more loop

### Files changed

| File | Change |
|---|---|
| `src/components/clients/dashboard/VoiceBriefing.tsx` | Fix dependency cycle by using refs for cleanup/setup stability |

### No other changes needed
- Edge function works correctly (all 200s in logs)
- Database records exist and are valid
- No backend changes required

