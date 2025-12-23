-- Drop and recreate the view with SECURITY INVOKER (default, but being explicit)
DROP VIEW IF EXISTS public.anime_public;

CREATE VIEW public.anime_public 
WITH (security_invoker = true) AS
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