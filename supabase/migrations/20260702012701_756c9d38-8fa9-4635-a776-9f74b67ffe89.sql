-- Fix subtitle RLS: allow admins and uploaders to overwrite subtitle files
-- regardless of the original owner (upsert scenario).

DROP POLICY IF EXISTS "Uploaders can update their anime subtitles" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can delete their anime subtitles" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can upload anime subtitles" ON storage.objects;

CREATE POLICY "Admins and uploaders can upload anime subtitles"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'anime-subtitles'
  AND auth.uid() IS NOT NULL
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'uploader'::app_role))
);

CREATE POLICY "Admins and uploaders can update anime subtitles"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'anime-subtitles'
  AND auth.uid() IS NOT NULL
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'uploader'::app_role))
)
WITH CHECK (
  bucket_id = 'anime-subtitles'
  AND auth.uid() IS NOT NULL
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'uploader'::app_role))
);

CREATE POLICY "Admins and uploaders can delete anime subtitles"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'anime-subtitles'
  AND auth.uid() IS NOT NULL
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'uploader'::app_role))
);

-- Ensure public read access on the bucket is retained (bucket is public,
-- but add an explicit SELECT policy for completeness).
DROP POLICY IF EXISTS "Public can read anime subtitles" ON storage.objects;
CREATE POLICY "Public can read anime subtitles"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'anime-subtitles');