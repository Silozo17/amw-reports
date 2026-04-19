-- Add new statuses to content_lab_run_status enum
ALTER TYPE content_lab_run_status ADD VALUE IF NOT EXISTS 'discovering';
ALTER TYPE content_lab_run_status ADD VALUE IF NOT EXISTS 'completed_empty';

-- Extend content_lab_niches with auto-discovery + creative preferences
ALTER TABLE public.content_lab_niches
  ADD COLUMN IF NOT EXISTS own_handle text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS platforms_to_scrape text[] NOT NULL DEFAULT ARRAY['instagram'],
  ADD COLUMN IF NOT EXISTS niche_description text,
  ADD COLUMN IF NOT EXISTS top_competitors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS top_global_benchmarks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_styles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tone_of_voice text,
  ADD COLUMN IF NOT EXISTS producer_type text,
  ADD COLUMN IF NOT EXISTS video_length_preference text,
  ADD COLUMN IF NOT EXISTS posting_cadence text,
  ADD COLUMN IF NOT EXISTS do_not_use text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS discovered_at timestamptz;

-- Extend content_lab_ideas with platform targeting + status + script fields
ALTER TABLE public.content_lab_ideas
  ADD COLUMN IF NOT EXISTS target_platform text,
  ADD COLUMN IF NOT EXISTS platform_style_notes text,
  ADD COLUMN IF NOT EXISTS caption_with_hashtag text,
  ADD COLUMN IF NOT EXISTS script_full text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'not_started';

-- Constrain idea status to known values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_lab_ideas_status_check'
  ) THEN
    ALTER TABLE public.content_lab_ideas
      ADD CONSTRAINT content_lab_ideas_status_check
      CHECK (status IN ('not_started','in_production','posted'));
  END IF;
END $$;