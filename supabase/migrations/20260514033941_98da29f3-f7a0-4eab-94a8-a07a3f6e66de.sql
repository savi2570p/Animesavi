-- Revoke EXECUTE from all SECURITY DEFINER functions, then re-grant only what the client truly uses.

-- Trigger-only functions (called by Postgres triggers, not client/RPC) — fully revoke
REVOKE EXECUTE ON FUNCTION public.notify_new_episode() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_reply_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_video_conversion_record() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_genre_preferences() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_watch_party_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_username() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS (auth.uid() context), not directly by clients — revoke all
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- Client RPCs — restrict to minimum required role
REVOKE EXECUTE ON FUNCTION public.verify_unlock_token(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.verify_unlock_token(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_token_system_status() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_token_system_status() TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_token_duration(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_token_duration(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.end_watch_party(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.end_watch_party(uuid) TO authenticated;