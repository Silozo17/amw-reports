CREATE TABLE public.onboarding_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  account_type text NOT NULL,
  platforms_used text[] DEFAULT '{}',
  client_count text,
  primary_reason text,
  referral_source text,
  biggest_challenge text,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own onboarding" ON public.onboarding_responses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own onboarding" ON public.onboarding_responses
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Platform admins can view all onboarding" ON public.onboarding_responses
  FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));

ALTER TABLE public.profiles ADD COLUMN onboarding_completed boolean DEFAULT false;