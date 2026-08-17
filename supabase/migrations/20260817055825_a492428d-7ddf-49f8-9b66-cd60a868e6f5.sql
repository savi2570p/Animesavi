-- ============================================================
-- BACKEND STABILITY OVERHAUL — phase 1 (non-destructive)
-- Adds missing FK/hot-path indexes, an atomic idempotent
-- watch-progress RPC, and stuck-job recovery for conversions.
-- No table is dropped, no data is deleted.
-- ============================================================

-- 1. MISSING FOREIGN-KEY / HOT-PATH INDEXES ------------------
CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON public.episodes (season_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season_epnum ON public.episodes (season_id, episode_number);
CREATE INDEX IF NOT EXISTS idx_seasons_anime_id ON public.seasons (anime_id);
CREATE INDEX IF NOT EXISTS idx_seasons_anime_number ON public.seasons (anime_id, season_number);
CREATE INDEX IF NOT EXISTS idx_comments_episode_id ON public.comments (episode_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments (user_id);
CREATE INDEX IF NOT EXISTS idx_comment_notifications_comment_id ON public.comment_notifications (comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_notifications_reply_id ON public.comment_notifications (reply_id);
CREATE INDEX IF NOT EXISTS idx_comment_notifications_episode_id ON public.comment_notifications (episode_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_anime_id ON public.watch_history (anime_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_episode_id ON public.watch_history (episode_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_user_watched_at ON public.watch_history (user_id, watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_later_episode_id ON public.watch_later (episode_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_anime_id ON public.user_favorites (anime_id);
CREATE INDEX IF NOT EXISTS idx_anime_uploader_id ON public.anime (uploader_id);
CREATE INDEX IF NOT EXISTS idx_anime_created_at ON public.anime (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shorts_episode_id ON public.shorts (episode_id);
CREATE INDEX IF NOT EXISTS idx_shorts_comments_short_id ON public.shorts_comments (short_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_token_id ON public.token_usage (token_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_expires ON public.token_usage (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_unlock_tokens_created_by ON public.unlock_tokens (created_by);
CREATE INDEX IF NOT EXISTS idx_upload_codes_used_by ON public.upload_codes (used_by);
CREATE INDEX IF NOT EXISTS idx_uploader_applications_user_id ON public.uploader_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_recap_analytics_user_id ON public.recap_analytics (user_id);
CREATE INDEX IF NOT EXISTS idx_recap_analytics_watch_party_id ON public.recap_analytics (watch_party_id);
CREATE INDEX IF NOT EXISTS idx_watch_parties_anime_id ON public.watch_parties (anime_id);
CREATE INDEX IF NOT EXISTS idx_watch_parties_episode_id ON public.watch_parties (episode_id);
CREATE INDEX IF NOT EXISTS idx_watch_party_messages_party_created ON public.watch_party_messages (party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_created ON public.notification_queue (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_conversions_status ON public.video_conversions (status);
CREATE INDEX IF NOT EXISTS idx_video_conversions_status_updated ON public.video_conversions (status, updated_at);

-- 2. REDUNDANT DUPLICATE UNIQUE CONSTRAINT -------------------
-- watch_history has TWO identical UNIQUE(user_id, episode_id) constraints.
-- Keep watch_history_user_id_episode_id_key (used by ON CONFLICT), drop the copy.
ALTER TABLE public.watch_history DROP CONSTRAINT IF EXISTS watch_history_user_episode_unique;

-- 3. ATOMIC, IDEMPOTENT, MONOTONIC WATCH PROGRESS ------------
-- Replaces the client-side read-then-write pattern that loses updates when
-- multiple tabs / rapid seeks / retries race each other.
CREATE OR REPLACE FUNCTION public.upsert_watch_progress(
  _anime_id uuid,
  _episode_id uuid,
  _progress integer,
  _completed boolean DEFAULT false,
  _last_position integer DEFAULT 0,
  _duration integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _id uuid;
  _p integer := GREATEST(0, LEAST(100, COALESCE(_progress, 0)));
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  INSERT INTO public.watch_history AS wh (
    user_id, anime_id, episode_id, progress, completed, watched_at,
    completed_at, last_position, duration
  ) VALUES (
    _user_id, _anime_id, _episode_id, _p, COALESCE(_completed, false), now(),
    CASE WHEN _completed THEN now() ELSE NULL END,
    GREATEST(0, COALESCE(_last_position, 0)),
    GREATEST(0, COALESCE(_duration, 0))
  )
  ON CONFLICT (user_id, episode_id) DO UPDATE SET
    anime_id = EXCLUDED.anime_id,
    watched_at = now(),
    -- monotonic: never let a stale/late update rewind progress, unless this
    -- is a genuine rewatch (user is early in the episode again, >60s in).
    progress = CASE
      WHEN EXCLUDED.completed THEN 100
      WHEN EXCLUDED.last_position > 60 AND EXCLUDED.progress < 85 THEN EXCLUDED.progress
      ELSE GREATEST(COALESCE(wh.progress, 0), EXCLUDED.progress)
    END,
    completed = CASE
      WHEN EXCLUDED.completed THEN true
      WHEN EXCLUDED.last_position > 60 AND EXCLUDED.progress < 85 THEN false
      ELSE wh.completed
    END,
    completed_at = CASE
      WHEN EXCLUDED.completed THEN COALESCE(wh.completed_at, now())
      WHEN EXCLUDED.last_position > 60 AND EXCLUDED.progress < 85 THEN NULL
      ELSE wh.completed_at
    END,
    last_position = CASE
      WHEN EXCLUDED.completed THEN GREATEST(EXCLUDED.last_position, COALESCE(wh.last_position, 0))
      WHEN EXCLUDED.last_position > 60 AND EXCLUDED.progress < 85 THEN EXCLUDED.last_position
      ELSE GREATEST(COALESCE(wh.last_position, 0), EXCLUDED.last_position)
    END,
    duration = GREATEST(COALESCE(wh.duration, 0), EXCLUDED.duration)
  RETURNING wh.id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_watch_progress(uuid, uuid, integer, boolean, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_watch_progress(uuid, uuid, integer, boolean, integer, integer) TO authenticated;

-- 4. STUCK VIDEO-CONVERSION JOB RECOVERY ---------------------
-- A worker that dies mid-job leaves rows pinned in 'processing' forever.
-- Lease model: a job whose row has not been touched for 30 minutes is
-- considered abandoned and becomes retryable (bounded by max_retries).
CREATE OR REPLACE FUNCTION public.recover_stuck_conversions(_stale_minutes integer DEFAULT 30)
RETURNS TABLE(requeued integer, failed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _requeued integer := 0;
  _failed integer := 0;
  _cutoff timestamptz := now() - make_interval(mins => GREATEST(5, _stale_minutes));
BEGIN
  WITH stale AS (
    SELECT id, COALESCE(retry_count, 0) AS rc, COALESCE(max_retries, 3) AS mr
    FROM public.video_conversions
    WHERE status = 'processing' AND updated_at < _cutoff
    FOR UPDATE SKIP LOCKED
  ), requeue AS (
    UPDATE public.video_conversions v
       SET status = 'pending',
           retry_count = COALESCE(v.retry_count, 0) + 1,
           worker_id = NULL,
           conversion_stage = 'retry_pending',
           error_message = 'Worker lease expired — job requeued automatically',
           updated_at = now()
      FROM stale s
     WHERE v.id = s.id AND s.rc < s.mr
     RETURNING v.id
  ), fail AS (
    UPDATE public.video_conversions v
       SET status = 'failed',
           worker_id = NULL,
           conversion_stage = 'failed',
           error_message = 'Worker lease expired and max retries exceeded',
           updated_at = now()
      FROM stale s
     WHERE v.id = s.id AND s.rc >= s.mr
     RETURNING v.id
  )
  SELECT (SELECT count(*) FROM requeue), (SELECT count(*) FROM fail)
    INTO _requeued, _failed;

  RETURN QUERY SELECT _requeued, _failed;
END;
$$;

REVOKE ALL ON FUNCTION public.recover_stuck_conversions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stuck_conversions(integer) TO service_role;

-- 5. ATOMIC JOB CLAIMING (prevents two workers on the same video)
CREATE OR REPLACE FUNCTION public.claim_conversion_jobs(_worker_id text, _limit integer DEFAULT 1)
RETURNS SETOF public.video_conversions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.video_conversions v
     SET status = 'processing',
         worker_id = _worker_id,
         conversion_started_at = now(),
         conversion_stage = 'claimed',
         updated_at = now()
   WHERE v.id IN (
     SELECT c.id FROM public.video_conversions c
      WHERE c.status = 'pending' AND COALESCE(c.needs_conversion, true) = true
      ORDER BY c.created_at
      LIMIT GREATEST(1, LEAST(10, _limit))
      FOR UPDATE SKIP LOCKED
   )
  RETURNING v.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_conversion_jobs(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_conversion_jobs(text, integer) TO service_role;

-- 6. LOCK DOWN OVER-EXPOSED SECURITY DEFINER HELPERS ---------
-- These are internal helpers, not public API surface.
REVOKE ALL ON FUNCTION public.get_token_duration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_token_duration(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_flox_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_flox_admin(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_allowed_short_uploader(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_allowed_short_uploader(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.end_watch_party(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_watch_party(uuid) TO authenticated, service_role;