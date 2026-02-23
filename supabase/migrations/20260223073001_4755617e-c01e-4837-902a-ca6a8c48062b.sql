CREATE OR REPLACE FUNCTION public.get_token_system_status()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.unlock_tokens WHERE token = '__system_toggle__' LIMIT 1),
    true
  );
$$;