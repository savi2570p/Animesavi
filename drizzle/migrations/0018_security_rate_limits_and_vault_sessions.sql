CREATE TABLE public.request_rate_limits (
  action text NOT NULL,
  key_hash text NOT NULL,
  window_started_at timestamp with time zone NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  expires_at timestamp with time zone NOT NULL,
  PRIMARY KEY (action, key_hash, window_started_at)
);
GRANT ALL ON public.request_rate_limits TO service_role;
ALTER TABLE public.request_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX request_rate_limits_expires_idx ON public.request_rate_limits (expires_at);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  _action text,
  _key_hash text,
  _limit integer,
  _window_seconds integer
)
RETURNS TABLE(allowed boolean, remaining integer, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _window_start timestamp with time zone;
  _count integer;
  _retry integer;
BEGIN
  IF _action !~ '^[a-z0-9:_-]{2,80}$' OR _key_hash !~ '^[0-9a-f]{64}$'
     OR _limit < 1 OR _limit > 10000 OR _window_seconds < 1 OR _window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;

  _window_start := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);

  INSERT INTO public.request_rate_limits (action, key_hash, window_started_at, expires_at)
  VALUES (_action, _key_hash, _window_start, _window_start + make_interval(secs => _window_seconds))
  ON CONFLICT (action, key_hash, window_started_at)
  DO UPDATE SET request_count = public.request_rate_limits.request_count + 1
  RETURNING request_count INTO _count;

  _retry := GREATEST(1, ceil(extract(epoch from (_window_start + make_interval(secs => _window_seconds) - now())))::integer);

  IF random() < 0.01 THEN
    DELETE FROM public.request_rate_limits WHERE expires_at < now();
  END IF;

  RETURN QUERY SELECT _count <= _limit, GREATEST(0, _limit - _count),
    CASE WHEN _count > _limit THEN _retry ELSE 0 END;
END;
$function$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, text, integer, integer) TO service_role;

CREATE TABLE public.shadow_flix_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.shadow_flix_sessions TO service_role;
ALTER TABLE public.shadow_flix_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX shadow_flix_sessions_expires_idx ON public.shadow_flix_sessions (expires_at);

CREATE OR REPLACE FUNCTION public.end_watch_party(party_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.watch_parties
  SET is_active = false
  WHERE id = party_uuid
    AND host_id = auth.uid()
    AND is_active = true;

  RETURN FOUND;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.end_watch_party(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_watch_party(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_token_metadata() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_token_metadata() TO authenticated;
REVOKE ALL ON FUNCTION public.unlock_my_upload(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_upload_locked() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_collection_likes_count() FROM PUBLIC, anon, authenticated;

ALTER VIEW public.anime_public SET (security_invoker = true);