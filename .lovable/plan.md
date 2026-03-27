

## Client Self-Service Login (Magic Link + Connections Management)

### Overview

Allow end-clients to log in via magic link, view their dashboard, and manage their own platform connections — without needing access to the agency's full app.

### Architecture

**New `client_users` table** — maps auth users to specific client records:

```
client_users
├── id (uuid, PK)
├── user_id (uuid, references auth.users, NOT NULL)
├── client_id (uuid, NOT NULL)
├── org_id (uuid, NOT NULL)
├── invited_by (uuid, nullable)
├── invited_at (timestamptz)
├── created_at (timestamptz)
```

RLS policies:
- Client users can SELECT their own row
- Org owners/managers can INSERT/DELETE (invite/revoke)
- Platform admins can manage all

**Database migration** also needs:
- RLS policy on `platform_connections` allowing client_users to manage connections for their client
- RLS SELECT policy on `clients` for client_users to view their own client record
- A `is_client_user` security definer function to check if a user is a client_user for a given client

### New Edge Function: `invite-client-user`

Accepts `{ client_id, email }` from an org member. Inserts into `client_users` (with `user_id` null initially), then calls `supabase.auth.admin.generateLink({ type: 'magiclink', email })` to send a magic link. On auth, a trigger or the edge function associates the `user_id`.

### Frontend Changes

**1. Client Detail page (`ClientDetail.tsx`) — "Invite Client" button**
- New section in the Settings tab to invite a client user by email
- Shows list of existing client_users with ability to revoke access

**2. New route: `/client-portal` (authenticated client view)**
- Similar to existing `/portal/:token` but requires auth
- Detects if logged-in user is a `client_user` → redirects here after login
- Shows: branded dashboard (reuses `ClientDashboard`) + connection management (reuses `ConnectionDialog` logic)
- Hides: admin controls, AI analysis, metric config, other clients

**3. Auth flow updates (`useAuth.tsx`)**
- After login, check `client_users` table for the user
- If found → redirect to `/client-portal` instead of `/dashboard`
- Add `clientUser` to auth context (client_id, org_id)

**4. Login page (`LandingPage.tsx`)**
- Add a "Client Login" tab/section with magic link input (email only, no password)
- Calls `supabase.auth.signInWithOtp({ email })` for magic link

### Files to create/edit

| File | Action |
|---|---|
| Migration | Create `client_users` table, `is_client_user` function, RLS policies |
| `supabase/functions/invite-client-user/index.ts` | New edge function to invite client users |
| `src/pages/ClientPortalAuth.tsx` | New authenticated client portal page |
| `src/pages/clients/ClientDetail.tsx` | Add "Invite Client" section in settings tab |
| `src/hooks/useAuth.tsx` | Check `client_users` on login, expose `clientUser` state |
| `src/App.tsx` | Add `/client-portal` route, redirect logic |
| `src/pages/LandingPage.tsx` | Add magic link login tab for clients |

### Security considerations

- Client users can ONLY access their own client record — enforced at DB level via RLS
- Client users cannot see other clients, org settings, billing, or admin features
- Connection management respects existing entitlement limits
- Magic links expire after standard timeout (default 1 hour)

