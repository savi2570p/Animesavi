-- Increase storage bucket file size limits (bytes)
UPDATE storage.buckets
SET file_size_limit = 109951162777600 -- 100TB
WHERE id = 'anime-videos';

-- Create/ensure captions bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('anime-subtitles', 'anime-subtitles', true, 1073741824) -- 1GB
ON CONFLICT (id)
DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- Public access policies (matches existing project pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can view anime subtitles'
  ) THEN
    CREATE POLICY "Anyone can view anime subtitles"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'anime-subtitles');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can upload anime subtitles'
  ) THEN
    CREATE POLICY "Anyone can upload anime subtitles"
    ON storage.objects
    FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'anime-subtitles');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can update anime subtitles'
  ) THEN
    CREATE POLICY "Anyone can update anime subtitles"
    ON storage.objects
    FOR UPDATE
    TO public
    USING (bucket_id = 'anime-subtitles');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can delete anime subtitles'
  ) THEN
    CREATE POLICY "Anyone can delete anime subtitles"
    ON storage.objects
    FOR DELETE
    TO public
    USING (bucket_id = 'anime-subtitles');
  END IF;
END $$;

-- Store captions (WebVTT) URL per episode
ALTER TABLE public.episodes
ADD COLUMN IF NOT EXISTS captions_url TEXT NULL;