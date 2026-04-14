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

-- INSERT: org members or platform admins only
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