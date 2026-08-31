import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ShadowMinimalPlayer } from '@/components/video/ShadowMinimalPlayer';
import { Loader2, ChevronDown } from 'lucide-react';
import type { ServerType } from '@/hooks/useServerAutoSelect';

/**
 * Shadow link v2 (BETA 2) — a standalone, branding-free watch page.
 *
 * Minimal player (timeline, play/pause, ±10s, fullscreen only), Embed server
 * listed first, Seasons dropdown + always-visible episode grid.
 */

interface ShadowEpisode {
  id: string;
  season_id: string;
  episode_number: number;
  title: string;
  video_url: string | null;
  external_url: string | null;
  thumbnail: string | null;
}

interface ShadowSeason {
  id: string;
  season_number: number;
  anime: { id: string; title: string; cover_image: string | null } | null;
}

// Neutral server label — Server 1 only on shadow links.
const SHADOW_SERVERS: { id: ServerType; label: string }[] = [
  { id: 'XPLUS', label: 'Server 1' },
];

export default function ShadowPlayerV2() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [episode, setEpisode] = useState<ShadowEpisode | null>(null);
  const [season, setSeason] = useState<ShadowSeason | null>(null);
  const [seasons, setSeasons] = useState<ShadowSeason[]>([]);
  const [episodes, setEpisodes] = useState<ShadowEpisode[]>([]);
  const [server, setServer] = useState<ServerType>('XPLUS');
  const [loading, setLoading] = useState(true);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

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
      setServer('XPLUS');

      const { data: seasonData } = await supabase
        .from('seasons')
        .select('id, season_number, anime:anime_id(id, title, cover_image)')
        .eq('id', ep.season_id)
        .maybeSingle();
      if (cancelled) return;
      const s = seasonData as ShadowSeason | null;
      setSeason(s);
      setSelectedSeasonId(s?.id ?? null);

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
    window.history.replaceState(null, '', `/s2/${id}`);
    supabase
      .from('episodes')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEpisode(data as ShadowEpisode);
          setServer('XPLUS');
        }
      });
  }, [episodeId]);

  const animeTitle = season?.anime?.title || '';
  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) || season;
  const visibleEpisodes = useMemo(
    () => episodes.filter((e) => e.season_id === (selectedSeason?.id || episode?.season_id)),
    [episodes, selectedSeason, episode],
  );

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
              <ShadowMinimalPlayer
                key={episode.id}
                videoUrl={episode.video_url || episode.external_url}
                poster={episode.thumbnail || season?.anime?.cover_image || undefined}
                overlayTitle={animeTitle || episode.title}
                overlaySeason={season?.season_number || 1}
                overlayEpisode={episode.episode_number}
              />
            </div>

            {/* Server switcher — Embed first */}
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

            {/* Title row + Seasons dropdown */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-semibold truncate">
                  {animeTitle || episode.title}
                </h1>
                <p className="text-xs text-white/50">
                  Season {season?.season_number || 1} · Episode {episode.episode_number}
                </p>
              </div>
              {seasons.length > 0 && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => setSeasonOpen((o) => !o)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 border border-white/10 text-xs text-white/80 hover:text-white transition-colors"
                  >
                    Season {selectedSeason?.season_number ?? season?.season_number ?? 1}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${seasonOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {seasonOpen && (
                    <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[120px] rounded-xl bg-neutral-900 border border-white/10 py-1 shadow-xl">
                      {seasons.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setSelectedSeasonId(s.id);
                            setSeasonOpen(false);
                          }}
                          data-active={s.id === selectedSeason?.id}
                          className="w-full text-left px-3.5 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-colors data-[active=true]:text-white data-[active=true]:font-semibold"
                        >
                          Season {s.season_number}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Episodes — always visible for the selected season */}
            {visibleEpisodes.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                {visibleEpisodes.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => switchEpisode(e.id)}
                    data-active={e.id === episode.id}
                    className="py-2 rounded-lg text-xs font-semibold bg-neutral-900 text-white/70 border border-white/10 transition-colors hover:text-white data-[active=true]:bg-white data-[active=true]:text-black data-[active=true]:border-white"
                  >
                    {e.episode_number}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
