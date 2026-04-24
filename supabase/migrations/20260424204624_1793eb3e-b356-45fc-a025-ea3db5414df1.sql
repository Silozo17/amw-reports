
-- 1. clients.services_offered (text[] default '{}')
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS services_offered text[] NOT NULL DEFAULT '{}'::text[];

-- 2. content_lab_credits: bucket columns
ALTER TABLE public.content_lab_credits
  ADD COLUMN IF NOT EXISTS monthly_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now());

-- Backfill: existing single `balance` is treated as paid top-ups.
UPDATE public.content_lab_credits
   SET paid_balance = balance
 WHERE paid_balance = 0 AND balance > 0;

-- 3. ledger.bucket (so refunds know where to put credit back)
ALTER TABLE public.content_lab_credit_ledger
  ADD COLUMN IF NOT EXISTS bucket text;

-- 4. Replace spend RPC: monthly first, then paid.
CREATE OR REPLACE FUNCTION public.spend_content_lab_credit(
  _org_id uuid,
  _amount integer,
  _reason text,
  _run_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _ledger_id uuid;
  _tier text;
  _monthly_quota int;
  _current_period timestamptz := date_trunc('month', now());
  _bucket text;
  _from_monthly int := 0;
  _from_paid int := 0;
  _row record;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  -- Look up org's monthly Content Lab quota from the active subscription.
  SELECT content_lab_tier INTO _tier
    FROM public.org_subscriptions
   WHERE org_id = _org_id AND status = 'active'
   LIMIT 1;

  _monthly_quota := CASE lower(coalesce(_tier, ''))
    WHEN 'starter' THEN 3
    WHEN 'growth'  THEN 5
    WHEN 'scale'   THEN 20
    ELSE 0
  END;

  -- Ensure row exists.
  INSERT INTO public.content_lab_credits (org_id, balance, monthly_balance, paid_balance, monthly_period_start)
       VALUES (_org_id, 0, _monthly_quota, 0, _current_period)
  ON CONFLICT (org_id) DO NOTHING;

  -- Lazy reset of monthly bucket if the period has rolled over.
  UPDATE public.content_lab_credits
     SET monthly_balance = _monthly_quota,
         monthly_period_start = _current_period,
         updated_at = now()
   WHERE org_id = _org_id
     AND monthly_period_start < _current_period;

  -- Lock the row so concurrent runs can't double-spend.
  SELECT * INTO _row FROM public.content_lab_credits WHERE org_id = _org_id FOR UPDATE;

  IF (_row.monthly_balance + _row.paid_balance) < _amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  -- Spend monthly first, then paid.
  IF _row.monthly_balance >= _amount THEN
    _from_monthly := _amount;
    _bucket := 'monthly';
  ELSIF _row.monthly_balance > 0 THEN
    _from_monthly := _row.monthly_balance;
    _from_paid := _amount - _from_monthly;
    _bucket := 'mixed';
  ELSE
    _from_paid := _amount;
    _bucket := 'paid';
  END IF;

  UPDATE public.content_lab_credits
     SET monthly_balance = monthly_balance - _from_monthly,
         paid_balance    = paid_balance    - _from_paid,
         balance         = balance - _amount,
         lifetime_used   = lifetime_used + _amount,
         updated_at      = now()
   WHERE org_id = _org_id;

  INSERT INTO public.content_lab_credit_ledger (org_id, delta, reason, run_id, bucket)
  VALUES (_org_id, -_amount, _reason, _run_id, _bucket)
  RETURNING id INTO _ledger_id;

  -- For mixed spends record both legs in metadata-style separate rows so
  -- refunds can find the split. Keep main ledger row authoritative.
  IF _bucket = 'mixed' THEN
    INSERT INTO public.content_lab_credit_ledger (org_id, delta, reason, run_id, bucket)
    VALUES (_org_id, 0, _reason || ':split_monthly:' || _from_monthly::text, _run_id, 'monthly');
    INSERT INTO public.content_lab_credit_ledger (org_id, delta, reason, run_id, bucket)
    VALUES (_org_id, 0, _reason || ':split_paid:' || _from_paid::text, _run_id, 'paid');
  END IF;

  RETURN _ledger_id;
END;
$function$;

-- 5. Replace refund RPC: route back to original bucket(s).
CREATE OR REPLACE FUNCTION public.refund_content_lab_credit(
  _ledger_id uuid,
  _refund_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _org_id uuid;
  _delta integer;
  _bucket text;
  _run_id uuid;
  _split_monthly int := 0;
  _split_paid int := 0;
BEGIN
  SELECT org_id, -delta, bucket, run_id
    INTO _org_id, _delta, _bucket, _run_id
    FROM public.content_lab_credit_ledger
   WHERE id = _ledger_id;

  IF _org_id IS NULL THEN RAISE EXCEPTION 'Ledger entry not found'; END IF;
  IF _delta <= 0 THEN RAISE EXCEPTION 'Cannot refund a non-spend ledger entry'; END IF;

  IF _bucket = 'mixed' THEN
    -- Reconstruct the split from the two zero-delta marker rows.
    SELECT
      coalesce(sum(CASE WHEN bucket = 'monthly' AND reason LIKE '%:split_monthly:%' THEN
        nullif(split_part(reason, ':split_monthly:', 2), '')::int END), 0),
      coalesce(sum(CASE WHEN bucket = 'paid' AND reason LIKE '%:split_paid:%' THEN
        nullif(split_part(reason, ':split_paid:', 2), '')::int END), 0)
    INTO _split_monthly, _split_paid
    FROM public.content_lab_credit_ledger
    WHERE run_id = _run_id AND delta = 0;
  ELSIF _bucket = 'monthly' THEN
    _split_monthly := _delta;
  ELSE
    _split_paid := _delta;
  END IF;

  UPDATE public.content_lab_credits
     SET monthly_balance = monthly_balance + _split_monthly,
         paid_balance    = paid_balance + _split_paid,
         balance         = balance + _delta,
         lifetime_used   = GREATEST(lifetime_used - _delta, 0),
         updated_at      = now()
   WHERE org_id = _org_id;

  INSERT INTO public.content_lab_credit_ledger (org_id, delta, reason, run_id, bucket)
  VALUES (_org_id, _delta, _refund_reason,
          _run_id,
          CASE WHEN _bucket = 'mixed' THEN 'mixed' ELSE _bucket END);
END;
$function$;

-- 6. Replace add (top-up) RPC: paid bucket only.
CREATE OR REPLACE FUNCTION public.add_content_lab_credits(
  _org_id uuid,
  _amount integer,
  _stripe_payment_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _new_total integer;
BEGIN
  INSERT INTO public.content_lab_credits (org_id, balance, paid_balance, lifetime_purchased)
  VALUES (_org_id, _amount, _amount, _amount)
  ON CONFLICT (org_id) DO UPDATE
    SET paid_balance       = public.content_lab_credits.paid_balance + _amount,
        balance            = public.content_lab_credits.balance + _amount,
        lifetime_purchased = public.content_lab_credits.lifetime_purchased + _amount,
        updated_at = now()
  RETURNING balance INTO _new_total;

  INSERT INTO public.content_lab_credit_ledger (org_id, delta, reason, stripe_payment_id, bucket)
  VALUES (_org_id, _amount, 'top_up', _stripe_payment_id, 'paid');

  RETURN _new_total;
END;
$function$;
