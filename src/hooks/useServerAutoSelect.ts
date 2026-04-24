import { useState, useCallback, useEffect, useRef } from 'react';
import { isIOSDevice } from '@/lib/deviceUtils';

export type ServerType = 'PLAY' | 'SHORT' | 'Zex' | 'XPLUS' | 'EMBED';

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
    name: 'X-PLUS',
    description: 'Best Quality 🔥 (Recommended)',
    features: ['Flat controls', 'Download support', 'CC support'],
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
const AUTO_SERVER_CHAIN: ServerType[] = ['PLAY', 'Zex', 'XPLUS'];

/**
 * Returns the list of servers available for the current device.
 * iOS users cannot see SAVI.IN (SHORT).
 */
export function getAvailableServers(): ServerType[] {
  const isIOS = isIOSDevice();
  if (isIOS) {
    return ['PLAY', 'Zex', 'XPLUS', 'EMBED'];
  }
  return ['PLAY', 'SHORT', 'Zex', 'XPLUS', 'EMBED'];
}

/**
 * Returns the best default server for the current device.
 * Default: X-PLUS for both Desktop and Android (and iOS) — most reliable, recommended.
 */
export function getDefaultServer(): ServerType {
  const isIOS = isIOSDevice();

  const saved = localStorage.getItem(SERVER_PREF_KEY) as ServerType | null;
  if (saved) {
    if (isIOS && saved === 'SHORT') return 'XPLUS';
    if (['PLAY', 'SHORT', 'Zex', 'XPLUS', 'EMBED'].includes(saved)) return saved;
  }

  // Default to X-PLUS for all platforms (desktop, Android, iOS).
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

  const getNextAutoServer = useCallback((server: ServerType) => {
    const servers = getAvailableServers();
    const chain = AUTO_SERVER_CHAIN.filter((candidate) => servers.includes(candidate));
    const currentIndex = chain.indexOf(server);
    return currentIndex >= 0 ? chain[currentIndex + 1] ?? null : chain[0] ?? null;
  }, []);

  const triggerAutoSwitch = useCallback((reason: string) => {
    const nextServer = getNextAutoServer(activeServer);
    if (!nextServer) return;

    setFallbackOccurred(true);
    setFallbackFrom(activeServer);
    videoLoadedRef.current = false;
    setFailedServers((prev) => new Set(prev).add(activeServer));
    setIsServerLoading(true);
    localStorage.setItem(SERVER_PREF_KEY, nextServer);
    setActiveServer(nextServer);
    options?.onServerSwitch?.(activeServer, nextServer, reason);

    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => setIsServerLoading(false), 1200);
  }, [activeServer, getNextAutoServer, options]);

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
    localStorage.setItem(SERVER_PREF_KEY, server);

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
      }, 1500);
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
    triggerAutoSwitch('error');
  }, [activeServer, clearLoadingState, triggerAutoSwitch]);

  const startFallbackTimer = useCallback(() => {
    videoLoadedRef.current = false;
    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    fallbackTimeoutRef.current = setTimeout(() => {
      if (!videoLoadedRef.current) triggerAutoSwitch('timeout');
    }, 3000);
  }, [triggerAutoSwitch]);

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
