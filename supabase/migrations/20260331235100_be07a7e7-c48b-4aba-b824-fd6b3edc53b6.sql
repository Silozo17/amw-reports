
-- VULNERABILITY 1: Remove dangerous INSERT policy that lets any org member self-assign subscription plans
DROP POLICY IF EXISTS "Users can create own org subscription" ON public.org_subscriptions;

-- VULNERABILITY 2a: Server-side client limit enforcement
CREATE OR REPLACE FUNCTION public.check_client_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _override int;
  _included int;
  _additional int;
  _max int;
  _current int;
BEGIN
  SELECT os.override_max_clients, sp.included_clients, os.additional_clients
  INTO _override, _included, _additional
  FROM org_subscriptions os
  JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.org_id = NEW.org_id AND os.status = 'active'
  LIMIT 1;

  -- No active subscription found: allow only 1 client (starter default)
  IF NOT FOUND THEN
    SELECT count(*) INTO _current FROM clients WHERE org_id = NEW.org_id;
    IF _current >= 1 THEN
      RAISE EXCEPTION 'Client limit reached for this subscription plan';
    END IF;
    RETURN NEW;
  END IF;

  -- Unlimited override
  IF _override = -1 THEN RETURN NEW; END IF;

  _max := COALESCE(_override, _included + _additional);

  SELECT count(*) INTO _current FROM clients WHERE org_id = NEW.org_id;
  IF _current >= _max THEN
    RAISE EXCEPTION 'Client limit reached for this subscription plan';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_client_limit
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.check_client_limit();

-- VULNERABILITY 2b: Server-side connection limit enforcement
CREATE OR REPLACE FUNCTION public.check_connection_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _org_id uuid;
  _override int;
  _included int;
  _additional int;
  _max int;
  _current int;
BEGIN
  -- Only enforce when marking a connection as connected
  IF NEW.is_connected IS NOT TRUE THEN RETURN NEW; END IF;
  -- Skip if already connected (update that doesn't change connection status)
  IF TG_OP = 'UPDATE' AND OLD.is_connected = TRUE THEN RETURN NEW; END IF;

  -- Get org_id from the client
  SELECT c.org_id INTO _org_id FROM clients c WHERE c.id = NEW.client_id;
  IF _org_id IS NULL THEN RETURN NEW; END IF;

  SELECT os.override_max_connections, sp.included_connections, os.additional_connections
  INTO _override, _included, _additional
  FROM org_subscriptions os
  JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.org_id = _org_id AND os.status = 'active'
  LIMIT 1;

  -- No active subscription: starter default of 5 connections
  IF NOT FOUND THEN
    SELECT count(*) INTO _current
    FROM platform_connections pc
    JOIN clients c ON c.id = pc.client_id
    WHERE c.org_id = _org_id AND pc.is_connected = true;
    IF _current >= 5 THEN
      RAISE EXCEPTION 'Connection limit reached for this subscription plan';
    END IF;
    RETURN NEW;
  END IF;

  IF _override = -1 THEN RETURN NEW; END IF;

  _max := COALESCE(_override, _included + (_additional * 5));

  SELECT count(*) INTO _current
  FROM platform_connections pc
  JOIN clients c ON c.id = pc.client_id
  WHERE c.org_id = _org_id AND pc.is_connected = true;

  IF _current >= _max THEN
    RAISE EXCEPTION 'Connection limit reached for this subscription plan';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_connection_limit
  BEFORE INSERT OR UPDATE ON public.platform_connections
  FOR EACH ROW EXECUTE FUNCTION public.check_connection_limit();

-- VULNERABILITY 3: Server-side whitelabel gating
CREATE OR REPLACE FUNCTION public.check_whitelabel_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _has_whitelabel boolean;
  _branding_changed boolean;
BEGIN
  -- Check if any branding field is being changed to a non-null value
  _branding_changed := false;

  IF (NEW.logo_url IS DISTINCT FROM OLD.logo_url AND NEW.logo_url IS NOT NULL)
     OR (NEW.primary_color IS DISTINCT FROM OLD.primary_color AND NEW.primary_color IS NOT NULL)
     OR (NEW.secondary_color IS DISTINCT FROM OLD.secondary_color AND NEW.secondary_color IS NOT NULL)
     OR (NEW.accent_color IS DISTINCT FROM OLD.accent_color AND NEW.accent_color IS NOT NULL)
     OR (NEW.heading_font IS DISTINCT FROM OLD.heading_font AND NEW.heading_font IS NOT NULL AND NEW.heading_font != 'Anton')
     OR (NEW.body_font IS DISTINCT FROM OLD.body_font AND NEW.body_font IS NOT NULL AND NEW.body_font != 'Inter')
     OR (NEW.button_color IS DISTINCT FROM OLD.button_color AND NEW.button_color IS NOT NULL)
     OR (NEW.button_text_color IS DISTINCT FROM OLD.button_text_color AND NEW.button_text_color IS NOT NULL)
     OR (NEW.text_on_dark IS DISTINCT FROM OLD.text_on_dark AND NEW.text_on_dark IS NOT NULL)
     OR (NEW.text_on_light IS DISTINCT FROM OLD.text_on_light AND NEW.text_on_light IS NOT NULL)
     OR (NEW.chart_color_1 IS DISTINCT FROM OLD.chart_color_1 AND NEW.chart_color_1 IS NOT NULL)
     OR (NEW.chart_color_2 IS DISTINCT FROM OLD.chart_color_2 AND NEW.chart_color_2 IS NOT NULL)
     OR (NEW.chart_color_3 IS DISTINCT FROM OLD.chart_color_3 AND NEW.chart_color_3 IS NOT NULL)
     OR (NEW.chart_color_4 IS DISTINCT FROM OLD.chart_color_4 AND NEW.chart_color_4 IS NOT NULL)
  THEN
    _branding_changed := true;
  END IF;

  IF NOT _branding_changed THEN RETURN NEW; END IF;

  -- Check if org has whitelabel access
  SELECT sp.has_whitelabel INTO _has_whitelabel
  FROM org_subscriptions os
  JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.org_id = NEW.id AND os.status = 'active'
  LIMIT 1;

  IF _has_whitelabel IS NOT TRUE THEN
    RAISE EXCEPTION 'White-label features require an Agency subscription plan';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_whitelabel_access
  BEFORE UPDATE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.check_whitelabel_access();
