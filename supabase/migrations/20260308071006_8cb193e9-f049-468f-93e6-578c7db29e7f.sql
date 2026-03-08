
-- Allow any authenticated member to end (deactivate) a party
CREATE POLICY "Members can end parties"
ON public.watch_parties
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.watch_party_members
    WHERE watch_party_members.party_id = watch_parties.id
      AND watch_party_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.watch_party_members
    WHERE watch_party_members.party_id = watch_parties.id
      AND watch_party_members.user_id = auth.uid()
  )
);
