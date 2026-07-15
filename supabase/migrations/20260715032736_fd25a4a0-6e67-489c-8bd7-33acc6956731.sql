
CREATE TABLE public.shared_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(9), 'base64'),
  title TEXT NOT NULL,
  description TEXT,
  anime_ids UUID[] NOT NULL DEFAULT '{}',
  likes INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shared_collections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_collections TO authenticated;
GRANT ALL ON public.shared_collections TO service_role;

ALTER TABLE public.shared_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shared collections" ON public.shared_collections FOR SELECT USING (true);
CREATE POLICY "Users can create own collections" ON public.shared_collections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own collections" ON public.shared_collections FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own collections" ON public.shared_collections FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_shared_collections_updated_at BEFORE UPDATE ON public.shared_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.shared_collection_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.shared_collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_id, user_id)
);

GRANT SELECT ON public.shared_collection_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.shared_collection_likes TO authenticated;
GRANT ALL ON public.shared_collection_likes TO service_role;

ALTER TABLE public.shared_collection_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes" ON public.shared_collection_likes FOR SELECT USING (true);
CREATE POLICY "Users can like" ON public.shared_collection_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike own" ON public.shared_collection_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_collection_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.shared_collections SET likes = likes + 1 WHERE id = NEW.collection_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.shared_collections SET likes = GREATEST(likes - 1, 0) WHERE id = OLD.collection_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER shared_collection_likes_count
  AFTER INSERT OR DELETE ON public.shared_collection_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_collection_likes_count();
