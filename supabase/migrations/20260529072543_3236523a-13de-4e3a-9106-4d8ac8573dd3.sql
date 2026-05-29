DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload profile avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update profile avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete profile avatars" ON storage.objects;

UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'anime-media';

CREATE POLICY "Users can upload their own profile avatar folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'anime-media'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can update their own profile avatar folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'anime-media'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'anime-media'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can delete their own profile avatar folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'anime-media'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);