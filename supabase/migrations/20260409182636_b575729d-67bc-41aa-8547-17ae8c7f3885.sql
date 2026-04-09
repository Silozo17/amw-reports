CREATE TABLE public.voice_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  report_month integer NOT NULL,
  report_year integer NOT NULL,
  storage_path text NOT NULL,
  generated_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, report_month, report_year)
);

ALTER TABLE public.voice_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage voice briefings"
  ON public.voice_briefings
  FOR ALL TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id))
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Client users can view voice briefings"
  ON public.voice_briefings
  FOR SELECT TO authenticated
  USING (is_client_user(auth.uid(), client_id));

CREATE POLICY "Platform admins can view all voice briefings"
  ON public.voice_briefings
  FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));