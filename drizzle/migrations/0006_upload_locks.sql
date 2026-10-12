CREATE TABLE public.upload_locks (
  email text PRIMARY KEY,
  code text NOT NULL,
  unlocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.upload_locks TO authenticated;
GRANT ALL ON public.upload_locks TO service_role;
ALTER TABLE public.upload_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner admin reads upload locks" ON public.upload_locks FOR SELECT TO authenticated
  USING (lower(auth.jwt()->>'email') = 'savi2570p@gmail.com');

CREATE OR REPLACE FUNCTION public.is_upload_locked() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.upload_locks
    WHERE email = lower(auth.jwt()->>'email') AND unlocked_at IS NULL)
$$;

CREATE OR REPLACE FUNCTION public.unlock_my_upload(_code text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.upload_locks SET unlocked_at = now()
   WHERE email = lower(auth.jwt()->>'email') AND unlocked_at IS NULL
     AND code = regexp_replace(coalesce(_code,''), '\D', '', 'g');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;
REVOKE EXECUTE ON FUNCTION public.unlock_my_upload(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_upload_locked() FROM anon;