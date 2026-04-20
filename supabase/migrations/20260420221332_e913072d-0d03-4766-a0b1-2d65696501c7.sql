CREATE OR REPLACE FUNCTION public.consume_content_lab_credit(_org_id uuid, _run_id uuid, _amount integer DEFAULT 1)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Thin wrapper around spend_content_lab_credit so there is a single
  -- credit-spend code path and a single ledger row format. Returns false
  -- on insufficient credits instead of raising, to preserve the legacy
  -- contract used by content-lab-step-runner.
  BEGIN
    PERFORM public.spend_content_lab_credit(_org_id, _amount, 'run_consumed', _run_id);
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%INSUFFICIENT_CREDITS%' THEN
      RETURN false;
    END IF;
    RAISE;
  END;
END;
$function$;