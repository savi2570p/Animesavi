CREATE OR REPLACE FUNCTION public.redeem_unlock_token(
  _token text,
  _user_id uuid DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS TABLE(id uuid, duration_hours integer, expires_at bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tok RECORD;
  _expires_at bigint;
BEGIN
  SELECT t.id, t.duration_hours, t.is_active
    INTO _tok
    FROM public.unlock_tokens t
   WHERE t.token = _token
     AND t.is_active = true
     AND t.token <> '__system_toggle__'
   LIMIT 1;

  IF _tok.id IS NULL THEN
    RETURN;
  END IF;

  _expires_at := (EXTRACT(EPOCH FROM now()) * 1000)::bigint
                 + (_tok.duration_hours::bigint * 3600 * 1000);

  INSERT INTO public.token_usage (token_id, user_id, user_agent, expires_at)
  VALUES (_tok.id, _user_id, _user_agent, _expires_at);

  RETURN QUERY SELECT _tok.id, _tok.duration_hours, _expires_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_unlock_token(text, uuid, text) TO anon, authenticated;