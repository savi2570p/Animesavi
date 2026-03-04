
-- Create movies bucket with 20GB limit
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('movies', 'movies', true, 21474836480)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 21474836480, public = true;

-- Also update anime-videos bucket to 90GB as previously configured
UPDATE storage.buckets SET file_size_limit = 96636764160 WHERE id = 'anime-videos';

-- RLS policies for movies bucket
CREATE POLICY "Anyone can view movies" ON storage.objects FOR SELECT USING (bucket_id = 'movies');
CREATE POLICY "Authenticated users can upload movies" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'movies' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own movies" ON storage.objects FOR UPDATE USING (bucket_id = 'movies' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own movies" ON storage.objects FOR DELETE USING (bucket_id = 'movies' AND auth.uid()::text = (storage.foldername(name))[1]);
