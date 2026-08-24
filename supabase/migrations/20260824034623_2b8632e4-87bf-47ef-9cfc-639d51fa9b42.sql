CREATE OR REPLACE FUNCTION public.get_token_metadata()
RETURNS TABLE (
  issuer_email TEXT,
  token_created_at TIMESTAMPTZ,
  token_used_at TIMESTAMPTZ,
  token_expires_at BIGINT,
  duration_hours INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    au.email::TEXT AS issuer_email,
    ut.created_at AS token_created_at,
    tu.used_at AS token_used_at,
    tu.expires_at AS token_expires_at,
    ut.duration_hours AS duration_hours
  FROM public.token_usage tu
  JOIN public.unlock_tokens ut ON ut.id = tu.token_id
  LEFT JOIN auth.users au ON au.id = ut.created_by
  WHERE tu.user_id = auth.uid()
  ORDER BY tu.used_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_token_metadata() TO authenticated;