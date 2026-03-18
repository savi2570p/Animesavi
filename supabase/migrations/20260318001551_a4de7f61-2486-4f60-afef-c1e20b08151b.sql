
-- Create a SECURITY DEFINER function to end a watch party (any member can call it)
CREATE OR REPLACE FUNCTION public.end_watch_party(party_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check that caller is a member of the party
  IF NOT EXISTS (
    SELECT 1 FROM watch_party_members
    WHERE party_id = party_uuid AND user_id = auth.uid()
  ) THEN
    RETURN false;
  END IF;

  -- End the party
  UPDATE watch_parties SET is_active = false WHERE id = party_uuid;
  RETURN true;
END;
$$;
