

# Fix AI Feature Access for All User Types + Rate Limiting

## Problem

Two edge functions (`chat-with-data` and `analyze-client`) have the same bugs previously fixed in `voice-briefing`:

1. **`AiChatDrawer.tsx`** sends the Supabase anon key as the Authorization header instead of the user's session JWT — causes 401 for everyone
2. **Both edge functions** only check `org_members` for authorization — blocks client portal users and platform admins
3. **Share-link portal users** (unauthenticated) have no access path at all — they need to pass their portal share token as an alternative identity

## Changes

### 1. `src/components/clients/dashboard/AiChatDrawer.tsx`
- Import `supabase` client
- Get user session via `supabase.auth.getSession()`
- If session exists, send `access_token` as Bearer token
- If no session (portal user), accept a `portalToken` prop and send it as `x-portal-token` header instead
- Fall back gracefully if neither exists

### 2. `src/components/clients/ClientDashboard.tsx`
- Pass `portalToken` prop through to `AiChatDrawer`

### 3. `supabase/functions/chat-with-data/index.ts`
- Replace `getClaims` with `supabase.auth.getUser(token)` for JWT callers
- Add `x-portal-token` header support: validate via `client_share_tokens` table (same pattern as `portal-data`)
- Resolve actor as either `user.id` or `share_token_id`
- Expand access check to: `org_members` OR `client_users` OR `platform_admins` OR valid portal token
- Add in-memory rate limiting (30 requests per actor per 60s window) — keyed by resolved actor ID

### 4. `supabase/functions/analyze-client/index.ts`
- Same auth changes: `getUser()` + portal token fallback + three-way access check
- Already has rate limiting — update to key by resolved actor ID instead of just `client_id`

## Rate Limiting Strategy

All AI functions will use the same pattern:
- In-memory map keyed by actor identifier (user ID or share token ID)
- 30 requests per 60-second window
- Returns 429 with human-readable wait time

## Files Changed

| File | Change |
|---|---|
| `src/components/clients/dashboard/AiChatDrawer.tsx` | Use session JWT; accept + send portal token |
| `src/components/clients/ClientDashboard.tsx` | Pass `portalToken` to AiChatDrawer |
| `supabase/functions/chat-with-data/index.ts` | Dual auth (JWT + portal token), expanded access, rate limit |
| `supabase/functions/analyze-client/index.ts` | Dual auth (JWT + portal token), expanded access |

