
CREATE TABLE public.content_lab_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  runs_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, year, month)
);

CREATE INDEX idx_content_lab_usage_org_period ON public.content_lab_usage(org_id, year, month);

ALTER TABLE public.content_lab_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view own usage"
ON public.content_lab_usage
FOR SELECT
TO authenticated
USING (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Platform admins can view all usage"
ON public.content_lab_usage
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE TRIGGER update_content_lab_usage_updated_at
BEFORE UPDATE ON public.content_lab_usage
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic increment helper (service role only via SECURITY DEFINER; gated by org membership check)
CREATE OR REPLACE FUNCTION public.increment_content_lab_usage(_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _y integer := EXTRACT(YEAR FROM now() AT TIME ZONE 'UTC')::int;
  _m integer := EXTRACT(MONTH FROM now() AT TIME ZONE 'UTC')::int;
  _new_count integer;
BEGIN
  INSERT INTO public.content_lab_usage (org_id, year, month, runs_count)
  VALUES (_org_id, _y, _m, 1)
  ON CONFLICT (org_id, year, month)
  DO UPDATE SET runs_count = public.content_lab_usage.runs_count + 1,
                updated_at = now()
  RETURNING runs_count INTO _new_count;
  RETURN _new_count;
END;
$$;
