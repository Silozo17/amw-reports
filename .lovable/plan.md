

# Fix Org Switching & Branding — Two Issues

## Problem 1: Org switch doesn't propagate instantly
`useOrg()` is a **plain hook** (not a React Context). Every component that calls `useOrg()` gets its **own independent copy** of state. When the sidebar calls `switchOrg()`, only the sidebar's state updates — the dashboard, client list, settings page, etc. all keep stale `orgId`/`org` values until the page remounts (i.e. a manual refresh).

## Problem 2: Branding colours don't reflect
`BrandingProvider` calls `useOrg()` to get the org's colours and set CSS variables. But since it has its own independent hook instance, it never sees the org change either. Even if the org has colours set, switching orgs won't apply them until refresh.

## Root Cause
Both issues stem from `useOrg` being a hook with local `useState`, not a shared context.

## Fix

### Convert `useOrg` to a React Context Provider

**`src/hooks/useOrg.ts` → `src/hooks/useOrg.tsx`**
- Wrap the existing logic in an `OrgProvider` context component
- Export a `useOrg()` hook that reads from context
- All 14+ consumers automatically share the same state
- When `switchOrg()` is called anywhere, every consumer re-renders with new `orgId`/`org`

**`src/App.tsx`**
- Wrap routes with `<OrgProvider>` (inside `AuthProvider`, outside `BrandingProvider`)

No other files need changes — all existing `useOrg()` call sites keep working since the export name stays the same.

### How it works after the fix

```text
App
  └─ AuthProvider (context ✓)
      └─ OrgProvider (NEW context)
          └─ BrandingProvider (reads org from shared context → applies CSS vars)
              └─ Routes
                  ├─ AppSidebar → switchOrg() updates shared context
                  ├─ Dashboard → orgId changes → useEffect re-fetches
                  ├─ ClientList → orgId changes → useEffect re-fetches  
                  └─ Settings → orgRole changes → tabs update
```

## Files

| File | Change |
|---|---|
| `src/hooks/useOrg.tsx` | Rename from `.ts`, convert to context provider + hook |
| `src/App.tsx` | Wrap with `<OrgProvider>` inside `AuthProvider` |

