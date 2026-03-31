

# Security Audit: Subscription & Entitlement Bypass Vulnerabilities

## Critical Findings

### VULNERABILITY 1: Users can self-assign any subscription plan (CRITICAL)

The `org_subscriptions` table has this RLS INSERT policy:
```
"Users can create own org subscription" — INSERT for authenticated
WITH CHECK: user_belongs_to_org(auth.uid(), org_id)
```

**Any authenticated user** can directly call the Supabase API and insert a row into `org_subscriptions` pointing to the Agency plan ID, giving themselves unlimited clients, whitelabeling, and all paid features — completely bypassing Stripe.

There is also **no UPDATE restriction** for regular users. The only UPDATE policies are for platform admins, but since there's no explicit DENY, the INSERT policy combined with the lack of UPDATE restrictions means a user who belongs to an org can potentially manipulate their subscription.

**Fix:** Remove the "Users can create own org subscription" INSERT policy. Only the `handle_new_user()` trigger (which runs as SECURITY DEFINER) and the Stripe webhook/check-subscription edge functions (which use the service role key) should ever write to this table.

### VULNERABILITY 2: All entitlement checks are client-side only (HIGH)

Every limit enforcement happens in the React frontend via `useEntitlements()`:
- `canAddClient` — checked in `ClientForm.tsx` before form submission
- `canAddConnection` — checked in `ConnectionDialog.tsx` before insert
- `hasWhitelabel` — hides the White Label settings tab

**A user can bypass all of these** by calling the Supabase API directly (e.g. via curl or the browser console). The `clients` and `platform_connections` tables have no server-side limit enforcement — their RLS policies only check org membership, not subscription limits.

**Fix:** Add a database trigger or RLS policy that enforces limits server-side. The most robust approach is a BEFORE INSERT trigger on `clients` and `platform_connections` that counts existing records and compares against the org's subscription limits.

### VULNERABILITY 3: No server-side whitelabel gating (MEDIUM)

White label features (logo, colors, fonts on `organisations` table) are only hidden in the UI when `hasWhitelabel` is false. Any org owner can update their org's `logo_url`, `primary_color`, `heading_font`, etc. directly via the API regardless of their plan, and those values will render in reports and the client portal.

**Fix:** Add a validation trigger on `organisations` UPDATE that prevents setting branding fields unless the org has an active subscription with `has_whitelabel = true`.

## Proposed Changes

### Database Migration

1. **Drop the dangerous INSERT policy** on `org_subscriptions`:
```sql
DROP POLICY "Users can create own org subscription" ON public.org_subscriptions;
```

2. **Add server-side client limit trigger**:
```sql
CREATE OR REPLACE FUNCTION public.check_client_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  _max int; _current int; _override int; _included int; _additional int;
BEGIN
  SELECT os.override_max_clients, sp.included_clients, os.additional_clients
  INTO _override, _included, _additional
  FROM org_subscriptions os
  JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.org_id = NEW.org_id AND os.status = 'active'
  LIMIT 1;

  IF _override = -1 THEN RETURN NEW; END IF;
  _max := COALESCE(_override, _included + _additional);

  SELECT count(*) INTO _current FROM clients WHERE org_id = NEW.org_id;
  IF _current >= _max THEN
    RAISE EXCEPTION 'Client limit reached for this subscription plan';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER enforce_client_limit
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.check_client_limit();
```

3. **Add server-side connection limit trigger** (same pattern for `platform_connections`).

4. **Add server-side whitelabel gating trigger** on `organisations` UPDATE that blocks branding field changes for non-whitelabel plans.

### No frontend changes needed
The existing UI guards remain as a good UX layer. The database triggers act as the security enforcement.

## Files Changed

| File | Change |
|---|---|
| Database migration | Drop dangerous INSERT policy, add 3 enforcement triggers |

