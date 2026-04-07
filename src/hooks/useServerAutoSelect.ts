import { useState, useCallback, useRef } from 'react';
import { isIOSDevice } from '@/lib/deviceUtils';

export type ServerType = 'PLAY' | 'SHORT' | 'Zex' | 'XPLUS';

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
    description: 'Recommended for iOS',
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
    description: 'Backup',
    features: ['Fallback server', 'Download support'],
    supportedPlatforms: ['ios', 'android', 'desktop'],
  },
  XPLUS: {
    id: 'XPLUS',
    name: 'X-PLUS',
    description: 'Cinematic player',
    features: ['Flat controls', 'Download support', 'CC support'],
    supportedPlatforms: ['ios', 'android', 'desktop'],
  },
};

const SERVER_PREF_KEY = 'preferred_video_server';

/**
 * Returns the list of servers available for the current device.
 * iOS users cannot see SAVI.IN (SHORT).
 */
export function getAvailableServers(): ServerType[] {
  const isIOS = isIOSDevice();
  if (isIOS) {
    return ['PLAY', 'Zex', 'XPLUS'];
  }
  return ['PLAY', 'SHORT', 'Zex', 'XPLUS'];
}

/**
 * Returns the best default server for the current device.
 */
export function getDefaultServer(): ServerType {
  const isIOS = isIOSDevice();
  const isMobile = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);

  const saved = localStorage.getItem(SERVER_PREF_KEY) as ServerType | null;
  if (saved) {
    if (isIOS && saved === 'SHORT') return 'PLAY';
    if (['PLAY', 'SHORT', 'Zex', 'XPLUS'].includes(saved)) return saved;
  }

  if (isIOS) return 'PLAY';
  if (isMobile) return 'SHORT';
  return 'SHORT';
}

interface UseServerAutoSelectOptions {
  onServerSwitch?: (from: ServerType, to: ServerType, reason: string) => void;
}

/**
 * Hook that manages server selection. All timeouts and auto-fallback are disabled.
 * Users can freely switch between any available server.
 */
export function useServerAutoSelect(_options?: UseServerAutoSelectOptions) {
  const [activeServer, setActiveServer] = useState<ServerType>(() => getDefaultServer());
  const [isServerLoading, setIsServerLoading] = useState(false);
  const [failedServers] = useState<Set<ServerType>>(new Set());
  const [fallbackOccurred] = useState(false);
  const [fallbackFrom] = useState<ServerType | null>(null);
  const videoLoadedRef = useRef(false);

  const availableServers = getAvailableServers();

  const switchServer = useCallback((server: ServerType) => {
    if (server === activeServer) return;
    const servers = getAvailableServers();
    if (!servers.includes(server)) {
      console.warn(`Server ${server} not available on this platform`);
      return;
    }
    videoLoadedRef.current = false;
    setIsServerLoading(true);
    setActiveServer(server);
    localStorage.setItem(SERVER_PREF_KEY, server);
    requestAnimationFrame(() => {
      setTimeout(() => setIsServerLoading(false), 500);
    });
  }, [activeServer]);

  const onVideoLoadSuccess = useCallback(() => {
    videoLoadedRef.current = true;
  }, []);

  const onVideoLoadError = useCallback(() => {
    console.log(`Server ${activeServer} encountered an error`);
  }, [activeServer]);

  const startFallbackTimer = useCallback(() => {
    videoLoadedRef.current = false;
  }, []);

  return {
    activeServer,
    isServerLoading,
    availableServers,
    failedServers,
    fallbackOccurred,
    fallbackFrom,
    switchServer,
    onVideoLoadSuccess,
    onVideoLoadError,
    startFallbackTimer,
    serverConfigs: SERVER_CONFIGS,
  };
}
