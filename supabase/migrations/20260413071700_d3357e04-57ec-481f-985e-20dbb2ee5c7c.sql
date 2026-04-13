
CREATE TABLE public.shadow_flix_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  video_url TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shadow_flix_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view shadow flix content"
ON public.shadow_flix_content FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own shadow flix content"
ON public.shadow_flix_content FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update their own shadow flix content"
ON public.shadow_flix_content FOR UPDATE
TO authenticated
USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own shadow flix content"
ON public.shadow_flix_content FOR DELETE
TO authenticated
USING (auth.uid() = uploaded_by);

CREATE TRIGGER update_shadow_flix_content_updated_at
BEFORE UPDATE ON public.shadow_flix_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
