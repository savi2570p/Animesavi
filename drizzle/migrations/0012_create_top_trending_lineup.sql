CREATE TABLE public.top_trending_lineup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anime_id uuid NOT NULL REFERENCES public.anime(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  custom_title text,
  custom_cover_url text,
  custom_banner_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anime_id)
);

GRANT SELECT ON public.top_trending_lineup TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.top_trending_lineup TO authenticated;
GRANT ALL ON public.top_trending_lineup TO service_role;

ALTER TABLE public.top_trending_lineup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public active top trending lineup" ON public.top_trending_lineup
  FOR SELECT TO anon, authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert top trending lineup" ON public.top_trending_lineup
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update top trending lineup" ON public.top_trending_lineup
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete top trending lineup" ON public.top_trending_lineup
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX top_trending_lineup_position_idx ON public.top_trending_lineup (position);

CREATE TRIGGER update_top_trending_lineup_updated_at
  BEFORE UPDATE ON public.top_trending_lineup
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();