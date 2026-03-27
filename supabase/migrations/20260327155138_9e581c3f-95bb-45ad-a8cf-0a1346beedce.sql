
-- notification_tracking table for deduplicating automated notifications
CREATE TABLE public.notification_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  reference_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_type, reference_id)
);
ALTER TABLE public.notification_tracking ENABLE ROW LEVEL SECURITY;

-- known_devices table for security event tracking
CREATE TABLE public.known_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip_hash text NOT NULL,
  ua_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, ip_hash, ua_hash)
);
ALTER TABLE public.known_devices ENABLE ROW LEVEL SECURITY;

-- Add digest_enabled to organisations
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS digest_enabled boolean NOT NULL DEFAULT true;

-- SECURITY DEFINER function to safely read auth audit log entries
CREATE OR REPLACE FUNCTION public.get_recent_auth_events(_since timestamptz)
RETURNS TABLE(id uuid, user_id uuid, ip text, factor_type text, created_at timestamptz, payload jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ae.id,
    (ae.payload->>'actor_id')::uuid as user_id,
    ae.ip_address::text as ip,
    (ae.payload->>'action')::text as factor_type,
    ae.created_at,
    ae.payload
  FROM auth.audit_log_entries ae
  WHERE ae.created_at > _since
  AND (ae.payload->>'action') IN ('login', 'user_signedup', 'login_failed')
  ORDER BY ae.created_at DESC
$$;
