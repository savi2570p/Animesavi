ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS dub_video_url text;
COMMENT ON COLUMN public.episodes.dub_video_url IS 'Optional dubbed video for episodes whose main video is SUB; original SUB media is preserved.';
CREATE OR REPLACE FUNCTION public.hub_bump_episode_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.content_revision := nextval('public.hub_content_revision_seq');
  ELSIF ROW(NEW.season_id, NEW.episode_number, NEW.title, NEW.description, NEW.thumbnail, NEW.video_url,
            NEW.sub_video_url, NEW.dub_video_url, NEW.external_url, NEW.duration, NEW.audio_language, NEW.captions_url,
            NEW.intro_start_time, NEW.intro_end_time, NEW.outro_start_time, NEW.outro_end_time)
        IS DISTINCT FROM
        ROW(OLD.season_id, OLD.episode_number, OLD.title, OLD.description, OLD.thumbnail, OLD.video_url,
            OLD.sub_video_url, OLD.dub_video_url, OLD.external_url, OLD.duration, OLD.audio_language, OLD.captions_url,
            OLD.intro_start_time, OLD.intro_end_time, OLD.outro_start_time, OLD.outro_end_time) THEN
    NEW.content_revision := nextval('public.hub_content_revision_seq');
  ELSE
    NEW.content_revision := OLD.content_revision;
  END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.hub_bump_episode_revision() FROM PUBLIC, anon, authenticated;