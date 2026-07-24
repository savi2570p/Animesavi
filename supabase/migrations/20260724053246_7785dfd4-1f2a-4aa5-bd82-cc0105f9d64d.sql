
CREATE TABLE public.featured_hero_lineup (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anime_id UUID NOT NULL REFERENCES public.anime(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  custom_title TEXT,
  custom_cover_url TEXT,
  custom_banner_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(anime_id)
);

CREATE INDEX idx_featured_hero_lineup_position ON public.featured_hero_lineup(position);

GRANT SELECT ON public.featured_hero_lineup TO anon, authenticated;
GRANT ALL ON public.featured_hero_lineup TO service_role;

ALTER TABLE public.featured_hero_lineup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view featured lineup"
  ON public.featured_hero_lineup FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert featured lineup"
  ON public.featured_hero_lineup FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_flox_admin(auth.uid()));

CREATE POLICY "Admins can update featured lineup"
  ON public.featured_hero_lineup FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_flox_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_flox_admin(auth.uid()));

CREATE POLICY "Admins can delete featured lineup"
  ON public.featured_hero_lineup FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_flox_admin(auth.uid()));

CREATE TRIGGER update_featured_hero_lineup_updated_at
  BEFORE UPDATE ON public.featured_hero_lineup
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
