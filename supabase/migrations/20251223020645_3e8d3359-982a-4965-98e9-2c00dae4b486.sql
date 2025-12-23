-- Create a public view that excludes uploader_id for anonymous access
CREATE OR REPLACE VIEW public.anime_public AS
SELECT 
  id,
  title,
  description,
  cover_image,
  banner_image,
  type,
  status,
  genres,
  release_year,
  view_count,
  like_count,
  is_featured,
  created_at,
  updated_at
FROM public.anime;

-- Grant access to the view for all users
GRANT SELECT ON public.anime_public TO anon;
GRANT SELECT ON public.anime_public TO authenticated;

-- Drop the old permissive SELECT policy
DROP POLICY IF EXISTS "Anime is viewable by everyone" ON public.anime;

-- Create new SELECT policy: only authenticated users can see full anime data (including uploader_id)
-- This is needed for uploaders/admins to manage their content
CREATE POLICY "Authenticated users can view anime" 
ON public.anime 
FOR SELECT 
TO authenticated
USING (true);

-- Uploaders and admins can see their own content's uploader_id
-- Regular authenticated users see all anime but the uploader_id exposure is limited to logged-in users only