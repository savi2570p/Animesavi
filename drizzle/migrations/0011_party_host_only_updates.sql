-- Only the room owner may change shared playback; members end parties via the end_watch_party function.
DROP POLICY IF EXISTS "Members can end parties" ON public.watch_parties;