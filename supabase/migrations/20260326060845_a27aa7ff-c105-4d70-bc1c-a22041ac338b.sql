CREATE TABLE public.user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL DEFAULT 'Adult content promotion',
  banned_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view their own bans" ON public.user_bans
  FOR SELECT USING (true);

CREATE POLICY "System can insert bans" ON public.user_bans
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_user_bans_user_id ON public.user_bans(user_id);
CREATE INDEX idx_user_bans_expires_at ON public.user_bans(expires_at);