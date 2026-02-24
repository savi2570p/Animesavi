-- Create a system token for free trial grants
INSERT INTO public.unlock_tokens (token, duration_hours, is_active, created_by)
SELECT '__free_trial__', 1, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.unlock_tokens WHERE token = '__free_trial__');

-- Create a function that grants 1-hour free premium on signup
CREATE OR REPLACE FUNCTION public.grant_free_trial()
RETURNS TRIGGER AS $$
DECLARE
  trial_token_id uuid;
  expires_at_ms bigint;
BEGIN
  -- Get the free trial token ID
  SELECT id INTO trial_token_id FROM public.unlock_tokens WHERE token = '__free_trial__' LIMIT 1;
  
  IF trial_token_id IS NOT NULL THEN
    -- Calculate expiration: 1 hour from now in milliseconds
    expires_at_ms := (extract(epoch from now()) * 1000 + 3600000)::bigint;
    
    -- Insert a token_usage record for the new user
    INSERT INTO public.token_usage (token_id, user_id, expires_at, user_agent)
    VALUES (trial_token_id, NEW.id, expires_at_ms, 'signup_free_trial');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger after new user profile is created (runs after handle_new_user)
CREATE TRIGGER grant_free_trial_on_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_free_trial();