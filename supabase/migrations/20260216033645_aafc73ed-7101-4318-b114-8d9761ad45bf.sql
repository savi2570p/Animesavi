
-- Add progress tracking and codec validation fields to video_conversions
ALTER TABLE public.video_conversions
  ADD COLUMN IF NOT EXISTS conversion_progress integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_stage text DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS estimated_seconds_remaining integer,
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS video_profile text,
  ADD COLUMN IF NOT EXISTS pixel_format text,
  ADD COLUMN IF NOT EXISTS audio_channels integer,
  ADD COLUMN IF NOT EXISTS audio_sample_rate integer,
  ADD COLUMN IF NOT EXISTS subtitle_format text,
  ADD COLUMN IF NOT EXISTS container_format text,
  ADD COLUMN IF NOT EXISTS ios_compatible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS compatibility_details jsonb,
  ADD COLUMN IF NOT EXISTS hls_url text,
  ADD COLUMN IF NOT EXISTS hls_path text;

-- Create index for faster queue lookups
CREATE INDEX IF NOT EXISTS idx_video_conversions_status_needs ON public.video_conversions (status, needs_conversion);
CREATE INDEX IF NOT EXISTS idx_video_conversions_ios_compatible ON public.video_conversions (ios_compatible);
