

# Security Audit: Comprehensive Vulnerability Analysis

## Summary

After reviewing all RLS policies, Edge Functions, auth flows, and secrets handling, I found **8 vulnerabilities** ranging from critical to low severity.

---

## CRITICAL Findings

### 1. Multiple Edge Functions have NO authentication — any anonymous caller can access them

**Affected functions:**
- `analyze-client` — No auth check. Anyone with a `client_id` can trigger AI analysis, consuming your AI credits and leaking client data.
- `chat-with-data` — No auth check. Anyone can chat with any client's data.
- `voice-briefing` — No auth check. Anyone can generate voice briefings for any client.
- `extract-branding` — No auth check. Anyone can trigger Firecrawl scraping on arbitrary URLs.
- `google-places-lookup` — No auth check. Anyone can use your Google API key for Places lookups.

**Impact:** Data leakage (any client's metrics visible to unauthenticated users), AI/API credit abuse, and potential cost explosion. An attacker only needs to guess or enumerate UUIDs.

**Fix:** Add authentication checks at the top of each function — verify the caller's JWT, resolve their org, and confirm they belong to the org that owns the `client_id`.

### 2. `generate-report` auth check is AFTER the report upsert and is optional

Lines 1084-1108 show the function creates/updates a report record BEFORE checking auth. The auth check is also wrapped in `if (authHeader && client.org_id)` — if no auth header is sent, the function proceeds without any authorization, allowing anyone to generate reports for any client.

**Fix:** Move the auth check to the top of the function and make it mandatory.

---

## HIGH Findings

### 3. Hardcoded META_APP_ID fallback leaks your App ID

5 files contain `Deno.env.get("META_APP_ID") || "1473709394207184"`. If the env var is ever unset, the fallback exposes your real Meta App ID in source code. More critically, the `META_APP_ID` secret exists in your secrets — the fallback is unnecessary and creates a false sense of safety.

**Fix:** Remove the `|| "1473709394207184"` fallback from all files. Use `Deno.env.get("META_APP_ID")!` and fail explicitly if missing.

### 4. OAuth tokens stored in plain text (documented debt, but still HIGH)

`platform_connections.access_token` and `refresh_token` are stored as plain text. Any SQL injection or RLS bypass would expose all connected OAuth tokens for every platform.

**Status:** Already documented as tech debt. Recommend prioritizing encryption at rest.

### 5. `portal-data` function uses service role key with no rate limiting

The portal-data function accepts a share token and uses the service role key to fetch all client data. There's no rate limiting — an attacker with a valid (or brute-forced) share token can make unlimited requests. Share tokens are 32 bytes hex (64 chars), so brute force is impractical, but leaked tokens have no request throttling.

---

## MEDIUM Findings

### 6. `metric_defaults` — any org owner can manage ALL metric defaults (not scoped to their org)

The RLS policy "Org owners can manage defaults" uses:
```sql
EXISTS (SELECT 1 FROM org_members WHERE user_id = auth.uid() AND role = 'owner')
```
This checks if the user is an owner of ANY org, not a specific one. Since `metric_defaults` has no `org_id` column, any org owner can modify the global metric defaults affecting all organisations.

**Fix:** Either add an `org_id` column to `metric_defaults` and scope the policy, or restrict management to platform admins only.

### 7. `org_members` — users can insert their own membership to any org

The policy "Users can insert own membership" has:
```sql
WITH CHECK: (user_id = auth.uid())
```
This only verifies the `user_id` matches but does NOT verify the `org_id`. A user could insert themselves as a member of any org they choose, gaining access to that org's clients, data, and features.

**Fix:** Remove this INSERT policy. Membership should only be created by the `handle_new_user()` trigger (signup) or by org owners via the "Owners can manage org members" policy.

---

## LOW Findings

### 8. `check-subscription` uses `getUser()` with service role key

Line 39 calls `supabase.auth.getUser(token)` using a client initialized with the service role key. This works but `getUser` with service role always succeeds — it fetches any user by token regardless of validity. Should use anon key for user verification, then service role for privileged operations.

---

## Proposed Changes

### Database Migration
1. **Drop** the "Users can insert own membership" INSERT policy on `org_members`
2. **Restrict** `metric_defaults` management to platform admins only (drop the "Org owners can manage defaults" policy, the platform admin ALL policy already covers this)

### Edge Function Auth Hardening
Add mandatory auth verification to these 6 functions:
- `analyze-client`
- `chat-with-data`
- `voice-briefing`
- `extract-branding`
- `google-places-lookup`
- `generate-report` (move auth check before any DB writes, make it mandatory)

Each function will:
1. Extract and verify the JWT from the Authorization header
2. Resolve the caller's org membership
3. Verify the caller's org owns the requested `client_id`
4. Reject with 401/403 if any check fails

### Code Cleanup
Remove hardcoded `META_APP_ID` fallback from 5 files:
- `meta-ads-connect/index.ts`
- `instagram-connect/index.ts`
- `sync-meta-ads/index.ts`
- `oauth-callback/index.ts` (3 occurrences)
- `facebook-connect/index.ts`

## Files Changed

| File | Change |
|---|---|
| Database migration | Drop dangerous org_members INSERT policy, restrict metric_defaults |
| `supabase/functions/analyze-client/index.ts` | Add auth verification |
| `supabase/functions/chat-with-data/index.ts` | Add auth verification |
| `supabase/functions/voice-briefing/index.ts` | Add auth verification |
| `supabase/functions/extract-branding/index.ts` | Add auth verification |
| `supabase/functions/google-places-lookup/index.ts` | Add auth verification |
| `supabase/functions/generate-report/index.ts` | Move auth to top, make mandatory |
| `supabase/functions/meta-ads-connect/index.ts` | Remove hardcoded META_APP_ID |
| `supabase/functions/instagram-connect/index.ts` | Remove hardcoded META_APP_ID |
| `supabase/functions/sync-meta-ads/index.ts` | Remove hardcoded META_APP_ID |
| `supabase/functions/oauth-callback/index.ts` | Remove hardcoded META_APP_ID (3x) |
| `supabase/functions/facebook-connect/index.ts` | Remove hardcoded META_APP_ID |

