-- Add release_date column to seasons table for custom season release dates
ALTER TABLE public.seasons ADD COLUMN release_date DATE;