-- Re-grant EXECUTE on functions that the client/RLS policies depend on
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_token_system_status() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.verify_unlock_token(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_token_duration(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.end_watch_party(uuid) TO authenticated;