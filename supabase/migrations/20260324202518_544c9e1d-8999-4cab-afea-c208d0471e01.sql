
-- Add logo_url column to clients
ALTER TABLE public.clients ADD COLUMN logo_url text;

-- Create client-logos storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', true);

-- Allow authenticated users to upload to client-logos bucket
CREATE POLICY "Authenticated users can upload client logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-logos');

-- Allow authenticated users to update client logos
CREATE POLICY "Authenticated users can update client logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'client-logos');

-- Allow public read access to client logos
CREATE POLICY "Public read access for client logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'client-logos');

-- Allow authenticated users to delete client logos
CREATE POLICY "Authenticated users can delete client logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-logos');
