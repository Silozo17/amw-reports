CREATE OR REPLACE FUNCTION public.admin_adjust_content_lab_credits(
  _org_id uuid,
  _delta integer,
  _reason text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance integer;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: platform admin only';
  END IF;

  IF _delta = 0 THEN
    RAISE EXCEPTION 'delta cannot be zero';
  END IF;

  INSERT INTO public.content_lab_credits (org_id, balance)
  VALUES (_org_id, 0)
  ON CONFLICT (org_id) DO NOTHING;

  UPDATE public.content_lab_credits
  SET balance = GREATEST(balance + _delta, 0),
      lifetime_purchased = CASE WHEN _delta > 0 THEN lifetime_purchased + _delta ELSE lifetime_purchased END,
      updated_at = now()
  WHERE org_id = _org_id
  RETURNING balance INTO _new_balance;

  INSERT INTO public.content_lab_credit_ledger (org_id, delta, reason)
  VALUES (_org_id, _delta, COALESCE(_reason, 'admin_adjust'));

  RETURN _new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_content_lab_tier(
  _org_id uuid,
  _tier text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: platform admin only';
  END IF;

  IF _tier IS NOT NULL AND _tier NOT IN ('starter','growth','scale') THEN
    RAISE EXCEPTION 'invalid tier: must be starter, growth, scale, or null';
  END IF;

  UPDATE public.org_subscriptions
  SET content_lab_tier = _tier,
      content_lab_onboarded_at = COALESCE(content_lab_onboarded_at, CASE WHEN _tier IS NOT NULL THEN now() ELSE NULL END),
      updated_at = now()
  WHERE org_id = _org_id;
END;
$$;