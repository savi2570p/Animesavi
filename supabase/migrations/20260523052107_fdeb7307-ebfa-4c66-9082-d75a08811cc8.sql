
-- 1. Restrict allowed_short_uploaders SELECT to admins; add helper function for client check
DROP POLICY IF EXISTS "Authenticated users can view allowed short uploaders" ON public.allowed_short_uploaders;

CREATE POLICY "Admins can view allowed short uploaders"
ON public.allowed_short_uploaders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.is_allowed_short_uploader(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.allowed_short_uploaders a
    JOIN auth.users u ON lower(u.email) = lower(a.email)
    WHERE u.id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_allowed_short_uploader(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_allowed_short_uploader(uuid) TO authenticated;

-- 2. allowed_uploaders: no SELECT policy needed for users; admins-only via ALL policy is fine.
-- Add explicit admin-only SELECT for clarity (no-op for non-admins).
CREATE POLICY "Admins can view allowed uploaders"
ON public.allowed_uploaders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix anime UPDATE policy: remove the (uploader_id IS NULL) bypass
DROP POLICY IF EXISTS "Users can update anime they uploaded or admins" ON public.anime;
CREATE POLICY "Users can update anime they uploaded or admins"
ON public.anime
FOR UPDATE
USING ((uploader_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- 4. Restrict token_usage SELECT: remove uploader access to IP/user agent data
DROP POLICY IF EXISTS "Admins and uploaders can view token usage" ON public.token_usage;
CREATE POLICY "Admins can view all token usage"
ON public.token_usage
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
