ALTER TABLE public.shadow_flix_content
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_shadow_flix_featured ON public.shadow_flix_content (is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_shadow_flix_sort ON public.shadow_flix_content (sort_order);