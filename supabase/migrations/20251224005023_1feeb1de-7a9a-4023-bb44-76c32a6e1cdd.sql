-- Increase storage bucket file size limits to support large anime uploads
-- NOTE: limits are in bytes

UPDATE storage.buckets
SET file_size_limit = 107374182400 -- 100GB
WHERE id = 'anime-videos';

UPDATE storage.buckets
SET file_size_limit = 1073741824 -- 1GB
WHERE id = 'anime-thumbnails';
