
CREATE TABLE public.unlock_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  duration_hours integer NOT NULL DEFAULT 24,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.unlock_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tokens" ON public.unlock_tokens
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read active tokens for verification" ON public.unlock_tokens
  FOR SELECT USING (is_active = true);
