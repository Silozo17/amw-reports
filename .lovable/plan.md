
The user reports `show_health_score` setting is ignored on the public portal share link.

Looking at `ClientPortal.tsx`: it passes `showHealthScore={client.show_health_score !== false}` to `ClientDashboard`. So the portal page reads it correctly.

But — the data comes from `portal-data` edge function. Let me check what it returns. In the `clients` select: `"id, company_name, full_name, logo_url, preferred_currency, org_id"` — **`show_health_score` is NOT included**. So `client.show_health_score` is always `undefined`, and `undefined !== false` is `true`, so health score always shows.

Fix: add `show_health_score` to the clients select in `supabase/functions/portal-data/index.ts`.

I should also verify ClientDashboard actually respects the `showHealthScore` prop — but that's the same component used in the agency view where the toggle does work, so it's fine. The bug is purely the missing field in the edge function select.

## Plan

**Single fix** in `supabase/functions/portal-data/index.ts`:

Change the clients query select from:
```
"id, company_name, full_name, logo_url, preferred_currency, org_id"
```
to:
```
"id, company_name, full_name, logo_url, preferred_currency, org_id, show_health_score"
```

That's it. One field added to one select statement. The frontend (`ClientPortal.tsx`) already reads `client.show_health_score` and passes it down correctly — it just never receives the value today.

No DB changes, no UI changes, no new types.
