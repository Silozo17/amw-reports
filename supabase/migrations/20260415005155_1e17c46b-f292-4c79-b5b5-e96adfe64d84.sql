ALTER TABLE public.reports
ADD CONSTRAINT reports_client_id_month_year_unique
UNIQUE (client_id, report_month, report_year);