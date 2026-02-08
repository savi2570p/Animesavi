import { useState, useEffect, useCallback, useRef } from 'react';
import { isIOSDevice } from '@/lib/deviceUtils';

export type ServerType = 'PLAY' | 'SHORT' | 'Zex';

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
    name: 'PLAY',
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
    name: 'Zex',
    description: 'Backup',
    features: ['Fallback server', 'Download support'],
    supportedPlatforms: ['ios', 'android', 'desktop'],
  },
};

const AUTO_FALLBACK_TIMEOUT_MS = 3000;
const MANUAL_FALLBACK_TIMEOUT_MS = 15000; // Give manual switches much more time
const SERVER_PREF_KEY = 'preferred_video_server';

/**
 * Returns the list of servers available for the current device.
 * iOS users cannot see SAVI.IN (SHORT).
 */
export function getAvailableServers(): ServerType[] {
  const isIOS = isIOSDevice();
  if (isIOS) {
    return ['PLAY', 'Zex'];
  }
  return ['PLAY', 'SHORT', 'Zex'];
}

/**
 * Returns the best default server for the current device.
 */
export function getDefaultServer(): ServerType {
  const isIOS = isIOSDevice();
  const isMobile = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);

  // Check saved preference first
  const saved = localStorage.getItem(SERVER_PREF_KEY) as ServerType | null;
  if (saved) {
    // Don't allow iOS users to use SAVI.IN even if saved
    if (isIOS && saved === 'SHORT') {
      return 'PLAY';
    }
    if (['PLAY', 'SHORT', 'Zex'].includes(saved)) {
      return saved;
    }
  }

  // Device-based auto-select
  if (isIOS) return 'PLAY';
  if (isMobile) return 'SHORT'; // Android → SAVI.IN
  return 'SHORT'; // Desktop → SAVI.IN
}

interface UseServerAutoSelectOptions {
  onServerSwitch?: (from: ServerType, to: ServerType, reason: string) => void;
}

/**
 * Hook that manages server auto-selection with device detection and
 * automatic fallback to Zex if the primary server fails to load within 3 seconds.
 */
export function useServerAutoSelect(options?: UseServerAutoSelectOptions) {
  const [activeServer, setActiveServer] = useState<ServerType>(() => getDefaultServer());
  const [isServerLoading, setIsServerLoading] = useState(false);
  const [failedServers, setFailedServers] = useState<Set<ServerType>>(new Set());
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoLoadedRef = useRef(false);

  const availableServers = getAvailableServers();

  // Clear fallback timer
  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  /**
   * Switch to a different server manually.
   */
  const switchServer = useCallback((server: ServerType) => {
    if (server === activeServer) return;

    // Validate server is available for this platform
    if (!availableServers.includes(server)) {
      console.warn(`Server ${server} not available on this platform`);
      return;
    }

    clearFallbackTimer();
    videoLoadedRef.current = false;
    setIsServerLoading(true);
    setActiveServer(server);
    localStorage.setItem(SERVER_PREF_KEY, server);

    // Manual switches get a much longer timeout before fallback
    fallbackTimerRef.current = setTimeout(() => {
      if (!videoLoadedRef.current && server !== 'Zex') {
        console.log(`Server ${server} did not respond in ${MANUAL_FALLBACK_TIMEOUT_MS}ms after manual switch, switching to Zex`);
        setFailedServers(prev => new Set(prev).add(server));
        setActiveServer('Zex');
        setIsServerLoading(false);
        options?.onServerSwitch?.(server, 'Zex', 'timeout');
      }
    }, MANUAL_FALLBACK_TIMEOUT_MS);

    // Clear loading state after transition
    requestAnimationFrame(() => {
      setTimeout(() => {
        setIsServerLoading(false);
      }, 500);
    });
  }, [activeServer, availableServers, clearFallbackTimer, options]);

  /**
   * Call this when video has successfully started loading/playing.
   * Cancels the fallback timer.
   */
  const onVideoLoadSuccess = useCallback(() => {
    videoLoadedRef.current = true;
    clearFallbackTimer();
  }, [clearFallbackTimer]);

  /**
   * Call this when video fails to load on the current server.
   * Triggers immediate fallback to Zex.
   */
  const onVideoLoadError = useCallback(() => {
    clearFallbackTimer();
    
    if (activeServer !== 'Zex') {
      console.log(`Server ${activeServer} failed, falling back to Zex`);
      setFailedServers(prev => new Set(prev).add(activeServer));
      const previousServer = activeServer;
      setActiveServer('Zex');
      options?.onServerSwitch?.(previousServer, 'Zex', 'error');
    }
  }, [activeServer, clearFallbackTimer, options]);

  /**
   * Start the fallback timer for the current server.
   * Call this when a new video starts loading.
   */
  const startFallbackTimer = useCallback(() => {
    clearFallbackTimer();
    videoLoadedRef.current = false;

    if (activeServer === 'Zex') return; // No fallback from Zex

    fallbackTimerRef.current = setTimeout(() => {
      if (!videoLoadedRef.current) {
        console.log(`Server ${activeServer} timeout after ${AUTO_FALLBACK_TIMEOUT_MS}ms, switching to Zex`);
        setFailedServers(prev => new Set(prev).add(activeServer));
        const previousServer = activeServer;
        setActiveServer('Zex');
        options?.onServerSwitch?.(previousServer, 'Zex', 'timeout');
      }
    }, AUTO_FALLBACK_TIMEOUT_MS);
  }, [activeServer, clearFallbackTimer, options]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearFallbackTimer();
  }, [clearFallbackTimer]);

  return {
    activeServer,
    isServerLoading,
    availableServers,
    failedServers,
    switchServer,
    onVideoLoadSuccess,
    onVideoLoadError,
    startFallbackTimer,
    serverConfigs: SERVER_CONFIGS,
  };
}
