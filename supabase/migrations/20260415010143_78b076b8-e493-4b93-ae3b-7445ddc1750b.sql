-- Drop existing unscoped policies
DROP POLICY IF EXISTS "Authenticated users can upload client logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update client logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete client logos" ON storage.objects;

-- INSERT: org members only, path must start with a client_id they own
CREATE POLICY "Org members can upload client logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-logos'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = (storage.foldername(name))[1]::uuid
      AND public.user_belongs_to_org(auth.uid(), c.org_id)
  )
);

-- UPDATE: same org check
CREATE POLICY "Org members can update client logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-logos'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = (storage.foldername(name))[1]::uuid
      AND public.user_belongs_to_org(auth.uid(), c.org_id)
  )
);

-- DELETE: same org check
CREATE POLICY "Org members can delete client logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-logos'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = (storage.foldername(name))[1]::uuid
      AND public.user_belongs_to_org(auth.uid(), c.org_id)
  )
);