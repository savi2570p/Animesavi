ALTER TABLE public.watch_history
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_position integer,
  ADD COLUMN IF NOT EXISTS duration integer;

ALTER TABLE public.watch_history
  DROP CONSTRAINT IF EXISTS watch_history_user_anime_unique;

CREATE OR REPLACE FUNCTION public.mark_continue_watching_done(
  _anime_id uuid,
  _episode_id uuid,
  _duration integer DEFAULT NULL,
  _last_position integer DEFAULT NULL
)
RETURNS TABLE(
  completed_history_id uuid,
  next_history_id uuid,
  next_episode_id uuid,
  next_season_id uuid,
  next_episode_number integer,
  next_season_number integer,
  action text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _now timestamp with time zone := now();
  _current_episode record;
  _next_episode record;
  _next_season record;
  _completed_id uuid;
  _next_history uuid;
  _duration_value integer := COALESCE(_duration, 0);
  _last_position_value integer := COALESCE(_last_position, _duration, 0);
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT e.id, e.episode_number, e.season_id, e.duration, s.season_number, s.anime_id
    INTO _current_episode
    FROM public.episodes e
    JOIN public.seasons s ON s.id = e.season_id
   WHERE e.id = _episode_id
     AND s.anime_id = _anime_id
   LIMIT 1;

  IF _current_episode.id IS NULL THEN
    RAISE EXCEPTION 'Episode not found for anime';
  END IF;

  _duration_value := COALESCE(NULLIF(_duration_value, 0), _current_episode.duration, 0);
  _last_position_value := COALESCE(NULLIF(_last_position_value, 0), _duration_value, 0);

  INSERT INTO public.watch_history (
    user_id,
    anime_id,
    episode_id,
    progress,
    completed,
    watched_at,
    completed_at,
    last_position,
    duration
  ) VALUES (
    _user_id,
    _anime_id,
    _episode_id,
    100,
    true,
    _now,
    _now,
    _last_position_value,
    _duration_value
  )
  ON CONFLICT (user_id, episode_id) DO UPDATE SET
    anime_id = EXCLUDED.anime_id,
    progress = 100,
    completed = true,
    watched_at = EXCLUDED.watched_at,
    completed_at = EXCLUDED.completed_at,
    last_position = EXCLUDED.last_position,
    duration = EXCLUDED.duration
  RETURNING id INTO _completed_id;

  SELECT e.id, e.episode_number, e.season_id, s.season_number
    INTO _next_episode
    FROM public.episodes e
    JOIN public.seasons s ON s.id = e.season_id
   WHERE e.season_id = _current_episode.season_id
     AND e.episode_number > _current_episode.episode_number
   ORDER BY e.episode_number ASC
   LIMIT 1;

  IF _next_episode.id IS NULL THEN
    SELECT s.id, s.season_number
      INTO _next_season
      FROM public.seasons s
     WHERE s.anime_id = _anime_id
       AND s.season_number > _current_episode.season_number
     ORDER BY s.season_number ASC
     LIMIT 1;

    IF _next_season.id IS NOT NULL THEN
      SELECT e.id, e.episode_number, e.season_id, _next_season.season_number AS season_number
        INTO _next_episode
        FROM public.episodes e
       WHERE e.season_id = _next_season.id
       ORDER BY e.episode_number ASC
       LIMIT 1;
    END IF;
  END IF;

  IF _next_episode.id IS NOT NULL THEN
    INSERT INTO public.watch_history (
      user_id,
      anime_id,
      episode_id,
      progress,
      completed,
      watched_at,
      completed_at,
      last_position,
      duration
    ) VALUES (
      _user_id,
      _anime_id,
      _next_episode.id,
      0,
      false,
      _now,
      NULL,
      0,
      0
    )
    ON CONFLICT (user_id, episode_id) DO UPDATE SET
      anime_id = EXCLUDED.anime_id,
      completed = false,
      progress = CASE WHEN public.watch_history.completed = true THEN 0 ELSE public.watch_history.progress END,
      watched_at = EXCLUDED.watched_at,
      completed_at = NULL,
      last_position = COALESCE(public.watch_history.last_position, 0),
      duration = COALESCE(public.watch_history.duration, 0)
    RETURNING id INTO _next_history;

    RETURN QUERY SELECT
      _completed_id,
      _next_history,
      _next_episode.id,
      _next_episode.season_id,
      _next_episode.episode_number,
      _next_episode.season_number,
      'next_episode'::text;
  ELSE
    RETURN QUERY SELECT
      _completed_id,
      NULL::uuid,
      NULL::uuid,
      NULL::uuid,
      NULL::integer,
      NULL::integer,
      'completed_series'::text;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_continue_watching_done(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_continue_watching_done(uuid, uuid, integer, integer) TO service_role;