

# Fix: Scope client-logos Storage Policies to Organisation Members

## Problem
The `client-logos` bucket policies only check `bucket_id = 'client-logos'`, allowing any authenticated user to upload, update, or delete logos belonging to other organisations.

## Approach
Since files are currently uploaded with flat UUID paths (`{random-uuid}.ext`), there's no way to derive ownership from the path alone. The fix requires two changes:

1. **Change upload path convention** to `{client_id}/{filename}` so the storage policy can extract the client_id from the path and verify org membership.
2. **Replace storage policies** with org-scoped versions that check the first path segment against the `clients` table.

## Changes

### 1. Database migration — Replace storage policies
Drop the four existing unscoped policies and create org-scoped replacements:

```sql
-- DROP existing unscoped policies
DROP POLICY "Authenticated users can upload client logos" ON storage.objects;
DROP POLICY "Authenticated users can update client logos" ON storage.objects;
DROP POLICY "Authenticated users can delete client logos" ON storage.objects;
-- Keep public SELECT policy unchanged (logos are public-readable by design)

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
```

### 2. Update `src/pages/clients/ClientForm.tsx`
Change the upload path from `{uuid}.ext` to `{clientId}/{uuid}.ext`. Since this is a new client (not yet created), we'll need to create the client first, get the ID, then upload the logo and update the record. Alternatively, use a temporary org-scoped prefix — but since ClientForm inserts a new client, the simplest approach is to upload under a temporary path using the org_id, or restructure to create client first.

**Simpler approach**: Use the client_id that will be known after insert. Restructure to:
1. Insert client without logo
2. Upload logo to `{client.id}/{uuid}.ext`
3. Update client with logo_url

### 3. Update `src/components/clients/ClientEditDialog.tsx`
Change upload path from `{uuid}.ext` to `{client.id}/{uuid}.ext` (client.id is already available here).

### Files to modify
- New migration SQL file
- `src/pages/clients/ClientForm.tsx` — restructure upload to use `{clientId}/` prefix
- `src/components/clients/ClientEditDialog.tsx` — prefix upload path with `client.id`

### Risk
Existing logos uploaded with flat paths will remain accessible (public SELECT is unchanged) but cannot be deleted/updated through the new policies. This is acceptable since old logos are referenced by URL in `clients.logo_url` and don't need policy-gated access.
