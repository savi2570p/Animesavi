CREATE TABLE public.shadow_flix_player_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme_key TEXT NOT NULL DEFAULT 'Netflix Red',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.shadow_flix_player_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Shadow Flix player preference"
ON public.shadow_flix_player_preferences
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Shadow Flix player preference"
ON public.shadow_flix_player_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Shadow Flix player preference"
ON public.shadow_flix_player_preferences
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Shadow Flix player preference"
ON public.shadow_flix_player_preferences
FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_shadow_flix_player_preferences_user_id
ON public.shadow_flix_player_preferences (user_id);

CREATE TRIGGER update_shadow_flix_player_preferences_updated_at
BEFORE UPDATE ON public.shadow_flix_player_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();