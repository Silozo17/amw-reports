
-- 1. Benchmark pool (shared across clients/orgs by niche_tag + platform)
CREATE TABLE public.content_lab_benchmark_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_tag text NOT NULL,
  platform text NOT NULL,
  handle text NOT NULL,
  display_name text,
  follower_count integer,
  median_views integer,
  median_engagement_rate numeric,
  posts_analysed integer DEFAULT 0,
  last_post_at timestamptz,
  thumbnail_url text,
  profile_url text,
  status text NOT NULL DEFAULT 'verified',
  rejection_reason text,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (niche_tag, platform, handle)
);

CREATE INDEX idx_benchmark_pool_lookup ON public.content_lab_benchmark_pool (niche_tag, platform, status);
CREATE INDEX idx_benchmark_pool_verified ON public.content_lab_benchmark_pool (verified_at);

ALTER TABLE public.content_lab_benchmark_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view verified benchmarks"
ON public.content_lab_benchmark_pool FOR SELECT TO authenticated
USING (status = 'verified');

CREATE POLICY "Platform admins can manage benchmarks"
ON public.content_lab_benchmark_pool FOR ALL TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE TRIGGER trg_benchmark_pool_updated_at
BEFORE UPDATE ON public.content_lab_benchmark_pool
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Pool refresh job queue
CREATE TABLE public.content_lab_pool_refresh_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_tag text NOT NULL,
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  candidates_found integer DEFAULT 0,
  candidates_verified integer DEFAULT 0,
  triggered_by_org_id uuid,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pool_refresh_status ON public.content_lab_pool_refresh_jobs (status, created_at);
CREATE INDEX idx_pool_refresh_niche ON public.content_lab_pool_refresh_jobs (niche_tag, platform);

ALTER TABLE public.content_lab_pool_refresh_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their refresh jobs"
ON public.content_lab_pool_refresh_jobs FOR SELECT TO authenticated
USING (triggered_by_org_id IS NULL OR user_belongs_to_org(auth.uid(), triggered_by_org_id));

CREATE POLICY "Platform admins can manage refresh jobs"
ON public.content_lab_pool_refresh_jobs FOR ALL TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE TRIGGER trg_pool_refresh_updated_at
BEFORE UPDATE ON public.content_lab_pool_refresh_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Credit balances per org
CREATE TABLE public.content_lab_credits (
  org_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  lifetime_purchased integer NOT NULL DEFAULT 0,
  lifetime_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_lab_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view own credits"
ON public.content_lab_credits FOR SELECT TO authenticated
USING (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Platform admins can manage credits"
ON public.content_lab_credits FOR ALL TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE TRIGGER trg_credits_updated_at
BEFORE UPDATE ON public.content_lab_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Credit ledger (audit trail)
CREATE TABLE public.content_lab_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  run_id uuid,
  stripe_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_ledger_org ON public.content_lab_credit_ledger (org_id, created_at DESC);

ALTER TABLE public.content_lab_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view own ledger"
ON public.content_lab_credit_ledger FOR SELECT TO authenticated
USING (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Platform admins can view all ledger"
ON public.content_lab_credit_ledger FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()));

-- 5. Add niche_tag + pool_status to niches
ALTER TABLE public.content_lab_niches
  ADD COLUMN IF NOT EXISTS niche_tag text,
  ADD COLUMN IF NOT EXISTS pool_status text NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_niches_niche_tag ON public.content_lab_niches (niche_tag);

-- 6. Atomic credit consumption function
CREATE OR REPLACE FUNCTION public.consume_content_lab_credit(_org_id uuid, _run_id uuid, _amount integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance integer;
BEGIN
  INSERT INTO public.content_lab_credits (org_id, balance)
  VALUES (_org_id, 0)
  ON CONFLICT (org_id) DO NOTHING;

  UPDATE public.content_lab_credits
  SET balance = balance - _amount,
      lifetime_used = lifetime_used + _amount,
      updated_at = now()
  WHERE org_id = _org_id AND balance >= _amount
  RETURNING balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.content_lab_credit_ledger (org_id, delta, reason, run_id)
  VALUES (_org_id, -_amount, 'run_consumed', _run_id);

  RETURN true;
END;
$$;

-- 7. Add credits function (used by Stripe webhook)
CREATE OR REPLACE FUNCTION public.add_content_lab_credits(_org_id uuid, _amount integer, _stripe_payment_id text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance integer;
BEGIN
  INSERT INTO public.content_lab_credits (org_id, balance, lifetime_purchased)
  VALUES (_org_id, _amount, _amount)
  ON CONFLICT (org_id) DO UPDATE
    SET balance = public.content_lab_credits.balance + _amount,
        lifetime_purchased = public.content_lab_credits.lifetime_purchased + _amount,
        updated_at = now()
  RETURNING balance INTO _new_balance;

  INSERT INTO public.content_lab_credit_ledger (org_id, delta, reason, stripe_payment_id)
  VALUES (_org_id, _amount, 'top_up', _stripe_payment_id);

  RETURN _new_balance;
END;
$$;
