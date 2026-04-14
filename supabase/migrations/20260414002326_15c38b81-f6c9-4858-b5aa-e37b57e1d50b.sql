ALTER TABLE public.shadow_flix_content
  ADD COLUMN season_number integer DEFAULT 1,
  ADD COLUMN episode_number integer DEFAULT null,
  ADD COLUMN genre text DEFAULT null;