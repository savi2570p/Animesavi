-- Fix: Add username validation trigger instead of CHECK constraint (for new data only)
CREATE OR REPLACE FUNCTION public.validate_username()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.username IS NOT NULL AND NEW.username !~ '^[a-zA-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, underscores, and hyphens';
  END IF;
  IF NEW.username IS NOT NULL AND (length(NEW.username) < 3 OR length(NEW.username) > 30) THEN
    RAISE EXCEPTION 'Username must be between 3 and 30 characters';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_username_before_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.username IS DISTINCT FROM OLD.username)
  EXECUTE FUNCTION public.validate_username();