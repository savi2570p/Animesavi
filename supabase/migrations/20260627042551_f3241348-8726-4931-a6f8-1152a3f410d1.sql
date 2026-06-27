REVOKE EXECUTE ON FUNCTION public.mark_continue_watching_done(uuid, uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_continue_watching_done(uuid, uuid, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_continue_watching_done(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_continue_watching_done(uuid, uuid, integer, integer) TO service_role;