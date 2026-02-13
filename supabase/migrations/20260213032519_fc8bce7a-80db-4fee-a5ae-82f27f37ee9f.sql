
-- Shorts likes table
CREATE TABLE public.shorts_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  short_id UUID NOT NULL REFERENCES public.shorts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(short_id, user_id)
);

ALTER TABLE public.shorts_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view short likes" ON public.shorts_likes FOR SELECT USING (true);
CREATE POLICY "Users can add likes" ON public.shorts_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove likes" ON public.shorts_likes FOR DELETE USING (auth.uid() = user_id);

-- Shorts comments table
CREATE TABLE public.shorts_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  short_id UUID NOT NULL REFERENCES public.shorts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shorts_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view short comments" ON public.shorts_comments FOR SELECT USING (true);
CREATE POLICY "Users can add comments" ON public.shorts_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.shorts_comments FOR DELETE USING (auth.uid() = user_id);
