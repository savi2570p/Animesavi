-- ===== Revisions on source content =====
CREATE SEQUENCE IF NOT EXISTS public.hub_content_revision_seq;

ALTER TABLE public.anime ADD COLUMN IF NOT EXISTS content_revision bigint NOT NULL DEFAULT nextval('public.hub_content_revision_seq');
ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS content_revision bigint NOT NULL DEFAULT nextval('public.hub_content_revision_seq');
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS content_revision bigint NOT NULL DEFAULT nextval('public.hub_content_revision_seq');
-- Triggers own the value from now on (no client needs sequence privileges).
ALTER TABLE public.anime ALTER COLUMN content_revision DROP DEFAULT;
ALTER TABLE public.seasons ALTER COLUMN content_revision DROP DEFAULT;
ALTER TABLE public.episodes ALTER COLUMN content_revision DROP DEFAULT;

-- ===== Durable change outbox =====
CREATE TABLE public.hub_content_events (
  seq bigserial PRIMARY KEY,
  event_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  entity_type text NOT NULL CHECK (entity_type IN ('anime','season','episode')),
  entity_id uuid NOT NULL,
  anime_id uuid,
  season_id uuid,
  action text NOT NULL CHECK (action IN ('change','delete')),
  revision bigint NOT NULL,
  tx_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.hub_content_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.hub_content_events_seq_seq TO service_role;
REVOKE ALL ON public.hub_content_events FROM anon, authenticated;
ALTER TABLE public.hub_content_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX hub_content_events_cursor_idx ON public.hub_content_events (tx_id, seq);
CREATE INDEX hub_content_events_created_idx ON public.hub_content_events (created_at);

-- ===== Receiving websites =====
CREATE TABLE public.hub_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL,
  site_origin text NOT NULL,
  webhook_url text NOT NULL,
  secret_ciphertext text,
  previous_secret_ciphertext text,
  previous_secret_expires_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disconnected')),
  delivery_state text NOT NULL DEFAULT 'idle' CHECK (delivery_state IN ('idle','retrying','dead')),
  delivered_tx xid8 NOT NULL,
  delivered_seq bigint NOT NULL DEFAULT 0,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  events_delivered bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz
);
GRANT ALL ON public.hub_connections TO service_role;
REVOKE ALL ON public.hub_connections FROM anon, authenticated;
ALTER TABLE public.hub_connections ENABLE ROW LEVEL SECURITY;
CREATE INDEX hub_connections_due_idx ON public.hub_connections (next_attempt_at) WHERE status = 'active';
CREATE UNIQUE INDEX hub_connections_active_webhook_idx ON public.hub_connections (webhook_url) WHERE status = 'active';
CREATE TRIGGER update_hub_connections_updated_at BEFORE UPDATE ON public.hub_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.hub_used_nonces (
  connection_id uuid NOT NULL,
  nonce text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, nonce)
);
GRANT ALL ON public.hub_used_nonces TO service_role;
REVOKE ALL ON public.hub_used_nonces FROM anon, authenticated;
ALTER TABLE public.hub_used_nonces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.hub_rate_events (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.hub_rate_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.hub_rate_events_id_seq TO service_role;
REVOKE ALL ON public.hub_rate_events FROM anon, authenticated;
ALTER TABLE public.hub_rate_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX hub_rate_events_bucket_idx ON public.hub_rate_events (bucket, created_at);

CREATE TABLE public.hub_runtime (
  id integer PRIMARY KEY CHECK (id = 1),
  kick_secret text NOT NULL,
  dispatch_url text NOT NULL,
  last_kick_at timestamptz,
  pruned_tx xid8,
  pruned_seq bigint,
  last_pruned_at timestamptz
);
GRANT ALL ON public.hub_runtime TO service_role;
REVOKE ALL ON public.hub_runtime FROM anon, authenticated;
ALTER TABLE public.hub_runtime ENABLE ROW LEVEL SECURITY;
INSERT INTO public.hub_runtime (id, kick_secret, dispatch_url)
VALUES (1, encode(extensions.gen_random_bytes(32), 'hex'),
        'https://yqeurpyiejesyikcpmdy.supabase.co/functions/v1/api-hub/v1/internal/dispatch');

-- ===== Public catalogue boundary (single place that defines "published") =====
CREATE VIEW public.hub_public_anime WITH (security_invoker = on) AS
  SELECT a.* FROM public.anime a
  WHERE COALESCE(a.is_muse, false) = false;

CREATE VIEW public.hub_public_seasons WITH (security_invoker = on) AS
  SELECT s.* FROM public.seasons s
  JOIN public.hub_public_anime a ON a.id = s.anime_id
  WHERE COALESCE(s.is_upcoming, false) = false;

CREATE VIEW public.hub_public_episodes WITH (security_invoker = on) AS
  SELECT e.*, s.anime_id FROM public.episodes e
  JOIN public.hub_public_seasons s ON s.id = e.season_id
  WHERE COALESCE(e.video_url, '') <> '' OR COALESCE(e.external_url, '') <> '' OR COALESCE(e.sub_video_url, '') <> '';

REVOKE ALL ON public.hub_public_anime, public.hub_public_seasons, public.hub_public_episodes FROM anon, authenticated;
GRANT SELECT ON public.hub_public_anime, public.hub_public_seasons, public.hub_public_episodes TO service_role;

-- ===== Revision bump (BEFORE) =====
CREATE OR REPLACE FUNCTION public.hub_bump_anime_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.content_revision := nextval('public.hub_content_revision_seq');
  ELSIF ROW(NEW.title, NEW.description, NEW.cover_image, NEW.banner_image, NEW.genres, NEW.release_year,
            NEW.status, NEW.type, NEW.trailer_url, NEW.is_crunchyroll, NEW.schedule_day, NEW.is_muse,
            NEW.studio, NEW.total_episodes, NEW.source_material, NEW.content_rating, NEW.is_eng_dub, NEW.is_sub_only)
        IS DISTINCT FROM
        ROW(OLD.title, OLD.description, OLD.cover_image, OLD.banner_image, OLD.genres, OLD.release_year,
            OLD.status, OLD.type, OLD.trailer_url, OLD.is_crunchyroll, OLD.schedule_day, OLD.is_muse,
            OLD.studio, OLD.total_episodes, OLD.source_material, OLD.content_rating, OLD.is_eng_dub, OLD.is_sub_only) THEN
    NEW.content_revision := nextval('public.hub_content_revision_seq');
  ELSE
    NEW.content_revision := OLD.content_revision;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.hub_bump_season_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.content_revision := nextval('public.hub_content_revision_seq');
  ELSIF ROW(NEW.anime_id, NEW.season_number, NEW.title, NEW.release_date, NEW.is_upcoming)
        IS DISTINCT FROM ROW(OLD.anime_id, OLD.season_number, OLD.title, OLD.release_date, OLD.is_upcoming) THEN
    NEW.content_revision := nextval('public.hub_content_revision_seq');
  ELSE
    NEW.content_revision := OLD.content_revision;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.hub_bump_episode_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.content_revision := nextval('public.hub_content_revision_seq');
  ELSIF ROW(NEW.season_id, NEW.episode_number, NEW.title, NEW.description, NEW.thumbnail, NEW.video_url,
            NEW.sub_video_url, NEW.external_url, NEW.duration, NEW.audio_language, NEW.captions_url,
            NEW.intro_start_time, NEW.intro_end_time, NEW.outro_start_time, NEW.outro_end_time)
        IS DISTINCT FROM
        ROW(OLD.season_id, OLD.episode_number, OLD.title, OLD.description, OLD.thumbnail, OLD.video_url,
            OLD.sub_video_url, OLD.external_url, OLD.duration, OLD.audio_language, OLD.captions_url,
            OLD.intro_start_time, OLD.intro_end_time, OLD.outro_start_time, OLD.outro_end_time) THEN
    NEW.content_revision := nextval('public.hub_content_revision_seq');
  ELSE
    NEW.content_revision := OLD.content_revision;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER hub_anime_revision BEFORE INSERT OR UPDATE ON public.anime
  FOR EACH ROW EXECUTE FUNCTION public.hub_bump_anime_revision();
CREATE TRIGGER hub_season_revision BEFORE INSERT OR UPDATE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.hub_bump_season_revision();
CREATE TRIGGER hub_episode_revision BEFORE INSERT OR UPDATE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.hub_bump_episode_revision();

-- ===== Outbox writers (AFTER, same transaction as the content change) =====
CREATE OR REPLACE FUNCTION public.hub_record_content_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _anime uuid;
  _season uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'anime' THEN
      _anime := OLD.id;
    ELSIF TG_TABLE_NAME = 'seasons' THEN
      _anime := OLD.anime_id;
    ELSE
      _season := OLD.season_id;
      SELECT anime_id INTO _anime FROM public.seasons WHERE id = OLD.season_id;
    END IF;
    INSERT INTO public.hub_content_events (entity_type, entity_id, anime_id, season_id, action, revision)
    VALUES (CASE TG_TABLE_NAME WHEN 'anime' THEN 'anime' WHEN 'seasons' THEN 'season' ELSE 'episode' END,
            OLD.id, _anime, _season, 'delete', nextval('public.hub_content_revision_seq'));
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.content_revision = OLD.content_revision THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'anime' THEN
    _anime := NEW.id;
  ELSIF TG_TABLE_NAME = 'seasons' THEN
    _anime := NEW.anime_id;
  ELSE
    _season := NEW.season_id;
    SELECT anime_id INTO _anime FROM public.seasons WHERE id = NEW.season_id;
  END IF;

  INSERT INTO public.hub_content_events (entity_type, entity_id, anime_id, season_id, action, revision)
  VALUES (CASE TG_TABLE_NAME WHEN 'anime' THEN 'anime' WHEN 'seasons' THEN 'season' ELSE 'episode' END,
          NEW.id, _anime, _season, 'change', NEW.content_revision);

  -- Moving an episode/season to another parent: also tell receivers about the old parent tree.
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'seasons' AND NEW.anime_id IS DISTINCT FROM OLD.anime_id THEN
    INSERT INTO public.hub_content_events (entity_type, entity_id, anime_id, action, revision)
    VALUES ('anime', OLD.anime_id, OLD.anime_id, 'change', nextval('public.hub_content_revision_seq'));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER hub_anime_event AFTER INSERT OR UPDATE OR DELETE ON public.anime
  FOR EACH ROW EXECUTE FUNCTION public.hub_record_content_event();
CREATE TRIGGER hub_season_event AFTER INSERT OR UPDATE OR DELETE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.hub_record_content_event();
CREATE TRIGGER hub_episode_event AFTER INSERT OR UPDATE OR DELETE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.hub_record_content_event();

-- ===== Wake the dispatcher right after content commits (only when receivers exist) =====
CREATE OR REPLACE FUNCTION public.hub_kick_dispatch() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _secret text;
  _url text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.hub_connections WHERE status = 'active') THEN
    RETURN NULL;
  END IF;
  UPDATE public.hub_runtime r SET last_kick_at = now()
   WHERE r.id = (SELECT x.id FROM public.hub_runtime x
                  WHERE x.id = 1 AND (x.last_kick_at IS NULL OR x.last_kick_at < now() - interval '2 seconds')
                  FOR UPDATE SKIP LOCKED)
  RETURNING r.kick_secret, r.dispatch_url INTO _secret, _url;
  IF _url IS NULL THEN
    RETURN NULL;
  END IF;
  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hub-kick', _secret),
    body := '{"source":"content-change"}'::jsonb,
    timeout_milliseconds := 5000
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

CREATE TRIGGER hub_kick_after_event AFTER INSERT ON public.hub_content_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.hub_kick_dispatch();

-- ===== Change feed helpers (cursor = (tx_id, seq); only finished transactions are served) =====
CREATE OR REPLACE FUNCTION public.hub_head()
RETURNS TABLE (tx_id text, seq bigint, oldest_tx text, oldest_seq bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pg_snapshot_xmin(pg_current_snapshot())::text, 0::bigint,
         (SELECT pruned_tx::text FROM public.hub_runtime WHERE id = 1),
         (SELECT pruned_seq FROM public.hub_runtime WHERE id = 1);
$$;

CREATE OR REPLACE FUNCTION public.hub_events_after(_tx text, _seq bigint, _limit integer DEFAULT 100)
RETURNS TABLE (seq bigint, event_id uuid, entity_type text, entity_id uuid, anime_id uuid, season_id uuid,
               action text, revision bigint, tx_id text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.seq, e.event_id, e.entity_type, e.entity_id, e.anime_id, e.season_id, e.action, e.revision,
         e.tx_id::text, e.created_at
    FROM public.hub_content_events e
   WHERE (e.tx_id, e.seq) > (_tx::xid8, _seq)
     AND e.tx_id < pg_snapshot_xmin(pg_current_snapshot())
   ORDER BY e.tx_id, e.seq
   LIMIT LEAST(GREATEST(COALESCE(_limit, 100), 1), 500);
$$;

-- ===== Delivery queue helpers =====
CREATE OR REPLACE FUNCTION public.hub_claim_connections(_limit integer DEFAULT 20, _lease_seconds integer DEFAULT 60)
RETURNS SETOF public.hub_connections
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _xmin xid8 := pg_snapshot_xmin(pg_current_snapshot());
BEGIN
  RETURN QUERY
  UPDATE public.hub_connections c
     SET lease_until = now() + make_interval(secs => GREATEST(10, LEAST(300, _lease_seconds)))
   WHERE c.id IN (
     SELECT x.id FROM public.hub_connections x
      WHERE x.status = 'active'
        AND x.next_attempt_at <= now()
        AND (x.lease_until IS NULL OR x.lease_until < now())
        AND EXISTS (SELECT 1 FROM public.hub_content_events e
                     WHERE (e.tx_id, e.seq) > (x.delivered_tx, x.delivered_seq) AND e.tx_id < _xmin)
      ORDER BY x.next_attempt_at
      LIMIT LEAST(GREATEST(COALESCE(_limit, 20), 1), 100)
      FOR UPDATE SKIP LOCKED)
  RETURNING c.*;
END $$;

CREATE OR REPLACE FUNCTION public.hub_record_delivery_success(_id uuid, _tx text, _seq bigint, _count integer)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.hub_connections
     SET delivered_tx = GREATEST(delivered_tx, _tx::xid8),
         delivered_seq = CASE WHEN _tx::xid8 > delivered_tx OR (_tx::xid8 = delivered_tx AND _seq > delivered_seq) THEN _seq ELSE delivered_seq END,
         events_delivered = events_delivered + GREATEST(_count, 0),
         attempt_count = 0, delivery_state = 'idle', next_attempt_at = now(),
         last_attempt_at = now(), last_success_at = now(), last_error = NULL
   WHERE id = _id AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.hub_record_delivery_failure(_id uuid, _error text, _max_attempts integer DEFAULT 12)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _attempts integer;
  _delay double precision;
BEGIN
  SELECT attempt_count + 1 INTO _attempts FROM public.hub_connections WHERE id = _id FOR UPDATE;
  IF _attempts IS NULL THEN RETURN; END IF;
  _delay := LEAST(power(2, _attempts) * 15, 21600) * (0.8 + random() * 0.4);
  UPDATE public.hub_connections
     SET attempt_count = _attempts,
         delivery_state = CASE WHEN _attempts >= _max_attempts THEN 'dead' ELSE 'retrying' END,
         next_attempt_at = CASE WHEN _attempts >= _max_attempts THEN now() + interval '12 hours'
                                ELSE now() + make_interval(secs => _delay) END,
         lease_until = NULL,
         last_attempt_at = now(),
         last_error = left(COALESCE(_error, 'unknown error'), 300)
   WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.hub_release_connection(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.hub_connections SET lease_until = NULL WHERE id = _id;
$$;

CREATE OR REPLACE FUNCTION public.hub_create_connection(_site_name text, _site_origin text, _webhook_url text, _ciphertext text)
RETURNS TABLE (id uuid, delivered_tx text, delivered_seq bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _new uuid;
  _xmin xid8 := pg_snapshot_xmin(pg_current_snapshot());
BEGIN
  -- Re-pairing the same endpoint proves control again; the old identity is retired.
  UPDATE public.hub_connections c
     SET status = 'disconnected', disconnected_at = now(), secret_ciphertext = NULL,
         previous_secret_ciphertext = NULL, previous_secret_expires_at = NULL, lease_until = NULL
   WHERE c.webhook_url = _webhook_url AND c.status = 'active';
  INSERT INTO public.hub_connections (site_name, site_origin, webhook_url, secret_ciphertext, delivered_tx, delivered_seq)
  VALUES (_site_name, _site_origin, _webhook_url, _ciphertext, _xmin, 0)
  RETURNING hub_connections.id INTO _new;
  RETURN QUERY SELECT _new, _xmin::text, 0::bigint;
END $$;

CREATE OR REPLACE FUNCTION public.hub_set_connection_cursor(_id uuid, _tx text, _seq bigint)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.hub_connections
     SET delivered_tx = _tx::xid8, delivered_seq = _seq, attempt_count = 0,
         delivery_state = 'idle', next_attempt_at = now(), lease_until = NULL, last_error = NULL
   WHERE id = _id AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.hub_use_nonce(_connection_id uuid, _nonce text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.hub_used_nonces (connection_id, nonce) VALUES (_connection_id, left(_nonce, 128))
  ON CONFLICT DO NOTHING;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.hub_rate_check(_bucket text, _window_seconds integer, _max integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _n integer;
BEGIN
  SELECT count(*) INTO _n FROM public.hub_rate_events
   WHERE bucket = _bucket AND created_at > now() - make_interval(secs => _window_seconds);
  IF _n >= _max THEN RETURN false; END IF;
  INSERT INTO public.hub_rate_events (bucket) VALUES (left(_bucket, 200));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.hub_prune(_retention_days integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cutoff timestamptz := now() - make_interval(days => GREATEST(7, _retention_days));
  _max_tx xid8;
  _max_seq bigint;
  _n integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.hub_runtime WHERE id = 1 AND last_pruned_at > now() - interval '20 hours') THEN
    RETURN 0;
  END IF;
  WITH gone AS (
    DELETE FROM public.hub_content_events WHERE created_at < _cutoff RETURNING tx_id, seq
  )
  SELECT g.tx_id, g.seq INTO _max_tx, _max_seq FROM gone g ORDER BY g.tx_id DESC, g.seq DESC LIMIT 1;
  GET DIAGNOSTICS _n = ROW_COUNT;
  UPDATE public.hub_runtime
     SET last_pruned_at = now(),
         pruned_tx = CASE WHEN _max_tx IS NOT NULL AND (pruned_tx IS NULL OR (_max_tx, _max_seq) > (pruned_tx, pruned_seq)) THEN _max_tx ELSE pruned_tx END,
         pruned_seq = CASE WHEN _max_tx IS NOT NULL AND (pruned_tx IS NULL OR (_max_tx, _max_seq) > (pruned_tx, pruned_seq)) THEN _max_seq ELSE pruned_seq END
   WHERE id = 1;
  DELETE FROM public.hub_used_nonces WHERE created_at < now() - interval '1 hour';
  DELETE FROM public.hub_rate_events WHERE created_at < now() - interval '2 days';
  RETURN _n;
END $$;

-- Lock every helper to the server role only.
REVOKE ALL ON FUNCTION public.hub_head() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_events_after(text, bigint, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_claim_connections(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_record_delivery_success(uuid, text, bigint, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_record_delivery_failure(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_release_connection(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_create_connection(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_set_connection_cursor(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_use_nonce(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_rate_check(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_prune(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_kick_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_record_content_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_bump_anime_revision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_bump_season_revision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_bump_episode_revision() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_head() TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_events_after(text, bigint, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_claim_connections(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_record_delivery_success(uuid, text, bigint, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_record_delivery_failure(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_release_connection(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_create_connection(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_set_connection_cursor(uuid, text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_use_nonce(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_rate_check(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_prune(integer) TO service_role;