

# Fix 5 Edge Function Bugs

## Summary
Five bugs across four edge functions need targeted fixes. No new features — just corrections.

---

## Changes

### 1. `invite-org-member/index.ts` — Fix broken CORS import
**Line 2**: Remove `import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";` and replace with an inline `corsHeaders` object matching the pattern used in all other functions.

### 2. `tiktok-ads-connect/index.ts` — Fix wrong platform in state
**Line 63**: Change `platform: "tiktok"` to `platform: "tiktok_ads"` so `oauth-callback` routes to the correct handler.

### 3. `chat-with-data/index.ts` — Fix invalid model name
**Line 187**: Change `"google/gemini-3-flash-preview"` to `"google/gemini-2.5-flash"`.

### 4. `analyze-client/index.ts` — Move log outside auth block
**Line 42**: Move the `console.log(JSON.stringify({...}))` line from inside the `if (authHeader?.startsWith("Bearer "))` block (line 35) to just after `const portalToken = ...` (line 33), before any auth branching. This ensures it fires for all request paths.

### 5. `scheduled-sync/index.ts` — Fix creator plan schedule
**Lines 191-194**: Change the creator plan gate from `now.getDay() !== 1` (Monday-only) to `dayOfMonth !== 4` (4th of month only). The freelance plan keeps its Monday-only gate unchanged.

---

## Files touched
| File | Change |
|---|---|
| `supabase/functions/invite-org-member/index.ts` | Inline corsHeaders, remove broken import |
| `supabase/functions/tiktok-ads-connect/index.ts` | `"tiktok"` → `"tiktok_ads"` |
| `supabase/functions/chat-with-data/index.ts` | Model → `google/gemini-2.5-flash` |
| `supabase/functions/analyze-client/index.ts` | Move structured log before auth branching |
| `supabase/functions/scheduled-sync/index.ts` | Creator plan: day-of-month 4 gate |

All five functions will be redeployed after changes.

