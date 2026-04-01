

# Fix Voice Briefing Access

## Root Cause

**Bug 1 — Wrong token (frontend):** `VoiceBriefing.tsx` sends the Supabase anon key as the Authorization header instead of the user's session JWT. The edge function then calls `getClaims()` on the anon key, which has no `sub` claim → 401 for everyone, or gets a nonsensical caller ID.

**Bug 2 — Incomplete access check (edge function):** Even if the token were correct, the function only checks `org_members`. Client portal users (in `client_users` table) and platform admins are denied.

## Changes

### 1. `src/components/clients/dashboard/VoiceBriefing.tsx`
- Import `supabase` client and get the user's session token via `supabase.auth.getSession()`
- Send `session.access_token` as the Authorization Bearer token instead of the anon key

### 2. `supabase/functions/voice-briefing/index.ts`
- Replace the `getClaims` approach with `supabase.auth.getUser(token)` which reliably extracts the user from a JWT
- Replace the single `org_members` check with a three-way access check:
  1. `org_members` — org owners/managers
  2. `client_users` — client portal users for this specific client
  3. `platform_admins` — platform admins (full access)
- If none match → 403

## Files Changed

| File | Change |
|---|---|
| `src/components/clients/dashboard/VoiceBriefing.tsx` | Use session JWT instead of anon key |
| `supabase/functions/voice-briefing/index.ts` | Use `getUser()`, add client_users + platform_admins access checks |

