

# Bypass Sync Limits for Platform Admins

## What It Does
Platform Admins (e.g. info@amwmedia.co.uk) will have no sync cooldown limits and no client/connection entitlement restrictions. All other users keep their plan-based limits.

## Changes

### 1. `src/pages/clients/ClientDetail.tsx`
- Import `usePlatformAdmin` hook
- Pass `isPlatformAdmin` as a new prop to `ClientConnectionsTab`

### 2. `src/components/clients/tabs/ClientConnectionsTab.tsx`
- Add `isPlatformAdmin?: boolean` to the props interface
- Update `getSyncCooldownInfo` to accept an `isPlatformAdmin` flag — when true, always return `{ canSync: true, nextAvailable: null }`
- Pass `isPlatformAdmin` through to `ConnectionRow` and all cooldown checks

### 3. `src/hooks/useEntitlements.ts`
- Import `usePlatformAdmin`
- When `isPlatformAdmin` is true, override entitlements: set `maxClients` and `maxConnections` to `Infinity`, `canAddClient` and `canAddConnection` to `true`, `isUnlimited` to `true`, `isLocked` to `false`

This ensures platform admins bypass both sync cooldowns and client/connection caps. No database changes needed — `platform_admins` table already exists and is checked via the `usePlatformAdmin` hook.

