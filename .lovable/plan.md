

# Remaining Security Fixes

Three vulnerabilities from the audit were not addressed in the previous implementation.

---

## 1. OAuth Tokens Stored in Plain Text (HIGH)

**Problem:** `platform_connections.access_token` and `refresh_token` are stored as unencrypted text. Any RLS bypass or SQL injection would expose every connected platform's OAuth tokens.

**Fix:** Use Supabase Vault (`pgsodium`) to encrypt tokens at rest via a database trigger. A `BEFORE INSERT OR UPDATE` trigger on `platform_connections` will encrypt `access_token` and `refresh_token` using `pgsodium.crypto_aead_det_encrypt()`. A helper function `decrypt_token()` will be created for Edge Functions to decrypt when needed. The columns remain `text` type, but store ciphertext instead of plaintext.

**Changes:**
- Database migration: create encryption key, add encrypt trigger, add `decrypt_token()` function, migrate existing plaintext tokens
- Update all Edge Functions that read `access_token`/`refresh_token` to call `decrypt_token()` (all sync-* functions, all *-connect functions, oauth-callback, check-expiring-tokens)

**Risk note:** This is a large, high-risk change touching every OAuth flow. A phased approach is recommended — encrypt new tokens first, then migrate existing ones. However, given that Supabase Vault/pgsodium availability needs to be confirmed for this Lovable Cloud project, an alternative is to encrypt/decrypt in the Edge Functions using a shared secret stored as a Supabase secret. This is simpler and guaranteed to work.

**Recommended approach (Edge Function encryption):**
- Add a new secret `TOKEN_ENCRYPTION_KEY` (32-byte hex string)
- Create a shared utility that encrypts/decrypts using AES-256-GCM
- Update all Edge Functions that write tokens to encrypt before storing
- Update all Edge Functions that read tokens to decrypt after fetching
- One-time migration script to encrypt all existing plaintext tokens

---

## 2. `portal-data` — No Rate Limiting (HIGH)

**Problem:** The portal-data function accepts a share token and returns all client data using the service role key. There's no rate limiting — a leaked token allows unlimited data exfiltration.

**Fix:** Add IP-based rate limiting using a lightweight in-memory approach (Deno KV or a database counter). Limit to 60 requests per minute per IP. Also add a `last_accessed_at` column to `client_share_tokens` so org owners can see when tokens are being used.

**Changes:**
- `supabase/functions/portal-data/index.ts` — add rate limiting logic at the top of the function, update `last_accessed_at` on each valid request
- Database migration: add `last_accessed_at` column to `client_share_tokens`

---

## 3. `check-subscription` — `getUser()` with Service Role Key (LOW)

**Problem:** Line 39 calls `supabase.auth.getUser(token)` using the service role client. With the service role key, `getUser` may not properly validate token expiry/revocation.

**Fix:** Create a separate anon-key client for user verification, then continue using the service role client for privileged operations.

**Changes:**
- `supabase/functions/check-subscription/index.ts` — create anon client for `getUser()`, keep service role client for DB operations

---

## Files Changed

| File | Change |
|---|---|
| Database migration | Add `last_accessed_at` to `client_share_tokens` |
| `supabase/functions/portal-data/index.ts` | Add IP-based rate limiting (60/min), update `last_accessed_at` |
| `supabase/functions/check-subscription/index.ts` | Use anon client for `getUser()` |

**Deferred (separate task):** OAuth token encryption — this is a large cross-cutting change affecting 20+ Edge Functions. Recommend implementing as a dedicated follow-up to avoid breaking all OAuth flows in one deployment.

