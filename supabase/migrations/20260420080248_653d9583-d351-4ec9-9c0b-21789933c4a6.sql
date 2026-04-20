-- Track regen/remix activity per idea
ALTER TABLE public.content_lab_ideas
  ADD COLUMN IF NOT EXISTS regen_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remix_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_modified_via text;

-- Webhook idempotency (event-level, not payment-level)
ALTER TABLE public.content_lab_credit_ledger
  ADD COLUMN IF NOT EXISTS stripe_event_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'content_lab_credit_ledger_stripe_event_id_key'
  ) THEN
    ALTER TABLE public.content_lab_credit_ledger
      ADD CONSTRAINT content_lab_credit_ledger_stripe_event_id_key UNIQUE (stripe_event_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_content_lab_credit_ledger_event
  ON public.content_lab_credit_ledger(stripe_event_id);

-- Rate-limit lookup index for manual pool refresh
CREATE INDEX IF NOT EXISTS idx_pool_refresh_org_created
  ON public.content_lab_pool_refresh_jobs(triggered_by_org_id, created_at DESC);

-- Atomic credit spend
CREATE OR REPLACE FUNCTION public.spend_content_lab_credit(
  _org_id uuid,
  _amount integer,
  _reason text,
  _run_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ledger_id uuid;
  _new_balance integer;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  INSERT INTO public.content_lab_credits (org_id, balance) VALUES (_org_id, 0)
  ON CONFLICT (org_id) DO NOTHING;

  UPDATE public.content_lab_credits
  SET balance = balance - _amount,
      lifetime_used = lifetime_used + _amount,
      updated_at = now()
  WHERE org_id = _org_id AND balance >= _amount
  RETURNING balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  INSERT INTO public.content_lab_credit_ledger (org_id, delta, reason, run_id)
  VALUES (_org_id, -_amount, _reason, _run_id)
  RETURNING id INTO _ledger_id;

  RETURN _ledger_id;
END;
$$;

-- Refund a previous spend
CREATE OR REPLACE FUNCTION public.refund_content_lab_credit(
  _ledger_id uuid,
  _refund_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org_id uuid;
  _delta integer;
BEGIN
  SELECT org_id, -delta INTO _org_id, _delta
  FROM public.content_lab_credit_ledger
  WHERE id = _ledger_id;

  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'Ledger entry not found';
  END IF;

  IF _delta <= 0 THEN
    RAISE EXCEPTION 'Cannot refund a non-spend ledger entry';
  END IF;

  UPDATE public.content_lab_credits
  SET balance = balance + _delta,
      lifetime_used = GREATEST(lifetime_used - _delta, 0),
      updated_at = now()
  WHERE org_id = _org_id;

  INSERT INTO public.content_lab_credit_ledger (org_id, delta, reason)
  VALUES (_org_id, _delta, _refund_reason);
END;
$$;