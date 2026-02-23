
CREATE TABLE public.token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES public.unlock_tokens(id) ON DELETE CASCADE,
  user_ip text,
  user_agent text,
  used_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and uploaders can view token usage" ON public.token_usage
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'uploader'::app_role));

CREATE POLICY "Anyone can insert token usage" ON public.token_usage
  FOR INSERT WITH CHECK (true);
