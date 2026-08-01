ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS short_id text
  GENERATED ALWAYS AS (left(replace(id::text, '-', ''), 6)) STORED;

CREATE INDEX IF NOT EXISTS episodes_short_id_idx ON public.episodes (short_id);