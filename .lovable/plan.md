

# Enhance Admin Panel for AMW Media Platform Management

## Current State

The admin panel (`/admin`) has:
- **Overview**: Basic stats (org count, client count, connections, users)
- **Organisations**: List view with plan/status, and detail page to manage subscriptions

## What's Missing

AMW Media as platform owner needs to fully manage client organisations — not just view stats and toggle plans. Here's what's needed:

### 1. View and manage an organisation's clients
Currently the admin can only see client *count*. They need to drill into an org and see/manage individual clients, their connections, sync status, and reports — essentially "impersonate" the org's workspace for support purposes.

### 2. View and manage an organisation's team members
The admin org detail page only shows subscription settings. They need to see who's in each org (owners, managers, pending invites) and be able to add/remove members on behalf of the org.

### 3. View an organisation's connections and sync health
See which platforms are connected per client, last sync status, errors — to help diagnose issues for clients.

### 4. Platform-wide activity log
See recent syncs, report generations, and errors across all organisations for proactive support.

### 5. Admin sidebar navigation expansion
Add nav items for the new sections.

---

## Plan

### Database Changes
**1 migration** — Add RLS policies so platform admins can read all data they need:
- `platform_connections`: already has admin SELECT policy
- `clients`: already has admin SELECT policy  
- `monthly_snapshots`: needs admin SELECT policy
- `sync_logs`: needs admin SELECT policy
- `reports`: needs admin SELECT policy
- `org_members`: already has admin SELECT policy
- `email_logs`: needs admin SELECT policy

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/admin/AdminOrgClients.tsx` | List all clients for a specific org with connection counts and sync status |
| `src/pages/admin/AdminOrgMembers.tsx` | View/manage team members for a specific org (add/remove members) |
| `src/pages/admin/AdminActivityLog.tsx` | Platform-wide recent sync logs, report logs, and errors |

### Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/AdminLayout.tsx` | Add nav items: Activity Log |
| `src/pages/admin/AdminOrgDetail.tsx` | Add tabs or sections linking to org's clients, members, connections alongside subscription settings |
| `src/App.tsx` | Add routes: `/admin/organisations/:id/clients`, `/admin/organisations/:id/members`, `/admin/activity` |

### Implementation Details

**AdminOrgDetail.tsx** — Restructure into a tabbed layout:
- **Subscription** tab (existing content)
- **Clients** tab — table of org's clients with company name, active connections count, last sync date, link to client detail
- **Members** tab — list of org_members with role, invite status, ability to remove
- **Connections** tab — all platform_connections for that org's clients with status and errors

**AdminActivityLog.tsx** — Query `sync_logs` and `report_logs` across all orgs (needs admin RLS), show recent 50 entries with org name, client name, platform, status, timestamp, and any errors.

**AdminLayout.tsx** — Add "Activity" nav item with `ScrollText` icon pointing to `/admin/activity`.

### RLS Migration
```sql
-- Allow platform admins to read sync_logs, reports, email_logs, monthly_snapshots
CREATE POLICY "Platform admins can view all sync logs" ON sync_logs FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can view all reports" ON reports FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can view all email logs" ON email_logs FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can view all snapshots" ON monthly_snapshots FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));
```

