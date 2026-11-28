CREATE OR REPLACE FUNCTION public.protect_anime_featured()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_featured := false;
  ELSIF NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
    NEW.is_featured := OLD.is_featured;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_anime_featured ON public.anime;
CREATE TRIGGER protect_anime_featured BEFORE INSERT OR UPDATE ON public.anime
FOR EACH ROW EXECUTE FUNCTION public.protect_anime_featured();

DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.watch_party_messages;
CREATE POLICY "Party members can send messages" ON public.watch_party_messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.is_party_member(party_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.watch_parties p WHERE p.id = party_id AND p.host_id = auth.uid())
  )
);