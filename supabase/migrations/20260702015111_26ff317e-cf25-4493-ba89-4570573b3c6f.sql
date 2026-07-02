ALTER TABLE public.anime ADD COLUMN IF NOT EXISTS is_eng_dub boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_anime_is_eng_dub ON public.anime (is_eng_dub) WHERE is_eng_dub = true;