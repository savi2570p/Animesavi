-- Add richer metadata fields to anime
ALTER TABLE public.anime
  ADD COLUMN IF NOT EXISTS studio TEXT,
  ADD COLUMN IF NOT EXISTS total_episodes INTEGER,
  ADD COLUMN IF NOT EXISTS source_material TEXT,
  ADD COLUMN IF NOT EXISTS content_rating TEXT;

-- Admin-issued 1-month free trial grants
CREATE TABLE IF NOT EXISTS public.admin_token_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  granted_by UUID NOT NULL,
  duration_hours INTEGER NOT NULL DEFAULT 720,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_token_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own grants"
ON public.admin_token_grants FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can acknowledge their own grants"
ON public.admin_token_grants FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all grants"
ON public.admin_token_grants FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create grants"
ON public.admin_token_grants FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND granted_by = auth.uid());

CREATE POLICY "Admins can delete grants"
ON public.admin_token_grants FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_admin_token_grants_user_id ON public.admin_token_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_token_grants_expires_at ON public.admin_token_grants(expires_at);