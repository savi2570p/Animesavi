-- Fix the ambiguous genre column reference in the update_genre_preferences function
CREATE OR REPLACE FUNCTION public.update_genre_preferences()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  anime_genres TEXT[];
  current_genre TEXT;
BEGIN
  SELECT genres INTO anime_genres FROM public.anime WHERE id = NEW.anime_id;
  
  IF anime_genres IS NOT NULL THEN
    FOREACH current_genre IN ARRAY anime_genres
    LOOP
      INSERT INTO public.user_genre_preferences (user_id, genre, watch_count)
      VALUES (NEW.user_id, current_genre, 1)
      ON CONFLICT (user_id, genre)
      DO UPDATE SET watch_count = user_genre_preferences.watch_count + 1, updated_at = now();
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;