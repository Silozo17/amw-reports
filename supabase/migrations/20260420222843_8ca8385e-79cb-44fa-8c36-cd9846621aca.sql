-- ============================================================
-- cost_events: ledger of every paid external API call
-- ============================================================
CREATE TABLE public.cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  service text NOT NULL,           -- 'anthropic' | 'apify' | 'openai' | 'firecrawl'
  operation text NOT NULL,         -- e.g. 'analyse' | 'scrape_instagram' | 'whisper'
  amount_pence integer NOT NULL CHECK (amount_pence >= 0),
  run_id uuid,                     -- nullable; not all calls belong to a run
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_events_org_created ON public.cost_events (org_id, created_at DESC);
CREATE INDEX idx_cost_events_created ON public.cost_events (created_at DESC);
CREATE INDEX idx_cost_events_run ON public.cost_events (run_id) WHERE run_id IS NOT NULL;

ALTER TABLE public.cost_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view own cost events"
  ON public.cost_events FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Platform admins can view all cost events"
  ON public.cost_events FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

-- No insert/update/delete policies = service role only

-- ============================================================
-- platform_settings: global kill switch + future tunables
-- ============================================================
CREATE TABLE public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true), -- enforce single row
  spend_freeze_active boolean NOT NULL DEFAULT false,
  spend_freeze_reason text,
  spend_freeze_at timestamptz,
  spend_freeze_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_settings (id, spend_freeze_active) VALUES (true, false);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read platform settings"
  ON public.platform_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Platform admins can update platform settings"
  ON public.platform_settings FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- ============================================================
-- request_idempotency: replay-safe cache for mutating endpoints
-- ============================================================
CREATE TABLE public.request_idempotency (
  key text PRIMARY KEY,
  org_id uuid,
  endpoint text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_request_idempotency_created ON public.request_idempotency (created_at);

ALTER TABLE public.request_idempotency ENABLE ROW LEVEL SECURITY;
-- Service role only (no policies)

-- ============================================================
-- Helper: sum org spend in last N hours
-- ============================================================
CREATE OR REPLACE FUNCTION public.org_spend_pence_since(_org_id uuid, _since timestamptz)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount_pence), 0)::int
  FROM public.cost_events
  WHERE org_id = _org_id AND created_at >= _since
$$;

-- ============================================================
-- Helper: sum platform spend in last N hours
-- ============================================================
CREATE OR REPLACE FUNCTION public.platform_spend_pence_since(_since timestamptz)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount_pence), 0)::int
  FROM public.cost_events
  WHERE created_at >= _since
$$;

-- ============================================================
-- Helper: sum run spend (for per-run kill switch)
-- ============================================================
CREATE OR REPLACE FUNCTION public.run_spend_pence(_run_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount_pence), 0)::int
  FROM public.cost_events
  WHERE run_id = _run_id
$$;

-- ============================================================
-- Idempotency cleanup trigger: delete entries >24h on read
-- (we use a partial GC via the cron, but also a function admins can call)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_request_idempotency()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.request_idempotency
  WHERE created_at < now() - interval '24 hours'
$$;