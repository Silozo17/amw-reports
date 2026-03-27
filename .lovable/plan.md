

# Editable Organisation Details + Revoke Pending Invites for All Roles

## 1. Database Migration

Add missing columns to `organisations`:

```sql
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS phone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS website text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS address text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS team_size text DEFAULT NULL;
```

## 2. Update Organisation Interface

**File: `src/contexts/OrgContext.tsx`**

Add `phone`, `email`, `website`, `address`, `team_size` to the `Organisation` interface and include them in the select query.

## 3. Redesign Organisation Card as Editable Form

**File: `src/components/settings/OrganisationSection.tsx`**

Replace the read-only Organisation card with an editable form containing:
- Name (text input)
- Phone (text input)
- Email (text input)
- Website (text input)
- Address (textarea)
- Team Size (select: 1-5, 6-15, 16-50, 51-200, 200+)
- Slug and Role remain read-only display

Add a "Save" button in the card header. On save, update the `organisations` table and call `refetchOrg()` to sync context.

## 4. Allow All Roles to Revoke Pending Invites

Currently, only non-owner members can be removed (line 183: `member.role !== 'owner'`). The delete button already works for pending invites, but owners cannot revoke other owner invites.

Change the logic: show a "Revoke" / delete button on any member row where `accepted_at` is null (pending invite), regardless of the invited role. For accepted members, keep the existing restriction (cannot remove owners).

This means:
- Pending invite (any role) → show revoke button
- Accepted owner → no remove button
- Accepted manager → show remove button (owners only)

## Files Modified

| File | Change |
|---|---|
| Database migration | Add 5 columns to `organisations` |
| `src/contexts/OrgContext.tsx` | Add new fields to interface + select |
| `src/components/settings/OrganisationSection.tsx` | Editable org form + revoke pending invites logic |

