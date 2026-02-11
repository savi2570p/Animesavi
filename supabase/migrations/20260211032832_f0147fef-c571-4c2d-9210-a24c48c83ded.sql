
-- Create shorts table
CREATE TABLE public.shorts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  tags text[] DEFAULT '{}'::text[],
  episode_id uuid REFERENCES public.episodes(id) ON DELETE SET NULL,
  video_url text NOT NULL,
  thumbnail text,
  start_time real NOT NULL DEFAULT 0,
  end_time real NOT NULL DEFAULT 0,
  duration real NOT NULL,
  uploader_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  view_count integer DEFAULT 0,
  CONSTRAINT shorts_max_duration CHECK (duration <= 120)
);

-- Enable RLS
ALTER TABLE public.shorts ENABLE ROW LEVEL SECURITY;

-- Everyone can view shorts
CREATE POLICY "Shorts are viewable by everyone"
ON public.shorts
FOR SELECT
USING (true);

-- Only allowed uploaders can insert shorts
CREATE POLICY "Allowed uploaders can create shorts"
ON public.shorts
FOR INSERT
WITH CHECK (auth.uid() = uploader_id AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'uploader'::app_role)));

-- Uploaders can update their own shorts
CREATE POLICY "Uploaders can update their own shorts"
ON public.shorts
FOR UPDATE
USING (auth.uid() = uploader_id OR has_role(auth.uid(), 'admin'::app_role));

-- Uploaders can delete their own shorts
CREATE POLICY "Uploaders can delete their own shorts"
ON public.shorts
FOR DELETE
USING (auth.uid() = uploader_id OR has_role(auth.uid(), 'admin'::app_role));

-- Create allowed_short_uploaders table for email-based access control
CREATE TABLE public.allowed_short_uploaders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.allowed_short_uploaders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage allowed short uploaders"
ON public.allowed_short_uploaders
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view allowed short uploaders"
ON public.allowed_short_uploaders
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert the allowed emails
INSERT INTO public.allowed_short_uploaders (email) VALUES
('savi2570p@gmail.com'),
('savipanjeta2@gmail.com');

-- Add updated_at trigger
CREATE TRIGGER update_shorts_updated_at
BEFORE UPDATE ON public.shorts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for shorts
ALTER PUBLICATION supabase_realtime ADD TABLE public.shorts;
