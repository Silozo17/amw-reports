ALTER TABLE public.clients
  ADD COLUMN email_report_delivery boolean NOT NULL DEFAULT true,
  ADD COLUMN email_weekly_update boolean NOT NULL DEFAULT false,
  ADD COLUMN email_monthly_digest boolean NOT NULL DEFAULT true,
  ADD COLUMN email_alert_warnings boolean NOT NULL DEFAULT true,
  ADD COLUMN email_recipient_mode text NOT NULL DEFAULT 'agency';