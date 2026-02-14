
-- Update trigger to auto-complete MP4 files (they don't need conversion)
CREATE OR REPLACE FUNCTION public.create_video_conversion_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.video_url IS NOT NULL AND NEW.video_url != '' THEN
    -- MP4 files are already iOS compatible - mark as completed immediately
    IF NEW.video_url ILIKE '%.mp4' THEN
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
        updated_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix existing MP4 records that are stuck in pending/processing
UPDATE public.video_conversions
SET 
  status = 'completed',
  needs_conversion = false,
  ios_ready_url = original_url,
  ios_ready_path = original_path,
  conversion_completed_at = now(),
  error_message = NULL,
  conversion_started_at = NULL
WHERE original_url ILIKE '%.mp4'
  AND status != 'completed';
