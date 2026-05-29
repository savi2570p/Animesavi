
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'anime-media'
  AND name LIKE 'avatars/' || auth.uid()::text || '-%'
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'anime-media'
  AND name LIKE 'avatars/' || auth.uid()::text || '-%'
)
WITH CHECK (
  bucket_id = 'anime-media'
  AND name LIKE 'avatars/' || auth.uid()::text || '-%'
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'anime-media'
  AND name LIKE 'avatars/' || auth.uid()::text || '-%'
);
