-- Shadow Flix Continue Watching table
CREATE TABLE IF NOT EXISTS public.shadow_flix_continue_watching (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  series_title TEXT NOT NULL,
  episode_id UUID NOT NULL,
  position NUMERIC NOT NULL DEFAULT 0,
  duration NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, series_title)
);

ALTER TABLE public.shadow_flix_continue_watching ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own SF continue watching"
ON public.shadow_flix_continue_watching FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own SF continue watching"
ON public.shadow_flix_continue_watching FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own SF continue watching"
ON public.shadow_flix_continue_watching FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SF continue watching"
ON public.shadow_flix_continue_watching FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_sf_cw_updated_at
BEFORE UPDATE ON public.shadow_flix_continue_watching
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add is_upcoming to seasons
ALTER TABLE public.seasons
ADD COLUMN IF NOT EXISTS is_upcoming BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_seasons_is_upcoming ON public.seasons(is_upcoming) WHERE is_upcoming = true;