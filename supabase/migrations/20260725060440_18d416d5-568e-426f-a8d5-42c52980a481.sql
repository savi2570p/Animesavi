
-- 1) Rotate shared webhook secret used by notify_new_episode trigger → send-episode-push edge function
CREATE OR REPLACE FUNCTION public.notify_new_episode()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fn_url text := 'https://yqeurpyiejesyikcpmdy.supabase.co/functions/v1/send-episode-push';
  shared_secret text := '8559739b32d4bdb5b761c84853a9f06d676097286b48c50e';
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

-- 2) token_usage: prevent direct INSERT bypass. Only the SECURITY DEFINER RPC
-- redeem_unlock_token should write rows. Enforce user_id = auth.uid() as well.
DROP POLICY IF EXISTS "Anyone can insert valid token usage" ON public.token_usage;
CREATE POLICY "Users can only insert own token usage via valid token"
ON public.token_usage
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.unlock_tokens t
    WHERE t.id = token_usage.token_id
      AND t.is_active = true
      AND t.token <> '__system_toggle__'
  )
);

-- 3) comment_notifications: prevent spoofing — replier_id must equal auth.uid()
-- and the referenced parent comment must exist.
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.comment_notifications;
CREATE POLICY "Repliers can insert notifications for their own replies"
ON public.comment_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  replier_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.comments c
    WHERE c.id = comment_notifications.reply_id
      AND c.user_id = auth.uid()
  )
);

-- 4) Storage: anime-media bucket — require owner match on UPDATE/DELETE
-- (mirror the anime-thumbnails / anime-videos pattern). Admins can still manage all.
DROP POLICY IF EXISTS "Uploaders can update their media" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can delete their media" ON storage.objects;

CREATE POLICY "Uploaders can update their own media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'anime-media'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Uploaders can delete their own media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'anime-media'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);
