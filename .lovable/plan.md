

## Fix: Reports Bucket Storage Policy

### Problem
The current SELECT policy on `storage.objects` for the `reports` bucket only checks `bucket_id = 'reports'`, meaning any authenticated user can read any organisation's report files and voice briefings.

The same issue exists for UPDATE and INSERT policies.

### Solution
Replace all three overly-permissive policies with scoped versions that verify the user has access to the client whose files they're accessing.

**Storage path structure**: `{client_id}/...` and `voice-briefings/{client_id}/...`

The fix extracts the `client_id` from the file path and checks that the user either:
- Belongs to the org that owns the client (`user_belongs_to_org`)
- Is a client-portal user for that client (`is_client_user`)
- Is a platform admin (`is_platform_admin`)

### Migration SQL

```sql
-- Drop overly-permissive policies
DROP POLICY IF EXISTS "Authenticated users can read reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update reports" ON storage.objects;

-- SELECT: org members, client users, or platform admins
CREATE POLICY "Scoped read access to reports"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'reports'
  AND (
    is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = (
        CASE
          WHEN storage.objects.name LIKE 'voice-briefings/%'
            THEN split_part(storage.objects.name, '/', 2)::uuid
          ELSE split_part(storage.objects.name, '/', 1)::uuid
        END
      )
      AND (
        user_belongs_to_org(auth.uid(), c.org_id)
        OR is_client_user(auth.uid(), c.id)
      )
    )
  )
);

-- INSERT: org members or platform admins only (not client users)
CREATE POLICY "Scoped upload access to reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reports'
  AND (
    is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = (
        CASE
          WHEN name LIKE 'voice-briefings/%'
            THEN split_part(name, '/', 2)::uuid
          ELSE split_part(name, '/', 1)::uuid
        END
      )
      AND user_belongs_to_org(auth.uid(), c.org_id)
    )
  )
);

-- UPDATE: org members or platform admins only
CREATE POLICY "Scoped update access to reports"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'reports'
  AND (
    is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = (
        CASE
          WHEN storage.objects.name LIKE 'voice-briefings/%'
            THEN split_part(storage.objects.name, '/', 2)::uuid
          ELSE split_part(storage.objects.name, '/', 1)::uuid
        END
      )
      AND user_belongs_to_org(auth.uid(), c.org_id)
    )
  )
);
```

### What This Changes
- **SELECT**: Only org members, client-portal users, and platform admins can read files belonging to their clients
- **INSERT**: Only org members and platform admins can upload
- **UPDATE**: Only org members and platform admins can update
- No code changes needed — the storage paths and Supabase client calls remain identical

### Risk Assessment
- Edge functions use the service role key to upload, so they bypass RLS entirely — no breakage
- Client-portal users who download reports via signed URLs (generated server-side) are unaffected
- Client-portal users who access reports via the Supabase client directly now need `is_client_user` — which is included in the SELECT policy

