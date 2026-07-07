CREATE OR REPLACE FUNCTION public.create_video_conversion_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_true_mp4 boolean;
BEGIN
  IF NEW.video_url IS NOT NULL AND NEW.video_url != '' THEN
    -- Treat as an already-iOS-ready MP4 only when the URL ends in .mp4 and
    -- does NOT smuggle a non-MP4 container in the filename (e.g. .mkv.mp4,
    -- .avi.mp4). Those files usually carry MKV/AVI streams under an .mp4
    -- extension and still need real server-side conversion to play.
    is_true_mp4 := NEW.video_url ~* '\.mp4($|\?|#)'
                   AND NEW.video_url !~* '\.(mkv|avi|flv|wmv|ts|m2ts|mov)\.mp4($|\?|#)';

    IF is_true_mp4 THEN
      INSERT INTO public.video_conversions (episode_id, original_url, original_path, needs_conversion, status, ios_ready_url, ios_ready_path, conversion_completed_at)
      VALUES (
        NEW.id,
        NEW.video_url,
        NEW.video_url,
        false,
        'completed',
        NEW.video_url,
        NEW.video_url,
        now()
      )
      ON CONFLICT (episode_id) DO UPDATE SET
        original_url = EXCLUDED.original_url,
        ios_ready_url = EXCLUDED.ios_ready_url,
        ios_ready_path = EXCLUDED.ios_ready_path,
        status = 'completed',
        needs_conversion = false,
        conversion_completed_at = now(),
        updated_at = now();
    ELSE
      INSERT INTO public.video_conversions (episode_id, original_url, original_path, needs_conversion)
      VALUES (
        NEW.id,
        NEW.video_url,
        NEW.video_url,
        true
      )
      ON CONFLICT (episode_id) DO UPDATE SET
        original_url = EXCLUDED.original_url,
        needs_conversion = true,
        updated_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;