
-- Drop old constraint and add updated one with 'upcoming'
ALTER TABLE public.anime DROP CONSTRAINT IF EXISTS anime_status_check;
ALTER TABLE public.anime ADD CONSTRAINT anime_status_check CHECK (status = ANY (ARRAY['ongoing'::text, 'completed'::text, 'upcoming'::text]));

-- Also fix the type constraint to allow ova and special
ALTER TABLE public.anime DROP CONSTRAINT IF EXISTS anime_type_check;
ALTER TABLE public.anime ADD CONSTRAINT anime_type_check CHECK (type = ANY (ARRAY['series'::text, 'movie'::text, 'ova'::text, 'special'::text]));
