
CREATE TABLE IF NOT EXISTS public.flox_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  banner_url text,
  poster_url text,
  source_type text NOT NULL CHECK (source_type IN ('embed','file')),
  source_url text NOT NULL,
  episode_number integer,
  season_number integer DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flox_content ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_flox_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND lower(email) = 'savi2570p@gmail.com'
  );
$$;

CREATE POLICY "Flox content viewable by everyone"
  ON public.flox_content FOR SELECT
  USING (true);

CREATE POLICY "Only Flox admin can insert"
  ON public.flox_content FOR INSERT
  WITH CHECK (public.is_flox_admin(auth.uid()));

CREATE POLICY "Only Flox admin can update"
  ON public.flox_content FOR UPDATE
  USING (public.is_flox_admin(auth.uid()));

CREATE POLICY "Only Flox admin can delete"
  ON public.flox_content FOR DELETE
  USING (public.is_flox_admin(auth.uid()));

CREATE TRIGGER trg_flox_content_updated_at
  BEFORE UPDATE ON public.flox_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
