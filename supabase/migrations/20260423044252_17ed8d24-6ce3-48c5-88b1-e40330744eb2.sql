
-- 1. UNLOCK_TOKENS: remove public read, replace with server-side verifier
DROP POLICY IF EXISTS "Anyone can read active tokens for verification" ON public.unlock_tokens;

-- Secure verification function: takes a token string, returns minimal details
-- if it is active. Does not expose other tokens.
CREATE OR REPLACE FUNCTION public.verify_unlock_token(_token text)
RETURNS TABLE(id uuid, duration_hours integer, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, duration_hours, is_active
  FROM public.unlock_tokens
  WHERE token = _token
    AND is_active = true
    AND token <> '__system_toggle__'
  LIMIT 1;
$$;

-- Allow any caller (including anon) to call the verifier
GRANT EXECUTE ON FUNCTION public.verify_unlock_token(text) TO anon, authenticated;

-- Helper: read duration_hours by id (used in VerifyTokenDialog)
CREATE OR REPLACE FUNCTION public.get_token_duration(_token_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT duration_hours FROM public.unlock_tokens WHERE id = _token_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_token_duration(uuid) TO anon, authenticated;

-- 2. VIDEO_CONVERSIONS: restrict SELECT to uploaders/admins
DROP POLICY IF EXISTS "Video conversions are viewable by everyone" ON public.video_conversions;

CREATE POLICY "Uploaders and admins can view conversions"
ON public.video_conversions
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'uploader'::app_role)
);

-- 3. ANIME: remove "uploader_id IS NULL" privilege escalation in DELETE
DROP POLICY IF EXISTS "Users can delete anime they uploaded or admins" ON public.anime;

CREATE POLICY "Users can delete anime they uploaded or admins"
ON public.anime
FOR DELETE
USING (
  uploader_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 4. TOKEN_USAGE: tighten insert to only accept an active, real token
DROP POLICY IF EXISTS "Anyone can insert token usage" ON public.token_usage;

CREATE POLICY "Anyone can insert valid token usage"
ON public.token_usage
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.unlock_tokens t
    WHERE t.id = token_usage.token_id
      AND t.is_active = true
      AND t.token <> '__system_toggle__'
  )
);
