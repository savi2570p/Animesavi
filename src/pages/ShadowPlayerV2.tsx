import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ShadowMinimalPlayer } from '@/components/video/ShadowMinimalPlayer';
import { Loader2 } from 'lucide-react';
import { isHlsUrl, isDashUrl, isMp4LikeUrl, isMkvUrl } from '@/lib/streamSource';

/**
 * Shadow link v2 (BETA 2) — a standalone, branding-free watch page.
 *
 * Minimal player (timeline, play/pause, ±10s, fullscreen only). No server
 * switcher — episodes are picked from inside the player itself.
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

export default function ShadowPlayerV2() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [episode, setEpisode] = useState<ShadowEpisode | null>(null);
  const [season, setSeason] = useState<ShadowSeason | null>(null);
  const [seasons, setSeasons] = useState<ShadowSeason[]>([]);
  const [episodes, setEpisodes] = useState<ShadowEpisode[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (id === episode?.id) return;
    window.history.replaceState(null, '', `/s2/${id}`);
    supabase
      .from('episodes')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const next = data as ShadowEpisode;
          setEpisode(next);
          // Keep the displayed season in sync when jumping across seasons.
          setSeasons((list) => {
            const match = list.find((s) => s.id === next.season_id);
            if (match) setSeason(match);
            return list;
          });
        }
      });
  }, [episode?.id]);

  const animeTitle = season?.anime?.title || '';
  const currentSeasonNumber =
    seasons.find((s) => s.id === episode?.season_id)?.season_number ??
    season?.season_number ??
    1;
  // An external_url that isn't a direct media file is an embed page → iframe it.
  const rawSource = episode?.video_url || episode?.external_url || null;
  const isDirectMedia =
    !!rawSource &&
    (isHlsUrl(rawSource) ||
      isDashUrl(rawSource) ||
      isMp4LikeUrl(rawSource) ||
      isMkvUrl(rawSource) ||
      !!episode?.video_url);
  const playerVideoUrl = isDirectMedia ? rawSource : null;
  const playerEmbedUrl = isDirectMedia ? null : rawSource;
  // Flat episode list for the in-player picker, tagged with season numbers.
  const seasonNumberById = useMemo(() => {
    const m = new Map<string, number>();
    seasons.forEach((s) => m.set(s.id, s.season_number));
    return m;
  }, [seasons]);
  const pickerEpisodes = useMemo(
    () =>
      episodes.map((e) => ({
        key: e.id,
        number: e.episode_number,
        seasonNumber: seasonNumberById.get(e.season_id) ?? season?.season_number ?? 1,
        active: e.id === episode?.id,
      })),
    [episodes, seasonNumberById, season, episode],
  ).sort((a, b) => a.seasonNumber - b.seasonNumber || a.number - b.number);

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
                videoUrl={playerVideoUrl}
                embedUrl={playerEmbedUrl}
                poster={episode.thumbnail || season?.anime?.cover_image || undefined}
                overlayTitle={animeTitle || episode.title}
                overlaySeason={currentSeasonNumber}
                overlayEpisode={episode.episode_number}
                episodes={pickerEpisodes}
                onSelectEpisode={switchEpisode}
              />
            </div>

            {/* Title row — episode switching lives inside the player */}
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold truncate">
                {animeTitle || episode.title}
              </h1>
              <p className="text-xs text-white/50">
                Season {currentSeasonNumber} · Episode {episode.episode_number}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
