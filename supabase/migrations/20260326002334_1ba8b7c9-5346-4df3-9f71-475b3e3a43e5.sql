
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position text;

-- Create org-assets bucket for org logos and avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('org-assets', 'org-assets', true) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to org-assets
CREATE POLICY "Authenticated users can upload org assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'org-assets');
CREATE POLICY "Authenticated users can update own org assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'org-assets');
CREATE POLICY "Anyone can view org assets" ON storage.objects FOR SELECT TO public USING (bucket_id = 'org-assets');
CREATE POLICY "Authenticated users can delete org assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'org-assets');
