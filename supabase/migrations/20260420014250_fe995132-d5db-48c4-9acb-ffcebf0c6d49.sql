CREATE OR REPLACE FUNCTION public.slugify_niche_tag(_label text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(regexp_replace(coalesce(_label, ''), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
$$;