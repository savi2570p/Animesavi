CREATE TABLE IF NOT EXISTS public.video_embeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  playback_url TEXT,
  playback_type TEXT,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  error_message TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_verified_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT video_embeds_status_check CHECK (status IN ('READY','PROCESSING','FAILED','DISABLED'))
);

CREATE INDEX IF NOT EXISTS idx_video_embeds_episode ON public.video_embeds(episode_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_embeds_active_episode
  ON public.video_embeds(episode_id) WHERE status <> 'DISABLED';

GRANT SELECT ON public.video_embeds TO authenticated;
GRANT ALL ON public.video_embeds TO service_role;

ALTER TABLE public.video_embeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view embed mappings"
ON public.video_embeds FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_video_embeds_updated_at ON public.video_embeds;
CREATE TRIGGER update_video_embeds_updated_at
BEFORE UPDATE ON public.video_embeds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();