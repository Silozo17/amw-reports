-- Share tokens table for client portal
CREATE TABLE public.client_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_share_tokens ENABLE ROW LEVEL SECURITY;

-- Org members can manage their own share tokens
CREATE POLICY "Org members can manage share tokens"
ON public.client_share_tokens FOR ALL TO authenticated
USING (org_id = user_org_id(auth.uid()));

-- Security definer function to validate a token publicly
CREATE OR REPLACE FUNCTION public.validate_share_token(_token text)
RETURNS TABLE(client_id uuid, org_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.client_id, t.org_id
  FROM public.client_share_tokens t
  WHERE t.token = _token
    AND t.is_active = true
    AND (t.expires_at IS NULL OR t.expires_at > now())
  LIMIT 1;
$$;

-- Security definer function to get client data for portal (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_portal_client(_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', c.id,
    'company_name', c.company_name,
    'full_name', c.full_name,
    'logo_url', c.logo_url,
    'preferred_currency', c.preferred_currency,
    'org_id', c.org_id
  ) INTO result
  FROM public.clients c
  WHERE c.id = _client_id;
  RETURN result;
END;
$$;

-- Security definer function to get org branding for portal
CREATE OR REPLACE FUNCTION public.get_portal_org(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'logo_url', o.logo_url,
    'primary_color', o.primary_color,
    'secondary_color', o.secondary_color,
    'accent_color', o.accent_color,
    'heading_font', o.heading_font,
    'body_font', o.body_font
  ) INTO result
  FROM public.organisations o
  WHERE o.id = _org_id;
  RETURN result;
END;
$$;

-- Security definer function to get snapshots for portal
CREATE OR REPLACE FUNCTION public.get_portal_snapshots(_client_id uuid, _month int, _year int)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'platform', s.platform,
      'metrics_data', s.metrics_data,
      'top_content', s.top_content,
      'report_month', s.report_month,
      'report_year', s.report_year
    )), '[]'::jsonb)
    FROM public.monthly_snapshots s
    WHERE s.client_id = _client_id
      AND s.report_month = _month
      AND s.report_year = _year
  );
END;
$$;