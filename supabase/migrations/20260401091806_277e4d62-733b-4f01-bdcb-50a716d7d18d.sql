CREATE OR REPLACE FUNCTION public.get_portal_client(_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', c.id,
    'company_name', c.company_name,
    'full_name', c.full_name,
    'logo_url', c.logo_url,
    'preferred_currency', c.preferred_currency,
    'org_id', c.org_id,
    'show_health_score', c.show_health_score
  ) INTO result
  FROM public.clients c
  WHERE c.id = _client_id;
  RETURN result;
END;
$function$;