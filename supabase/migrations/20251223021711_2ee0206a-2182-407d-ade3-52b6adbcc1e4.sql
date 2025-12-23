-- Create upload_codes table to track one-time use upload codes
CREATE TABLE public.upload_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.upload_codes ENABLE ROW LEVEL SECURITY;

-- Only admins can view all codes
CREATE POLICY "Admins can manage upload codes"
ON public.upload_codes
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Insert the initial upload code
INSERT INTO public.upload_codes (code) VALUES ('AniPro');

-- Create allowed_uploaders table for whitelisted emails
CREATE TABLE public.allowed_uploaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.allowed_uploaders ENABLE ROW LEVEL SECURITY;

-- Only admins can manage allowed uploaders
CREATE POLICY "Admins can manage allowed uploaders"
ON public.allowed_uploaders
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Insert the allowed uploader emails
INSERT INTO public.allowed_uploaders (email) VALUES 
  ('Savi2570p@gmail.com'),
  ('Savipanjeta2@gmail.com');

-- Add unique constraint to watch_history for upsert to work
ALTER TABLE public.watch_history 
ADD CONSTRAINT watch_history_user_episode_unique 
UNIQUE (user_id, episode_id);