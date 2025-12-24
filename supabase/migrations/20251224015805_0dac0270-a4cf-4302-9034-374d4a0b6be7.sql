-- Fix storage bucket policies for anime-videos, anime-thumbnails, anime-subtitles
-- Drop anonymous upload/update/delete policies and replace with authenticated uploader-only policies

-- Drop problematic policies for anime-videos
DROP POLICY IF EXISTS "Anyone can upload anime videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update anime videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete anime videos" ON storage.objects;

-- Drop problematic policies for anime-thumbnails
DROP POLICY IF EXISTS "Anyone can upload anime thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update anime thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete anime thumbnails" ON storage.objects;

-- Drop problematic policies for anime-subtitles
DROP POLICY IF EXISTS "Anyone can upload anime subtitles" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update anime subtitles" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete anime subtitles" ON storage.objects;

-- Create secure policies for anime-videos
CREATE POLICY "Uploaders can upload anime videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'anime-videos' AND
  auth.uid() IS NOT NULL AND
  (has_role(auth.uid(), 'uploader') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Uploaders can update their anime videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'anime-videos' AND
  auth.uid() IS NOT NULL AND
  (owner = auth.uid() OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Uploaders can delete their anime videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'anime-videos' AND
  auth.uid() IS NOT NULL AND
  (owner = auth.uid() OR has_role(auth.uid(), 'admin'))
);

-- Create secure policies for anime-thumbnails
CREATE POLICY "Uploaders can upload anime thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'anime-thumbnails' AND
  auth.uid() IS NOT NULL AND
  (has_role(auth.uid(), 'uploader') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Uploaders can update their anime thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'anime-thumbnails' AND
  auth.uid() IS NOT NULL AND
  (owner = auth.uid() OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Uploaders can delete their anime thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'anime-thumbnails' AND
  auth.uid() IS NOT NULL AND
  (owner = auth.uid() OR has_role(auth.uid(), 'admin'))
);

-- Create secure policies for anime-subtitles
CREATE POLICY "Uploaders can upload anime subtitles"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'anime-subtitles' AND
  auth.uid() IS NOT NULL AND
  (has_role(auth.uid(), 'uploader') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Uploaders can update their anime subtitles"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'anime-subtitles' AND
  auth.uid() IS NOT NULL AND
  (owner = auth.uid() OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Uploaders can delete their anime subtitles"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'anime-subtitles' AND
  auth.uid() IS NOT NULL AND
  (owner = auth.uid() OR has_role(auth.uid(), 'admin'))
);

-- Fix profiles RLS policy to require authentication for viewing other profiles
DROP POLICY IF EXISTS "Users can view non-admin profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view non-admin profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR
  (NOT EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = profiles.id AND role = 'admin'))
);

-- Add database-level constraints for input validation (using DO block for conditional creation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'username_length') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT username_length CHECK (length(username) <= 30);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_length') THEN
    ALTER TABLE public.comments ADD CONSTRAINT content_length CHECK (length(content) <= 1000);
  END IF;
END $$;