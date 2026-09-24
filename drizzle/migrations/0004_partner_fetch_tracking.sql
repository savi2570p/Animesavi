CREATE TABLE public.partner_fetch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_key_id uuid NOT NULL REFERENCES public.partner_api_keys(id) ON DELETE CASCADE,
  anime_id uuid NOT NULL REFERENCES public.anime(id) ON DELETE CASCADE,
  first_fetched_at timestamptz NOT NULL DEFAULT now(),
  last_fetched_at timestamptz NOT NULL DEFAULT now(),
  fetch_count integer NOT NULL DEFAULT 1,
  UNIQUE (partner_key_id, anime_id)
);
CREATE TABLE public.partner_resubmissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_key_id uuid NOT NULL REFERENCES public.partner_api_keys(id) ON DELETE CASCADE,
  anime_id uuid NOT NULL REFERENCES public.anime(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE (partner_key_id, anime_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_fetch_log TO authenticated;
GRANT ALL ON public.partner_fetch_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_resubmissions TO authenticated;
GRANT ALL ON public.partner_resubmissions TO service_role;
GRANT SELECT, UPDATE ON public.partner_api_keys TO authenticated;
ALTER TABLE public.partner_fetch_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_resubmissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage fetch log" ON public.partner_fetch_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage resubmissions" ON public.partner_resubmissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
ALTER TABLE public.partner_api_keys ADD COLUMN IF NOT EXISTS domain text;
UPDATE public.partner_api_keys SET domain = COALESCE(domain, allowed_domain);
DROP POLICY IF EXISTS "Admins update partner keys" ON public.partner_api_keys;
CREATE POLICY "Admins update partner keys" ON public.partner_api_keys FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins read partner keys" ON public.partner_api_keys;
CREATE POLICY "Admins read partner keys" ON public.partner_api_keys FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));