import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { Loader2, ListVideo, ChevronDown } from 'lucide-react';
import type { ServerType } from '@/hooks/useServerAutoSelect';

/**
 * Shadow link v2 (BETA 1) — a standalone, branding-free watch page.
 *
 * Performance-first: no glass, no heavy overlays, single query round for the
 * episode payload. All servers + the full episode list work exactly like the
 * main watch page, so a copied link plays every episode on every server.
 */

interface ShadowEpisode {
  id: string;
  season_id: string;
  episode_number: number;
  title: string;
  video_url: string | null;
  external_url: string | null;
  thumbnail: string | null;
  captions_url: string | null;
  audio_language: string | null;
  intro_start_time: number | null;
  intro_end_time: number | null;
  outro_start_time: number | null;
  outro_end_time: number | null;
}

interface ShadowSeason {
  id: string;
  season_number: number;
  anime: { id: string; title: string; cover_image: string | null } | null;
}

// Neutral server labels — no brand names on shadow links.
const SHADOW_SERVERS: { id: ServerType; label: string }[] = [
  { id: 'XPLUS', label: 'Server 1' },
  { id: 'PLAY', label: 'Server 2' },
  { id: 'Zex', label: 'Server 3' },
  { id: 'EMBED', label: 'Embed' },
];

export default function ShadowPlayerV2() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [episode, setEpisode] = useState<ShadowEpisode | null>(null);
  const [season, setSeason] = useState<ShadowSeason | null>(null);
  const [seasons, setSeasons] = useState<ShadowSeason[]>([]);
  const [episodes, setEpisodes] = useState<ShadowEpisode[]>([]);
  const [server, setServer] = useState<ServerType>('XPLUS');
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!episodeId) return;
      setLoading(true);
      const { data: ep } = await supabase
        .from('episodes')
        .select('*')
        .eq('id', episodeId)
        .maybeSingle();
      if (cancelled || !ep) {
        if (!cancelled) setLoading(false);
        return;
      }
      setEpisode(ep as ShadowEpisode);
      // Default server: embed-only episodes start on Embed, files on Server 1.
      setServer(ep.video_url ? 'XPLUS' : 'EMBED');

      const { data: seasonData } = await supabase
        .from('seasons')
        .select('id, season_number, anime:anime_id(id, title, cover_image)')
        .eq('id', ep.season_id)
        .maybeSingle();
      if (cancelled) return;
      const s = seasonData as ShadowSeason | null;
      setSeason(s);

      if (s?.anime?.id) {
        const { data: allSeasons } = await supabase
          .from('seasons')
          .select('id, season_number, anime:anime_id(id, title, cover_image)')
          .eq('anime_id', s.anime.id)
          .order('season_number', { ascending: true });
        if (cancelled) return;
        const seasonList = (allSeasons as ShadowSeason[]) || [];
        setSeasons(seasonList);

        const seasonIds = seasonList.map((x) => x.id);
        if (seasonIds.length) {
          const { data: eps } = await supabase
            .from('episodes')
            .select('id, season_id, episode_number, title, thumbnail, video_url, external_url')
            .in('season_id', seasonIds)
            .order('episode_number', { ascending: true });
          if (!cancelled) setEpisodes((eps as ShadowEpisode[]) || []);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [episodeId]);

  const switchEpisode = useCallback((id: string) => {
    if (id === episodeId) return;
    // Client-side swap keeps the SPA snappy — reuse already-loaded lists.
    window.history.replaceState(null, '', `/s2/${id}`);
    const target = episodes.find((e) => e.id === id);
    if (target) {
      // Full record needed for player fields — quick single fetch.
      supabase
        .from('episodes')
        .select('*')
        .eq('id', id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setEpisode(data as ShadowEpisode);
            setServer(data.video_url ? 'XPLUS' : 'EMBED');
            setPickerOpen(false);
          }
        });
    }
  }, [episodeId, episodes]);

  const nextEpisode = useMemo(() => {
    if (!episode) return null;
    const idx = episodes.findIndex((e) => e.id === episode.id);
    return idx >= 0 && idx < episodes.length - 1 ? episodes[idx + 1] : null;
  }, [episode, episodes]);

  const animeTitle = season?.anime?.title || '';

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-5xl px-3 py-3 sm:px-4 sm:py-5 space-y-3">
        {loading ? (
          <div className="aspect-video w-full rounded-2xl bg-neutral-900 grid place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
          </div>
        ) : !episode ? (
          <div className="aspect-video w-full rounded-2xl bg-neutral-900 grid place-items-center">
            <p className="text-sm text-white/60">Episode not found.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl overflow-hidden">
              <VideoPlayer
                key={`${episode.id}-${server}`}
                videoUrl={episode.video_url}
                externalUrl={episode.external_url}
                title={episode.title}
                animeTitle={animeTitle}
                episodeNumber={episode.episode_number}
                seasonNumber={season?.season_number || 1}
                episodeId={episode.id}
                poster={season?.anime?.cover_image || undefined}
                bannerImage={episode.thumbnail || season?.anime?.cover_image || null}
                activeServer={server}
                captionsUrl={episode.captions_url}
                audioLanguage={episode.audio_language || undefined}
                introStartTime={episode.intro_start_time}
                introEndTime={episode.intro_end_time}
                outroStartTime={episode.outro_start_time}
                outroEndTime={episode.outro_end_time}
                hasNextEpisode={!!nextEpisode}
                onNextEpisode={nextEpisode ? () => switchEpisode(nextEpisode.id) : undefined}
              />
            </div>

            {/* Server switcher — flat, fast */}
            <div className="flex items-center gap-2 flex-wrap">
              {SHADOW_SERVERS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setServer(s.id)}
                  data-active={server === s.id}
                  className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-neutral-900 text-white/70 border border-white/10 transition-colors hover:text-white data-[active=true]:bg-white data-[active=true]:text-black data-[active=true]:border-white"
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Title row */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-semibold truncate">
                  {animeTitle || episode.title}
                </h1>
                <p className="text-xs text-white/50">
                  Season {season?.season_number || 1} · Episode {episode.episode_number}
                </p>
              </div>
              {episodes.length > 1 && (
                <button
                  onClick={() => setPickerOpen((o) => !o)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 border border-white/10 text-xs text-white/80 hover:text-white transition-colors"
                >
                  <ListVideo className="h-3.5 w-3.5" />
                  Episodes
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
            </div>

            {/* Episode picker — every episode works on the shadow link */}
            {pickerOpen && episodes.length > 1 && (
              <div className="rounded-2xl bg-neutral-900 border border-white/10 p-3 space-y-3">
                {seasons.map((s) => {
                  const eps = episodes.filter((e) => e.season_id === s.id);
                  if (!eps.length) return null;
                  return (
                    <div key={s.id} className="space-y-2">
                      {seasons.length > 1 && (
                        <p className="text-[10px] uppercase tracking-widest text-white/40">
                          Season {s.season_number}
                        </p>
                      )}
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                        {eps.map((e) => (
                          <button
                            key={e.id}
                            onClick={() => switchEpisode(e.id)}
                            data-active={e.id === episode.id}
                            className="py-2 rounded-lg text-xs font-semibold bg-black/40 text-white/70 border border-white/10 transition-colors hover:text-white data-[active=true]:bg-white data-[active=true]:text-black data-[active=true]:border-white"
                          >
                            {e.episode_number}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
