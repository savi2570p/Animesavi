-- Remove MIME type restriction from anime-videos bucket so all video formats work
UPDATE storage.buckets 
SET allowed_mime_types = NULL 
WHERE id = 'anime-videos';