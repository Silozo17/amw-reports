CREATE OR REPLACE VIEW public.v_content_lab_mrr_by_tier AS
SELECT
  COALESCE(os.content_lab_tier, 'none') AS tier,
  COUNT(DISTINCT os.org_id) AS org_count,
  COALESCE(SUM(sp.base_price), 0)::numeric(12,2) AS mrr_gbp
FROM public.org_subscriptions os
LEFT JOIN public.subscription_plans sp ON sp.id = os.plan_id
WHERE os.status = 'active'
GROUP BY COALESCE(os.content_lab_tier, 'none');

CREATE OR REPLACE VIEW public.v_content_lab_run_completion AS
SELECT
  COALESCE(n.industry_slug, 'unknown') AS industry_slug,
  COUNT(*) FILTER (WHERE r.status IN ('completed','completed_empty')) AS completed,
  COUNT(*) FILTER (WHERE r.status = 'failed') AS failed,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE r.status IN ('completed','completed_empty')) / NULLIF(COUNT(*), 0), 1) AS completion_rate_pct
FROM public.content_lab_runs r
JOIN public.content_lab_niches n ON n.id = r.niche_id
GROUP BY COALESCE(n.industry_slug, 'unknown');

CREATE OR REPLACE VIEW public.v_content_lab_pool_quality AS
SELECT
  COALESCE(n.industry_slug, 'unknown') AS industry_slug,
  COUNT(*) AS niche_count,
  COUNT(*) FILTER (WHERE n.pool_status = 'limited') AS limited_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE n.pool_status = 'limited') / NULLIF(COUNT(*), 0), 1) AS limited_pct
FROM public.content_lab_niches n
GROUP BY COALESCE(n.industry_slug, 'unknown');

CREATE OR REPLACE VIEW public.v_content_lab_churn_signals AS
SELECT
  o.id AS org_id,
  o.name AS org_name,
  os.content_lab_tier,
  MAX(r.created_at) AS last_run_at,
  COUNT(r.id) AS lifetime_runs,
  COALESCE(MAX(c.balance), 0) AS current_credit_balance,
  EXTRACT(DAY FROM now() - MAX(r.created_at))::int AS days_since_last_run
FROM public.organisations o
JOIN public.org_subscriptions os ON os.org_id = o.id AND os.status = 'active'
LEFT JOIN public.content_lab_runs r ON r.org_id = o.id
LEFT JOIN public.content_lab_credits c ON c.org_id = o.id
WHERE os.content_lab_tier IS NOT NULL AND os.content_lab_tier <> 'none'
GROUP BY o.id, o.name, os.content_lab_tier
HAVING MAX(r.created_at) IS NULL OR MAX(r.created_at) < now() - interval '21 days';

CREATE OR REPLACE VIEW public.v_content_lab_regen_rate AS
SELECT
  r.id AS run_id,
  r.org_id,
  AVG(i.regen_count)::numeric(10,2) AS avg_regens_per_idea,
  COUNT(i.id) AS idea_count
FROM public.content_lab_runs r
JOIN public.content_lab_ideas i ON i.run_id = r.id
GROUP BY r.id, r.org_id;

REVOKE ALL ON public.v_content_lab_mrr_by_tier FROM anon, authenticated;
REVOKE ALL ON public.v_content_lab_run_completion FROM anon, authenticated;
REVOKE ALL ON public.v_content_lab_pool_quality FROM anon, authenticated;
REVOKE ALL ON public.v_content_lab_churn_signals FROM anon, authenticated;
REVOKE ALL ON public.v_content_lab_regen_rate FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_content_lab_analytics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN jsonb_build_object(
    'mrr_by_tier', COALESCE((SELECT jsonb_agg(row_to_json(v)) FROM public.v_content_lab_mrr_by_tier v), '[]'::jsonb),
    'run_completion', COALESCE((SELECT jsonb_agg(row_to_json(v)) FROM public.v_content_lab_run_completion v), '[]'::jsonb),
    'pool_quality', COALESCE((SELECT jsonb_agg(row_to_json(v)) FROM public.v_content_lab_pool_quality v), '[]'::jsonb),
    'churn_signals', COALESCE((SELECT jsonb_agg(row_to_json(v)) FROM public.v_content_lab_churn_signals v), '[]'::jsonb),
    'regen_rate_avg', (SELECT AVG(avg_regens_per_idea)::numeric(10,2) FROM public.v_content_lab_regen_rate)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_content_lab_analytics() TO authenticated;