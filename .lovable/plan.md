

# Fix: LinkedIn Sync — Rate Limiting and Single-Org Scope

## Problem
All LinkedIn API calls return **429 — daily rate limit exceeded**. Two contributing factors:

1. The sync loops over **all 5 organisations** in `metadata.organizations` instead of only the one the user selected (`metadata.selected_organization` / `account_id`).
2. Each org triggers 5 parallel API calls (followers, gains, shares, page stats, posts). With 5 orgs × 5 endpoints = 25 calls per sync invocation. The backfill triggered 12+ months of syncs, exhausting LinkedIn's daily quota.

## Fix (single file: `supabase/functions/sync-linkedin/index.ts`)

### Change 1 — Sync only the selected organization
Replace the loop over `metadata.organizations` (line 327) with a single-org lookup using `conn.account_id` (which stores the selected org ID).

```typescript
// Instead of iterating all organizations:
const selectedOrg = conn.account_id;
const selectedOrgName = (metadata?.selected_organization as any)?.name || selectedOrg;
const organizations = [{ id: selectedOrg, name: selectedOrgName }];
```

This reduces API calls from 25+ down to 5 per sync invocation.

### Change 2 — Add retry-with-backoff for 429 errors
Update `fetchLinkedIn` to retry once after a short delay when it receives a 429, instead of immediately throwing.

### Change 3 — Sequential org processing (safety net)
Even though we'll only have 1 org now, if in future someone has multiple, process orgs sequentially (already the case) but add a small delay between API calls to avoid burst throttling.

## Rate Limit Recovery
LinkedIn's daily quota resets at midnight UTC. The data **will sync correctly once the quota resets** — the API calls themselves are correctly formed (the `posts_published` count from earlier syncs proves data flows when the API responds). No need to re-connect.

## Summary
- Only `supabase/functions/sync-linkedin/index.ts` changes
- Reduces API calls by 80% (1 org instead of 5)
- Adds 429 retry logic
- Data will populate after LinkedIn's daily limit resets (midnight UTC)

