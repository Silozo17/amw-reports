
-- Create custom_domains table
CREATE TABLE public.custom_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  domain text NOT NULL,
  verification_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  verified_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain)
);

-- Enable RLS
ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

-- Org members can view their domains
CREATE POLICY "Org members can view domains"
  ON public.custom_domains FOR SELECT
  TO authenticated
  USING (org_id = user_org_id(auth.uid()));

-- Org owners can manage domains
CREATE POLICY "Org owners can manage domains"
  ON public.custom_domains FOR ALL
  TO authenticated
  USING (org_id = user_org_id(auth.uid()) AND is_org_owner(auth.uid()));

-- Security definer function to look up org by verified domain (for portal)
CREATE OR REPLACE FUNCTION public.get_org_by_domain(_domain text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT org_id FROM public.custom_domains
  WHERE domain = _domain AND verified_at IS NOT NULL AND is_active = true
  LIMIT 1;
$$;
