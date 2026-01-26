-- Fix: Restrict watch_party_members SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view party members" ON public.watch_party_members;

CREATE POLICY "Authenticated users can view party members"
ON public.watch_party_members FOR SELECT
TO authenticated
USING (true);