REVOKE EXECUTE ON FUNCTION public.redeem_unlock_token(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_unlock_token(text, uuid, text) TO service_role;