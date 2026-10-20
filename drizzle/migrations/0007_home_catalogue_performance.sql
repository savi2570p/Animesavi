CREATE INDEX IF NOT EXISTS idx_episodes_created_at_id_desc ON public.episodes (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_anime_view_count_desc ON public.anime (view_count DESC, id);
CREATE OR REPLACE FUNCTION public.home_latest_catalogue()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
WITH recent AS MATERIALIZED (
 SELECT e.id, e.season_id, e.title, e.episode_number, e.thumbnail, e.created_at, e.duration
 FROM public.episodes e ORDER BY e.created_at DESC, e.id DESC LIMIT 600
), joined AS MATERIALIZED (
 SELECT r.*, s.anime_id, s.season_number FROM recent r JOIN public.seasons s ON s.id = r.season_id
), latest AS (
 SELECT j.anime_id, max(j.created_at) AS latest_episode_date FROM joined j GROUP BY j.anime_id
), picked AS MATERIALIZED (
 SELECT a.id, a.title, a.cover_image, a.created_at, a.updated_at, a.status, a.is_eng_dub, a.is_sub_only, a.genres, l.latest_episode_date
 FROM latest l JOIN public.anime a ON a.id = l.anime_id WHERE a.type = 'series'
 ORDER BY l.latest_episode_date DESC, a.id LIMIT 12
), series AS (
 SELECT p.*, (SELECT count(*) FROM public.seasons s JOIN public.episodes e ON e.season_id = s.id WHERE s.anime_id = p.id) AS episode_count FROM picked p
), episode_rows AS (
 SELECT j.id, j.title, j.episode_number, j.thumbnail, j.created_at, j.duration,
 jsonb_build_object('season_number', j.season_number, 'anime', jsonb_build_object('id', a.id, 'title', a.title, 'cover_image', a.cover_image, 'type', a.type, 'status', a.status, 'is_eng_dub', a.is_eng_dub, 'is_sub_only', a.is_sub_only, 'genres', a.genres)) AS season
 FROM joined j JOIN public.anime a ON a.id = j.anime_id WHERE a.type IS DISTINCT FROM 'movie'
 ORDER BY j.created_at DESC, j.id DESC LIMIT 200
)
SELECT jsonb_build_object('series', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.latest_episode_date DESC, s.id) FROM series s), '[]'::jsonb), 'episodes', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC, e.id DESC) FROM episode_rows e), '[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.home_latest_catalogue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.home_latest_catalogue() TO anon, authenticated, service_role;