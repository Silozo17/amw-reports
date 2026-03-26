
-- 1. Add account_type column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'business';

-- 2. Update handle_new_user trigger to auto-create org + membership + starter plan
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org_id uuid;
  _org_name text;
  _starter_plan_id uuid;
  _existing_org_id uuid;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  -- Check if user was invited to an org
  UPDATE public.org_members
  SET user_id = NEW.id, accepted_at = now()
  WHERE invited_email = NEW.email AND user_id IS NULL;

  -- Check if user joined an org via invite
  SELECT org_id INTO _existing_org_id
  FROM public.org_members
  WHERE user_id = NEW.id
  LIMIT 1;

  IF _existing_org_id IS NOT NULL THEN
    -- User was invited, set their profile org_id
    UPDATE public.profiles
    SET org_id = _existing_org_id
    WHERE user_id = NEW.id;
  ELSE
    -- No invite found — create a new org for this user
    _org_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NEW.email
    );

    INSERT INTO public.organisations (name, slug, created_by)
    VALUES (
      _org_name,
      LOWER(REGEXP_REPLACE(REGEXP_REPLACE(_org_name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')),
      NEW.id
    )
    RETURNING id INTO _org_id;

    -- Create org membership (owner)
    INSERT INTO public.org_members (org_id, user_id, role, accepted_at)
    VALUES (_org_id, NEW.id, 'owner', now());

    -- Set profile org_id
    UPDATE public.profiles
    SET org_id = _org_id
    WHERE user_id = NEW.id;

    -- Auto-assign Starter plan
    SELECT id INTO _starter_plan_id
    FROM public.subscription_plans
    WHERE slug = 'starter'
    LIMIT 1;

    IF _starter_plan_id IS NOT NULL THEN
      INSERT INTO public.org_subscriptions (org_id, plan_id, status)
      VALUES (_org_id, _starter_plan_id, 'active');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Re-attach trigger (in case it was dropped)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
