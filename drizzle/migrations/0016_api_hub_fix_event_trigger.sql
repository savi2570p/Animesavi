CREATE OR REPLACE FUNCTION public.hub_record_content_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _anime uuid;
  _season uuid;
  _old_anime uuid;
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

  IF TG_OP = 'UPDATE' THEN
    IF NEW.content_revision = OLD.content_revision THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'anime' THEN
    _anime := NEW.id;
  ELSIF TG_TABLE_NAME = 'seasons' THEN
    _anime := NEW.anime_id;
    IF TG_OP = 'UPDATE' THEN
      _old_anime := OLD.anime_id;
    END IF;
  ELSE
    _season := NEW.season_id;
    SELECT anime_id INTO _anime FROM public.seasons WHERE id = NEW.season_id;
  END IF;

  INSERT INTO public.hub_content_events (entity_type, entity_id, anime_id, season_id, action, revision)
  VALUES (CASE TG_TABLE_NAME WHEN 'anime' THEN 'anime' WHEN 'seasons' THEN 'season' ELSE 'episode' END,
          NEW.id, _anime, _season, 'change', NEW.content_revision);

  -- A season moved to another anime: refresh the old parent tree too.
  IF _old_anime IS NOT NULL AND _old_anime IS DISTINCT FROM _anime THEN
    INSERT INTO public.hub_content_events (entity_type, entity_id, anime_id, action, revision)
    VALUES ('anime', _old_anime, _old_anime, 'change', nextval('public.hub_content_revision_seq'));
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.hub_record_content_event() FROM PUBLIC, anon, authenticated;

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
REVOKE ALL ON FUNCTION public.hub_record_delivery_success(uuid, text, bigint, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_record_delivery_success(uuid, text, bigint, integer) TO service_role;