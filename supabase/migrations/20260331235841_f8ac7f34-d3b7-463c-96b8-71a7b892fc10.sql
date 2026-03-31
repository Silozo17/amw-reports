
-- Fix 1: Drop dangerous org_members INSERT policy that lets users join any org
DROP POLICY IF EXISTS "Users can insert own membership" ON public.org_members;

-- Fix 2: Drop overly-permissive metric_defaults policy (platform admin ALL policy already covers management)
DROP POLICY IF EXISTS "Org owners can manage defaults" ON public.metric_defaults;
