ALTER TABLE public.org_subscriptions DROP CONSTRAINT IF EXISTS org_subscriptions_content_lab_tier_check;

UPDATE public.org_subscriptions
SET content_lab_tier = 'scale', updated_at = now()
WHERE content_lab_tier = 'agency';

UPDATE public.org_subscriptions
SET content_lab_tier = NULL, updated_at = now()
WHERE content_lab_tier IS NOT NULL
  AND content_lab_tier NOT IN ('starter', 'growth', 'scale');

ALTER TABLE public.org_subscriptions
  ADD CONSTRAINT org_subscriptions_content_lab_tier_check
  CHECK (
    content_lab_tier IS NULL
    OR content_lab_tier = ANY (ARRAY['starter'::text, 'growth'::text, 'scale'::text])
  );