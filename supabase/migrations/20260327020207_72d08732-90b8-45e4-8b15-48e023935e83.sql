
CREATE TABLE public.report_upsells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  report_month integer NOT NULL CHECK (report_month >= 1 AND report_month <= 12),
  report_year integer NOT NULL,
  service_name text NOT NULL,
  headline text NOT NULL,
  body_content text NOT NULL,
  comparison_data jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(user_id)
);

ALTER TABLE public.report_upsells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view upsells"
  ON public.report_upsells FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Org members can manage upsells"
  ON public.report_upsells FOR ALL TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id))
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));
