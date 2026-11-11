import { useState, useCallback, useEffect, useRef } from 'react';


export type ServerType = 'PLAY' | 'SHORT' | 'Zex' | 'XPLUS' | 'SUB' | 'EMBED';

/** Server groups shown under the player: DUB servers keep the dubbed audio, SUB locks Japanese. */
export const DUB_SERVERS: ServerType[] = ['PLAY', 'XPLUS'];
export const SUB_SERVERS: ServerType[] = ['SUB'];

/** True when a SUB (Japanese audio) video was added to this episode. */
export function episodeHasSub(ep: { sub_video_url?: string | null } | null | undefined): boolean {
  return !!ep?.sub_video_url?.trim();
}

/**
 * Which server groups an episode offers. SUB-only titles get only the SUB server;
 * DUB titles get the SUB server only on episodes that have a SUB video added.
 */
export function getServerGroups(isSubOnly: boolean, hasSubEpisode: boolean): { dub: ServerType[]; sub: ServerType[] } {
  if (isSubOnly) return { dub: [], sub: SUB_SERVERS };
  return { dub: DUB_SERVERS, sub: hasSubEpisode ? SUB_SERVERS : [] };
}

/** Audio marks for an episode: its dub mark, plus SUB when a SUB video was added. */
export function getEpisodeAudioMarks(
  anime: { isSubOnly?: boolean | null; isEngDub?: boolean | null },
  ep: { sub_video_url?: string | null },
): ('H-DUB' | 'E-DUB' | 'SUB')[] {
  if (anime.isSubOnly) return ['SUB'];
  const dub = anime.isEngDub ? 'E-DUB' : 'H-DUB';
  return episodeHasSub(ep) ? [dub, 'SUB'] : [dub];
}

/** On a DUB title, the SUB server lists only the episodes that have a SUB video. */
export function filterEpisodesForServer<T extends { sub_video_url?: string | null }>(
  episodes: T[], server: ServerType, isSubOnly: boolean,
): T[] {
  if (server !== 'SUB' || isSubOnly) return episodes;
  return episodes.filter(episodeHasSub);
}

/** The SUB server plays through the X-PLUS engine with the audio locked to Japanese. */
export function getPlaybackEngine(server: ServerType): ServerType {
  return server === 'SUB' ? 'XPLUS' : server;
}

/** Video file a server plays: 4K+ uses the episode's own SUB file when one was added, else the main file. */
export function getServerVideoUrl(
  server: ServerType,
  mainUrl: string | null | undefined,
  subUrl: string | null | undefined,
): string | null {
  if (server === 'SUB' && subUrl && subUrl.trim()) return subUrl.trim();
  return mainUrl || null;
}

interface ServerConfig {
  id: ServerType;
  name: string;
  description: string;
  features: string[];
  supportedPlatforms: ('ios' | 'android' | 'desktop')[];
}

export const SERVER_CONFIGS: Record<ServerType, ServerConfig> = {
  PLAY: {
    id: 'PLAY',
    name: 'H.Savi',
    description: 'Fast ⚡',
    features: ['HLS streaming', 'iOS optimized'],
    supportedPlatforms: ['ios', 'android', 'desktop'],
  },
  SHORT: {
    id: 'SHORT',
    name: 'SAVI.IN',
    description: 'Best for Android / PC',
    features: ['MKV/MP4 support', 'Audio switching', 'Subtitle switching'],
    supportedPlatforms: ['android', 'desktop'],
  },
  Zex: {
    id: 'Zex',
    name: 'Multi.Savi',
    description: 'Backup 🔁',
    features: ['Fallback server', 'Download support'],
    supportedPlatforms: ['ios', 'android', 'desktop'],
  },
  XPLUS: {
    id: 'XPLUS',
    name: 'AS+',
    description: 'Best Quality 🔥 (Recommended)',
    features: ['Flat controls', 'Download support', 'Subtitle support'],
    supportedPlatforms: ['ios', 'android', 'desktop'],
  },
  SUB: {
    id: 'SUB',
    name: '4K+',
    description: 'Japanese audio with subtitles',
    features: ['Japanese audio', 'Download support', 'Subtitle support'],
    supportedPlatforms: ['ios', 'android', 'desktop'],
  },
  EMBED: {
    id: 'EMBED',
    name: 'Embed',
    description: 'External Embed 🌐',
    features: ['Pure iframe', 'External hosts', 'No restrictions'],
    supportedPlatforms: ['ios', 'android', 'desktop'],
  },
};

const SERVER_PREF_KEY = 'preferred_video_server';

/**
 * Returns the list of servers available for the current device.
 * SAVI.IN (SHORT) was removed — all platforms now share the same server list.
 */
export function getAvailableServers(): ServerType[] {
  return ['PLAY', 'XPLUS', 'SUB', 'EMBED'];
}

/**
 * Returns the best default server for the current device.
 * Default: X-PLUS — most reliable, recommended.
 */
export function getDefaultServer(): ServerType {
  const saved = localStorage.getItem(SERVER_PREF_KEY) as ServerType | null;
  if (saved) {
    // Legacy SAVI.IN / Multi.Savi preferences → AS+. SUB is never a saved default.
    if (saved === 'SHORT' || saved === 'Zex') return 'XPLUS';
    if (['PLAY', 'XPLUS', 'EMBED'].includes(saved)) return saved;
  }
  return 'XPLUS';
}

interface UseServerAutoSelectOptions {
  onServerSwitch?: (from: ServerType, to: ServerType, reason: string) => void;
}

/**
 * Hook that manages server selection. All timeouts and auto-fallback are disabled.
 * Users can freely switch between any available server.
 */
export function useServerAutoSelect(options?: UseServerAutoSelectOptions) {
  const [activeServer, setActiveServer] = useState<ServerType>(() => getDefaultServer());
  const [isServerLoading, setIsServerLoading] = useState(false);
  const [failedServers, setFailedServers] = useState<Set<ServerType>>(new Set());
  const [fallbackOccurred, setFallbackOccurred] = useState(false);
  const [fallbackFrom, setFallbackFrom] = useState<ServerType | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const videoLoadedRef = useRef(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const availableServers = getAvailableServers();

  const clearLoadingState = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
    setIsServerLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
    };
  }, []);

  const switchServer = useCallback((server: ServerType) => {
    const servers = getAvailableServers();
    if (!servers.includes(server)) {
      console.warn(`Server ${server} not available on this platform`);
      return;
    }

    videoLoadedRef.current = false;
    setIsServerLoading(true);
    setFailedServers((prev) => {
      if (!prev.has(server)) return prev;
      const next = new Set(prev);
      next.delete(server);
      return next;
    });
    // SUB is chosen per title, so it never becomes the saved default for DUB anime.
    if (server !== 'SUB') localStorage.setItem(SERVER_PREF_KEY, server);

    if (server === activeServer) {
      setReloadToken((prev) => prev + 1);
    } else {
      setActiveServer(server);
    }

    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    requestAnimationFrame(() => {
      loadingTimeoutRef.current = setTimeout(() => {
        setIsServerLoading(false);
      }, 250);
    });
  }, [activeServer]);

  const onVideoLoadSuccess = useCallback(() => {
    videoLoadedRef.current = true;
    clearLoadingState();
    setFallbackOccurred(false);
    setFallbackFrom(null);
    setFailedServers((prev) => {
      if (!prev.has(activeServer)) return prev;
      const next = new Set(prev);
      next.delete(activeServer);
      return next;
    });
  }, [activeServer, clearLoadingState]);

  const onVideoLoadError = useCallback(() => {
    clearLoadingState();
    console.log(`Server ${activeServer} encountered an error`);
    setFailedServers((prev) => new Set(prev).add(activeServer));
  }, [activeServer, clearLoadingState]);

  const startFallbackTimer = useCallback(() => {
    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    videoLoadedRef.current = false;
  }, []);

  return {
    activeServer,
    isServerLoading,
    availableServers,
    failedServers,
    fallbackOccurred,
    fallbackFrom,
    reloadToken,
    switchServer,
    onVideoLoadSuccess,
    onVideoLoadError,
    startFallbackTimer,
    serverConfigs: SERVER_CONFIGS,
  };
}
