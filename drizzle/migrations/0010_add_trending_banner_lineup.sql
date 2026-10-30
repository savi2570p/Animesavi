CREATE TABLE public.trending_banner_lineup (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 anime_id uuid NOT NULL REFERENCES public.anime(id) ON DELETE CASCADE UNIQUE,
 position integer NOT NULL DEFAULT 1,
 custom_title text,
 custom_cover_url text,
 custom_banner_url text,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trending_banner_lineup TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.trending_banner_lineup TO authenticated;
GRANT ALL ON public.trending_banner_lineup TO service_role;
ALTER TABLE public.trending_banner_lineup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public active trending lineup" ON public.trending_banner_lineup FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert trending lineup" ON public.trending_banner_lineup FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update trending lineup" ON public.trending_banner_lineup FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete trending lineup" ON public.trending_banner_lineup FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX trending_banner_lineup_position_idx ON public.trending_banner_lineup(position);
CREATE TRIGGER update_trending_banner_lineup_updated_at BEFORE UPDATE ON public.trending_banner_lineup FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();