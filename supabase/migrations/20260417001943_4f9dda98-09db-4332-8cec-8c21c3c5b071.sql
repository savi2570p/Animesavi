ALTER TABLE public.shadow_flix_content ADD COLUMN IF NOT EXISTS banner_url text DEFAULT NULL;
ALTER TABLE public.shadow_flix_content ADD COLUMN IF NOT EXISTS genres text[] DEFAULT '{}'::text[];