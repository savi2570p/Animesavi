-- Fix the overly permissive INSERT policy for comment_notifications
-- The trigger runs as SECURITY DEFINER, so we can restrict the policy to only authenticated users
DROP POLICY IF EXISTS "System can insert notifications" ON public.comment_notifications;

CREATE POLICY "Authenticated users can insert notifications"
ON public.comment_notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);