-- Add audio_language field to episodes table to track which audio dub is used
ALTER TABLE public.episodes 
ADD COLUMN IF NOT EXISTS audio_language TEXT DEFAULT 'original';

-- Add a comment to explain the field
COMMENT ON COLUMN public.episodes.audio_language IS 'Audio language/dub of the episode (e.g., Hindi, English, Japanese, etc.)';