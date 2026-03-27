

# Role-Based Access Control Overhaul

## Summary

Enforce three distinct roles across the platform with specific permission boundaries:

- **Admin** (platform admin, info@amwmedia.co.uk only): Full access to everything — admin panel, debug console, all org settings, can manage every user/org
- **Owner** (org owner): Full org settings, billing, logs — no debug console
- **Manager** (org member): Branding settings + view logs only

## Current State

- `isOwner` gates Settings page entirely (blocks managers)
- Debug console is gated by `isOwner` (should be admin-only)
- No role-based tab filtering in Settings — it's all-or-nothing
- `info@amwmedia.co.uk` org_members role is `owner`, needs to stay as-is (platform admin status comes from `platform_admins` table)

## Changes

### 1. Update `useAuth` hook — expose `isPlatformAdmin` and `isManager`

Add `isPlatformAdmin` check directly into the auth context (query `platform_admins` table alongside profile fetch). Expose:
- `isPlatformAdmin: boolean`
- `isOwner: boolean` (unchanged)
- `isManager: boolean` (role === 'manager')

This removes the need for the separate `usePlatformAdmin` hook in most places.

### 2. Update `info@amwmedia.co.uk` org_members role to `owner`

Use the insert tool to ensure the admin user's `org_members.role` is `owner` (it likely already is). No schema change needed — admin powers come from `platform_admins` table.

### 3. Settings Page — role-based tab visibility

Instead of blocking managers entirely, show Settings with filtered tabs:

| Tab | Admin | Owner | Manager |
|-----|-------|-------|---------|
| Organisation | ✅ | ✅ | ❌ |
| Account | ✅ | ✅ | ✅ (own account) |
| White Label | ✅ | ✅ | ✅ (branding only) |
| Metrics | ✅ | ✅ | ❌ |
| Billing | ✅ | ✅ | ❌ |

Managers see: Account + White Label (branding) tabs only.

### 4. Sidebar — role-based menu items

| Menu Item | Admin | Owner | Manager |
|-----------|-------|-------|---------|
| Settings | ✅ | ✅ | ✅ |
| Logs | ✅ | ✅ | ✅ (view only) |
| Debug | ✅ | ❌ | ❌ |
| Platform Admin | ✅ | ❌ | ❌ |

Key change: Debug moves from `isOwner` gate to `isPlatformAdmin` gate.

### 5. Route protection for Debug Console

Change `/debug` route from `ProtectedRoute` to a new check: redirect non-admins away. The simplest approach is to add a guard inside the `DebugConsole` component itself that checks `isPlatformAdmin`.

## Files to Modify

| File | Change |
|---|---|
| `src/hooks/useAuth.tsx` | Add `isPlatformAdmin` query + `isManager` derived boolean |
| `src/pages/SettingsPage.tsx` | Allow managers in, show role-filtered tabs |
| `src/components/layout/AppSidebar.tsx` | Debug → admin-only; keep Settings visible for all roles |
| `src/pages/DebugConsole.tsx` | Add admin-only guard (redirect or block) |
| `src/hooks/usePlatformAdmin.ts` | Keep for `AdminRoute` but `useAuth` will also expose it |

