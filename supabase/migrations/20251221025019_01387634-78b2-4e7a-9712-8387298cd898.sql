-- Create storage buckets for anime videos and thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('anime-videos', 'anime-videos', true, 524288000, ARRAY['video/mp4', 'video/webm', 'video/mkv', 'video/avi', 'video/mov', 'video/x-matroska']),
  ('anime-thumbnails', 'anime-thumbnails', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for anime-videos bucket
CREATE POLICY "Anyone can view anime videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'anime-videos');

CREATE POLICY "Anyone can upload anime videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'anime-videos');

CREATE POLICY "Anyone can update anime videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'anime-videos');

CREATE POLICY "Anyone can delete anime videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'anime-videos');

-- RLS policies for anime-thumbnails bucket
CREATE POLICY "Anyone can view anime thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'anime-thumbnails');

CREATE POLICY "Anyone can upload anime thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'anime-thumbnails');

CREATE POLICY "Anyone can update anime thumbnails"
ON storage.objects FOR UPDATE
USING (bucket_id = 'anime-thumbnails');

CREATE POLICY "Anyone can delete anime thumbnails"
ON storage.objects FOR DELETE
USING (bucket_id = 'anime-thumbnails');