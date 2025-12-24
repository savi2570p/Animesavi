-- Drop and recreate anime-media policies to ensure they're correct
DROP POLICY IF EXISTS "Uploaders can upload anime media" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can update their anime media" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can delete their anime media" ON storage.objects;

-- Create secure policies for anime-media
CREATE POLICY "Uploaders can upload anime media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'anime-media' AND
  auth.uid() IS NOT NULL AND
  (has_role(auth.uid(), 'uploader') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Uploaders can update their anime media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'anime-media' AND
  auth.uid() IS NOT NULL AND
  (owner = auth.uid() OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Uploaders can delete their anime media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'anime-media' AND
  auth.uid() IS NOT NULL AND
  (owner = auth.uid() OR has_role(auth.uid(), 'admin'))
);