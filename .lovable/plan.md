

## Plan: Clear AMW Media Data + Add Debug Console + Fix RLS Recursion

### 1. Clear all connection data for AMW Media

Delete from these tables where `client_id = 'c2b194b6-3b2c-4f5a-9f00-95e13ca28027'`:
- `platform_connections`
- `monthly_snapshots`
- `sync_logs`
- `client_platform_config`

This will be done via the database insert tool (which supports DELETE operations).

### 2. Add a Debug Console page

Create a new `/debug` page accessible from the sidebar that shows:
- **Connection inspector**: For any client, show all `platform_connections` rows with full metadata, tokens (masked), account IDs
- **Sync trigger + log viewer**: Trigger a sync for any connection and see the raw response, plus view `sync_logs` for that client/platform
- **Snapshot viewer**: Show raw `metrics_data`, `top_content`, and `raw_data` from `monthly_snapshots` for any client/platform/month
- **Live sync test**: Button to invoke any sync edge function and display the full JSON response inline

This gives full visibility into: what data is pulled (sync response), how it's stored (snapshot JSON), and what the dashboard reads.

**Files:**
- `src/pages/DebugConsole.tsx` — new page with tabs: Connections, Sync Logs, Snapshots, Live Test
- `src/App.tsx` — add `/debug` route
- `src/components/layout/AppSidebar.tsx` — add Debug link in sidebar

### 3. Fix org_members RLS infinite recursion

The "Owners can manage org members" policy has a subquery that references `org_members` inside itself, causing infinite recursion. Fix with a migration:

```sql
DROP POLICY "Owners can manage org members" ON public.org_members;

CREATE POLICY "Owners can manage org members"
ON public.org_members FOR ALL TO authenticated
USING (
  org_id = public.user_org_id(auth.uid())
  AND public.user_org_id(auth.uid()) IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
  )
);
```

Wait — this still references org_members. The fix is to use a SECURITY DEFINER function instead:

```sql
CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id AND role = 'owner'
  )
$$;
```

Then rewrite the policy to use `public.is_org_owner(auth.uid())` — this bypasses RLS on the function call, breaking the recursion.

### Technical Details

**Debug Console features:**
- Client selector dropdown
- Platform filter
- Month/year selector for snapshots
- Raw JSON viewer with syntax highlighting (using `<pre>` + JSON.stringify)
- "Sync Now" button that calls `supabase.functions.invoke('sync-{platform}')` and displays response
- Copy-to-clipboard for JSON data

**Migration for RLS fix:**
1. Create `is_org_owner` SECURITY DEFINER function
2. Drop the recursive "Owners can manage org members" policy
3. Recreate it using `is_org_owner(auth.uid())`
4. Also fix the `organisations` UPDATE policy which has the same recursion pattern

