
-- 1) Harden notify_new_episode: send a shared webhook secret header so
--    the public edge function can verify the call really came from the DB.
CREATE OR REPLACE FUNCTION public.notify_new_episode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fn_url text := 'https://yqeurpyiejesyikcpmdy.supabase.co/functions/v1/send-episode-push';
  shared_secret text := 'whk_8f3c1a92b04e47d6a5e1c7b0d2f8a39c4';
BEGIN
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-webhook-secret', shared_secret
    ),
    body := jsonb_build_object('episode_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

-- 2) Revoke EXECUTE from anon on SECURITY DEFINER helpers that aren't
--    meant to be called by unauthenticated clients via PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.notify_new_episode() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_token_duration(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_token_system_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_unlock_token(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.end_watch_party(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_video_conversion_record() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_reply_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_genre_preferences() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_username() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_watch_party_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;

-- 3) Tighten user_bans broad SELECT — only the affected user (or admins) should see their ban row.
DROP POLICY IF EXISTS "Anyone can view their own bans" ON public.user_bans;
CREATE POLICY "Users view own bans"
  ON public.user_bans
  FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
