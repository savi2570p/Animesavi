-- Create table to track video conversion status
CREATE TABLE public.video_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  original_path TEXT,
  ios_ready_url TEXT,
  ios_ready_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  file_size_bytes BIGINT,
  ios_file_size_bytes BIGINT,
  error_message TEXT,
  video_codec TEXT,
  audio_codec TEXT,
  is_10bit BOOLEAN DEFAULT FALSE,
  is_hevc BOOLEAN DEFAULT FALSE,
  needs_conversion BOOLEAN DEFAULT TRUE,
  conversion_started_at TIMESTAMP WITH TIME ZONE,
  conversion_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(episode_id)
);

-- Enable RLS
ALTER TABLE public.video_conversions ENABLE ROW LEVEL SECURITY;

-- Policies for video conversions
CREATE POLICY "Video conversions are viewable by everyone"
  ON public.video_conversions
  FOR SELECT
  USING (true);

CREATE POLICY "Uploaders and admins can manage conversions"
  ON public.video_conversions
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'uploader'::app_role)
  );

-- Create trigger to update updated_at
CREATE TRIGGER update_video_conversions_updated_at
  BEFORE UPDATE ON public.video_conversions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_video_conversions_status ON public.video_conversions(status);
CREATE INDEX idx_video_conversions_episode_id ON public.video_conversions(episode_id);

-- Add trigger to automatically create conversion record when episode is created with video_url
CREATE OR REPLACE FUNCTION public.create_video_conversion_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create record if video_url is set and it's an MKV or not already iOS-compatible
  IF NEW.video_url IS NOT NULL AND NEW.video_url != '' THEN
    INSERT INTO public.video_conversions (episode_id, original_url, original_path, needs_conversion)
    VALUES (
      NEW.id,
      NEW.video_url,
      NEW.video_url,
      -- Check if already MP4 (might be iOS compatible)
      NOT (NEW.video_url ILIKE '%.mp4')
    )
    ON CONFLICT (episode_id) DO UPDATE SET
      original_url = EXCLUDED.original_url,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_episode_video_upload
  AFTER INSERT OR UPDATE OF video_url ON public.episodes
  FOR EACH ROW
  EXECUTE FUNCTION public.create_video_conversion_record();