ALTER TABLE public.flox_content
  ADD COLUMN IF NOT EXISTS flox_source_url text,
  ADD COLUMN IF NOT EXISTS anime_plus_source_url text,
  ADD COLUMN IF NOT EXISTS anime_plus_source_type text;