-- ============================================================
-- 1. STORAGE: drop broad SELECT (listing) policies on public buckets
--    Public file URLs still work (public bucket flag bypasses RLS for downloads).
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view anime media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view anime subtitles" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view anime thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view anime videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view movies" ON storage.objects;

-- ============================================================
-- 2. SECURITY DEFINER functions: lock down EXECUTE
-- ============================================================
-- Strip default PUBLIC execute everywhere
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_token_duration(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.end_watch_party(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_unlock_token(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_token_system_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_episode() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_reply_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_video_conversion_record() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_genre_preferences() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_watch_party_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_username() FROM PUBLIC, anon, authenticated;

-- Re-grant only what the client actually needs
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_token_duration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_watch_party(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_unlock_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_token_system_status() TO anon, authenticated;

-- ============================================================
-- 3. RLS "Always True" — tighten user_bans insert
-- ============================================================
DROP POLICY IF EXISTS "System can insert bans" ON public.user_bans;
CREATE POLICY "Users can insert their own ban or admins can ban anyone"
ON public.user_bans
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
