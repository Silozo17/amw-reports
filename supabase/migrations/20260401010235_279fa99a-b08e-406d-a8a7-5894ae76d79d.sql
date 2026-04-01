
-- Add optional date range columns for custom-period reports
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS date_from date,
  ADD COLUMN IF NOT EXISTS date_to date;

-- Add unique constraint for custom-range reports (when date_from/date_to are set)
CREATE UNIQUE INDEX IF NOT EXISTS reports_client_date_range_unique
  ON public.reports (client_id, date_from, date_to)
  WHERE date_from IS NOT NULL AND date_to IS NOT NULL;
