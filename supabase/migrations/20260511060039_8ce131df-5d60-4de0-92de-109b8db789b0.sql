
-- Push subscriptions per device
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push subscriptions"
ON public.push_subscriptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all push subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notification fallback queue (in-app inbox)
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  anime_id uuid,
  episode_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  delivered_via text NOT NULL DEFAULT 'fallback',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_user_unread
  ON public.notification_queue(user_id, is_read, created_at DESC);

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own notifications"
ON public.notification_queue
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users update their own notifications"
ON public.notification_queue
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own notifications"
ON public.notification_queue
FOR DELETE
USING (auth.uid() = user_id);

-- Dedupe log
CREATE TABLE IF NOT EXISTS public.sent_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  episode_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, episode_id)
);

ALTER TABLE public.sent_push_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view push log"
ON public.sent_push_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable pg_net so trigger can call edge function
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger: fire push on new episode
CREATE OR REPLACE FUNCTION public.notify_new_episode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn_url text := 'https://yqeurpyiejesyikcpmdy.supabase.co/functions/v1/send-episode-push';
BEGIN
  PERFORM extensions.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('episode_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- never block episode insert if push fails
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_episode ON public.episodes;
CREATE TRIGGER trg_notify_new_episode
AFTER INSERT ON public.episodes
FOR EACH ROW EXECUTE FUNCTION public.notify_new_episode();
