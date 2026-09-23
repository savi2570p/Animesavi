ALTER TABLE public.anime ADD COLUMN IF NOT EXISTS is_sub_only boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS anime_is_sub_only_idx ON public.anime (is_sub_only) WHERE is_sub_only;