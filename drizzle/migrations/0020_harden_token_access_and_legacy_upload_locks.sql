DROP POLICY IF EXISTS "Users can only insert own token usage via valid token" ON public.token_usage;
REVOKE INSERT ON public.token_usage FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_active_token_access()
RETURNS TABLE(expires_at bigint, token_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT tu.expires_at, tu.token_id
  FROM public.token_usage tu
  JOIN public.unlock_tokens ut ON ut.id = tu.token_id
  WHERE tu.user_id = auth.uid()
    AND ut.is_active = true
    AND ut.token <> '__system_toggle__'
  ORDER BY tu.used_at DESC
  LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.get_my_active_token_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_active_token_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_token_duration(_token_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT ut.duration_hours
  FROM public.unlock_tokens ut
  JOIN public.token_usage tu ON tu.token_id = ut.id
  WHERE ut.id = _token_id
    AND tu.user_id = auth.uid()
  LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.get_token_duration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_token_duration(uuid) TO authenticated;

ALTER TABLE public.unlock_tokens
  ADD CONSTRAINT unlock_tokens_token_strength
  CHECK (token = '__system_toggle__' OR (length(token) >= 32 AND length(token) <= 128 AND token ~ '^[A-Za-z0-9_-]+$')) NOT VALID;

DROP POLICY IF EXISTS "Owner admin reads upload locks" ON public.upload_locks;
REVOKE ALL ON public.upload_locks FROM anon, authenticated;