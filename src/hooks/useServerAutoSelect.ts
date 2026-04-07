import { useState, useEffect, useCallback, useRef } from 'react';
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

// All server timeouts and auto-switching are fully disabled.
// Users can freely choose any server without being forced to switch.

function isDesktopDevice(): boolean {
  if (typeof window === 'undefined') return true;
  return !/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
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

  // Check saved preference first
  const saved = localStorage.getItem(SERVER_PREF_KEY) as ServerType | null;
  if (saved) {
    // Don't allow iOS users to use SAVI.IN even if saved
    if (isIOS && saved === 'SHORT') {
      return 'PLAY';
    }
    if (['PLAY', 'SHORT', 'Zex', 'XPLUS'].includes(saved)) {
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
  const [failedServers] = useState<Set<ServerType>>(new Set());
  const [fallbackOccurred] = useState(false);
  const [fallbackFrom] = useState<ServerType | null>(null);
  const videoLoadedRef = useRef(false);

  /**
   * Switch to a different server manually. No timeouts or auto-fallback.
   */
  const switchServer = useCallback((server: ServerType) => {
    if (server === activeServer) return;

    // Validate server is available for this platform
    if (!availableServers.includes(server)) {
      console.warn(`Server ${server} not available on this platform`);
      return;
    }

    videoLoadedRef.current = false;
    setIsServerLoading(true);
    setActiveServer(server);
    localStorage.setItem(SERVER_PREF_KEY, server);

    // Clear loading state after brief transition
    requestAnimationFrame(() => {
      setTimeout(() => setIsServerLoading(false), 500);
    });
  }, [activeServer, availableServers]);

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
   * No auto-fallback — user stays on their chosen server.
   */
  const onVideoLoadError = useCallback(() => {
    console.log(`Server ${activeServer} encountered an error`);
  }, [activeServer]);

  /**
   * No-op. Fallback timers are fully disabled.
   */
  const startFallbackTimer = useCallback(() => {
    videoLoadedRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearFallbackTimer();
  }, [clearFallbackTimer]);

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
