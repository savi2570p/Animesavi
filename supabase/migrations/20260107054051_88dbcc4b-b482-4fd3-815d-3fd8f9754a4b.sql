-- Add intro and outro timestamp columns to episodes table
ALTER TABLE public.episodes
ADD COLUMN intro_start_time integer DEFAULT NULL,
ADD COLUMN intro_end_time integer DEFAULT NULL,
ADD COLUMN outro_start_time integer DEFAULT NULL,
ADD COLUMN outro_end_time integer DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.episodes.intro_start_time IS 'Start time of intro in seconds';
COMMENT ON COLUMN public.episodes.intro_end_time IS 'End time of intro in seconds';
COMMENT ON COLUMN public.episodes.outro_start_time IS 'Start time of outro in seconds';
COMMENT ON COLUMN public.episodes.outro_end_time IS 'End time of outro in seconds';