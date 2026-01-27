-- Add message length constraint to watch_party_messages table
ALTER TABLE public.watch_party_messages 
ADD CONSTRAINT message_length_check CHECK (length(message) <= 500);

-- Add a validation trigger for additional security (belt and suspenders approach)
CREATE OR REPLACE FUNCTION public.validate_watch_party_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate message length
  IF length(NEW.message) > 500 THEN
    RAISE EXCEPTION 'Message too long. Maximum 500 characters allowed.';
  END IF;
  
  -- Validate message is not empty
  IF trim(NEW.message) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for message validation
CREATE TRIGGER validate_message_before_insert
  BEFORE INSERT ON public.watch_party_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_watch_party_message();