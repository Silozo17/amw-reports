

## Plan: Harden check-subscription with rate limiting and org-ownership scoping

### Problem

The `check-subscription` function is callable by any authenticated user. While it reads from Stripe (source of truth) and writes to `org_subscriptions` using a service-role client, there are two risks:

1. **No rate limiting** — a user could spam the endpoint, hammering the Stripe API and causing unnecessary DB writes.
2. **Org ownership not verified** — the function writes to whatever `org_id` is on the caller's profile. While this is their own org, the function should explicitly verify the caller is a member of that org before writing.

### Changes

**File: `supabase/functions/check-subscription/index.ts`**

1. **Add in-memory rate limiter** — Track calls per user ID with a sliding window (max 5 calls per 60 seconds). Return 429 if exceeded. Same pattern used in other edge functions.

2. **Add org membership check** — After resolving `profile.org_id`, verify the caller belongs to that org via an `org_members` lookup before allowing any writes to `org_subscriptions`.

3. **Make DB writes idempotent** — Before writing, compare current DB state with what Stripe returned. Skip the update if status and period_end already match, reducing unnecessary writes from repeated calls.

### Technical detail

```text
Request flow (after change):

  Auth check (existing)
    ↓
  Rate limit check (NEW — 5 req/60s per user_id)
    ↓ pass          ↓ fail
  Stripe lookup     429 Too Many Requests
    ↓
  Org membership verify (NEW)
    ↓ pass          ↓ fail
  Compare DB state  403 Forbidden
    ↓ changed       ↓ same
  Write to DB       Skip write, return cached
    ↓
  Return response
```

### No other files change.

