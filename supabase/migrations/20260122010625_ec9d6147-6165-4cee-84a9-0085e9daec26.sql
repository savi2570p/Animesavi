-- Create watch_later table for Watch Later playlist feature
CREATE TABLE public.watch_later (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, episode_id)
);

-- Enable RLS
ALTER TABLE public.watch_later ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own watch later items"
ON public.watch_later
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their watch later list"
ON public.watch_later
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their watch later list"
ON public.watch_later
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_watch_later_user_id ON public.watch_later(user_id);
CREATE INDEX idx_watch_later_created_at ON public.watch_later(created_at DESC);