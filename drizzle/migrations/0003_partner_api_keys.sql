CREATE TABLE public.partner_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  allowed_domain text,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.partner_api_keys TO service_role;
ALTER TABLE public.partner_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage partner keys" ON public.partner_api_keys FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_api_keys TO authenticated;