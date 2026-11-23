ALTER TABLE public.anime ALTER COLUMN content_revision SET DEFAULT 0;
ALTER TABLE public.seasons ALTER COLUMN content_revision SET DEFAULT 0;
ALTER TABLE public.episodes ALTER COLUMN content_revision SET DEFAULT 0;
COMMENT ON COLUMN public.anime.content_revision IS 'API Hub revision; always assigned by trigger hub_anime_revision (default is a placeholder).';
COMMENT ON COLUMN public.seasons.content_revision IS 'API Hub revision; always assigned by trigger hub_season_revision (default is a placeholder).';
COMMENT ON COLUMN public.episodes.content_revision IS 'API Hub revision; always assigned by trigger hub_episode_revision (default is a placeholder).';