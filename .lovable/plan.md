

# Fix Voice Briefing: Per-Month State, Storage Persistence, Daily Rate Limit

## Problem
1. **Stuck audio**: Component holds a single `audioUrl` in state. When user switches month/year, the old audio persists — they can't generate a new briefing for a different period.
2. **No persistence**: Generated audio lives only as a browser blob URL. Refreshing the page loses it.
3. **No rate limiting**: Users can regenerate unlimited times, wasting ElevenLabs credits.

## Solution

### 1. New database table: `voice_briefings`
Stores generated recordings metadata and controls rate limiting.

```sql
CREATE TABLE public.voice_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  org_id uuid NOT NULL,
  report_month integer NOT NULL,
  report_year integer NOT NULL,
  storage_path text NOT NULL,
  generated_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, report_month, report_year)
);

ALTER TABLE public.voice_briefings ENABLE ROW LEVEL SECURITY;

-- Org members can view/manage
CREATE POLICY "Org members can manage voice briefings" ON public.voice_briefings
  FOR ALL TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

-- Client users can view
CREATE POLICY "Client users can view voice briefings" ON public.voice_briefings
  FOR SELECT TO authenticated
  USING (is_client_user(auth.uid(), client_id));
```

The UNIQUE constraint on `(client_id, report_month, report_year)` means each month gets exactly one recording. Regenerating replaces it (upsert), but the old file stays in storage with a timestamped path for history.

### 2. Update edge function: `voice-briefing/index.ts`
- **Check for existing recording**: Before generating, query `voice_briefings` for the requested month.
- **Rate limit**: If a recording exists and `generated_at` is within the last 24 hours (adjusted: regeneration allowed 1 hour after last sync), return 429.
- **Store audio**: Upload the MP3 to the `reports` storage bucket at path `voice-briefings/{client_id}/{year}-{month}/{timestamp}.mp3`.
- **Upsert metadata**: Insert/update the `voice_briefings` row with the new storage path.
- **Return audio**: Still return the MP3 binary directly.
- **New `GET` mode**: Accept a query param or body flag `check_existing=true` that returns metadata (storage path, generated_at) without generating — so the frontend can load existing recordings instantly.

Rate limit logic:
```text
can_regenerate = no existing recording
  OR generated_at < (last_sync_at + 1 hour)  -- sync happened, wait 1h, then allow
  OR generated_at is older than 24 hours       -- fallback daily reset
```

### 3. Rewrite frontend component: `VoiceBriefing.tsx`
- **Reset state on month/year change**: Use `useEffect` watching `month` and `year` to clear audio state and check for existing recordings.
- **Load existing on mount**: On mount or period change, query `voice_briefings` table via Supabase client to check if a recording already exists for this month.
- **If exists**: Fetch audio from storage, set up playback immediately (show "Play" not "Generate").
- **If not**: Show "Voice Briefing" button to generate.
- **Rate limit feedback**: If the edge function returns 429, show a toast with when regeneration will be available.
- **Cleanup**: Revoke old blob URLs on unmount or period change.

### 4. Storage bucket
Use the existing `reports` bucket (private). Voice briefing files stored under `voice-briefings/` prefix.

## Files to create/update
- **Migration**: Create `voice_briefings` table with RLS
- `supabase/functions/voice-briefing/index.ts` — add storage, rate limiting, existing-check
- `src/components/clients/dashboard/VoiceBriefing.tsx` — reset on period change, load existing, rate limit UX

## How old recordings are kept
Each generation writes a new timestamped file (`{timestamp}.mp3`). The `voice_briefings` row points to the latest. Old files remain in storage but aren't referenced — they serve as an archive. The UNIQUE constraint ensures only one "current" recording per month.

