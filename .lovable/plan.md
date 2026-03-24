

# Plan: Remove Emojis, Restructure AI Analysis, Add Rate Limit

## Changes

### 1. Remove emoji from Audience & Demographics (line 793)
**File:** `src/components/clients/ClientDashboard.tsx`
- Replace `👥 Audience & Demographics` with a Lucide `Users` icon + text (same pattern as other card titles)

### 2. Move AI Analysis: button at top, dialog for output, saved card
**File:** `src/components/clients/ClientDashboard.tsx`

- Remove the current AI Analysis `<Card>` block (lines 765-788)
- Add a "Generate AI Analysis" `<Button>` with `<Sparkles>` icon next to the DashboardHeader (top of the page, after the last-synced line)
- Import `Dialog` components from shadcn
- On click: call `handleAnalyse`, show result in a `<Dialog>` (scrollable, prose-formatted)
- Store `aiAnalysis` + `aiAnalysisDate` in state
- Below the button area, if `aiAnalysis` exists, render a compact saved-analysis `<Card>` showing the analysis text with a timestamp and a "View Full Analysis" button that reopens the dialog
- Add `analysisDialogOpen` boolean state

### 3. Rate limit AI analysis (client-side + edge function)
**File:** `src/components/clients/ClientDashboard.tsx`
- Track `lastAnalysisTime` in state; disable the button for 60 seconds after each call
- Show countdown on disabled button: "Wait Xs"

**File:** `supabase/functions/analyze-client/index.ts`
- Add a simple per-client rate limit: query `monthly_snapshots` or use a timestamp check — actually simpler: check a `last_analysis_at` field. Instead, use in-memory Deno `Map` keyed by `client_id` with a 60-second cooldown. Return 429 if called too soon.

## Technical Details
- Dialog uses existing shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
- The saved analysis card is a small collapsible card below the header area
- Rate limit: 60-second cooldown per client, enforced both client-side (button disabled) and server-side (edge function returns 429)
- No database changes needed

