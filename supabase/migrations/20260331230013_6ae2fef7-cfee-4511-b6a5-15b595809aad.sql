ALTER TABLE public.clients
  ADD COLUMN industry text,
  ADD COLUMN target_audience text,
  ADD COLUMN service_area_type text NOT NULL DEFAULT 'local',
  ADD COLUMN service_areas text,
  ADD COLUMN business_goals text,
  ADD COLUMN competitors text,
  ADD COLUMN unique_selling_points text,
  ADD COLUMN brand_voice text;