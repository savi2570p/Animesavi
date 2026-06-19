-- 1. AI recap storage on episodes
ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS ai_recap text,
  ADD COLUMN IF NOT EXISTS ai_recap_generated_at timestamptz;

-- 2. Recap analytics table
CREATE TABLE IF NOT EXISTS public.recap_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  watch_party_id uuid REFERENCES public.watch_parties(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  completed boolean NOT NULL DEFAULT false,
  duration_seconds integer NOT NULL DEFAULT 0,
  context text NOT NULL DEFAULT 'episode',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.recap_analytics TO authenticated;
GRANT ALL ON public.recap_analytics TO service_role;

ALTER TABLE public.recap_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own recap events"
  ON public.recap_analytics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users update their own recap events"
  ON public.recap_analytics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all recap analytics"
  ON public.recap_analytics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read their own recap events"
  ON public.recap_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_recap_analytics_episode ON public.recap_analytics(episode_id);
CREATE INDEX IF NOT EXISTS idx_recap_analytics_opened_at ON public.recap_analytics(opened_at DESC);

-- 3. Recap auto-sync state on watch parties
ALTER TABLE public.watch_parties
  ADD COLUMN IF NOT EXISTS recap_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS recap_position_seconds numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recap_is_playing boolean DEFAULT false;