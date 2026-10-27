CREATE OR REPLACE FUNCTION public.is_party_member(_party_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.watch_party_members WHERE party_id = _party_id AND user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_party_member(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_party_member(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Anyone can view party messages" ON public.watch_party_messages;
CREATE POLICY "Party members can view messages" ON public.watch_party_messages
  FOR SELECT TO authenticated USING (public.is_party_member(party_id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view party members" ON public.watch_party_members;
CREATE POLICY "Party members can view members" ON public.watch_party_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_party_member(party_id, auth.uid()));

DROP POLICY IF EXISTS "Anyone authenticated can view shadow flix content" ON public.shadow_flix_content;
CREATE POLICY "Admins can view shadow flix content" ON public.shadow_flix_content
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));