
-- Drop the restrictive UPDATE policies and recreate as permissive
DROP POLICY IF EXISTS "Hosts can update their parties" ON public.watch_parties;
DROP POLICY IF EXISTS "Members can end parties" ON public.watch_parties;

-- Recreate as PERMISSIVE so either host OR member can update
CREATE POLICY "Hosts can update their parties"
ON public.watch_parties
FOR UPDATE
TO authenticated
USING (auth.uid() = host_id);

CREATE POLICY "Members can end parties"
ON public.watch_parties
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM watch_party_members
  WHERE watch_party_members.party_id = watch_parties.id
  AND watch_party_members.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM watch_party_members
  WHERE watch_party_members.party_id = watch_parties.id
  AND watch_party_members.user_id = auth.uid()
));
