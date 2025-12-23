-- Revert: Allow everyone to view anime (needed for the app to work for non-logged-in users)
DROP POLICY IF EXISTS "Authenticated users can view anime" ON public.anime;

CREATE POLICY "Anime is viewable by everyone" 
ON public.anime 
FOR SELECT 
USING (true);

-- The anime_public view still exists and can be used by the frontend for public-facing queries
-- to avoid exposing uploader_id