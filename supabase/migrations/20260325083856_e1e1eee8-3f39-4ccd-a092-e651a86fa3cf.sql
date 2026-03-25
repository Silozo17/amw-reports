
-- Add new platform types to the enum
ALTER TYPE public.platform_type ADD VALUE IF NOT EXISTS 'google_search_console';
ALTER TYPE public.platform_type ADD VALUE IF NOT EXISTS 'google_analytics';
ALTER TYPE public.platform_type ADD VALUE IF NOT EXISTS 'google_business_profile';
