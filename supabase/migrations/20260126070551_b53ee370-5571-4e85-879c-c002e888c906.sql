-- Step 1: Delete duplicate watch_history entries, keeping only the latest per user+anime
DELETE FROM public.watch_history
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, anime_id) id
  FROM public.watch_history
  ORDER BY user_id, anime_id, watched_at DESC
);

-- Step 2: Add unique constraint on user_id + anime_id
ALTER TABLE public.watch_history
ADD CONSTRAINT watch_history_user_anime_unique UNIQUE (user_id, anime_id);