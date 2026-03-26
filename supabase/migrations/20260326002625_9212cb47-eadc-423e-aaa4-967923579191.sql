
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS secondary_color text;
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS accent_color text;
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS heading_font text DEFAULT 'Anton';
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS body_font text DEFAULT 'Inter';
