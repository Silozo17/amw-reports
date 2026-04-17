-- Add toggle on clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS show_portal_upsells boolean NOT NULL DEFAULT true;

-- Category enum
DO $$ BEGIN
  CREATE TYPE public.portal_upsell_category AS ENUM ('paid_ads', 'seo', 'organic_content', 'email', 'web', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- New table
CREATE TABLE IF NOT EXISTS public.client_portal_upsells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category public.portal_upsell_category NOT NULL DEFAULT 'other',
  title text NOT NULL,
  description text,
  price_label text,
  cta_label text NOT NULL DEFAULT 'Get in touch',
  cta_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_portal_upsells_client ON public.client_portal_upsells(client_id, is_active, sort_order);

ALTER TABLE public.client_portal_upsells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view portal upsells"
ON public.client_portal_upsells FOR SELECT TO authenticated
USING (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Org members can manage portal upsells"
ON public.client_portal_upsells FOR ALL TO authenticated
USING (user_belongs_to_org(auth.uid(), org_id))
WITH CHECK (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Platform admins can manage portal upsells"
ON public.client_portal_upsells FOR ALL TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE TRIGGER trg_client_portal_upsells_updated
BEFORE UPDATE ON public.client_portal_upsells
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();