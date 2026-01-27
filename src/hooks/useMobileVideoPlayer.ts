/**
 * Mobile-Optimized Video Player Hook
 * 
 * Handles cross-platform video playback with:
 * - HLS.js for adaptive streaming
 * - Mobile-specific optimizations (iOS Safari, Android Chrome)
 * - Format detection and unsupported format warnings
 * - Network-aware buffering
 * - Error handling with fallback logic
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';

// Video formats that work on mobile browsers natively
const MOBILE_SUPPORTED_EXTENSIONS = ['.mp4', '.webm', '.m4v', '.ogg', '.ogv'];

// Formats that DON'T work on mobile browsers (require server-side conversion)
const UNSUPPORTED_MOBILE_FORMATS = ['.mkv', '.avi', '.wmv', '.flv', '.mov', '.mp4v', '.divx', '.xvid'];

export interface VideoPlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  progress: number;
  bufferedProgress: number;
  error: string | null;
  isUnsupportedFormat: boolean;
  formatWarning: string | null;
  hlsLevels: HlsQualityLevel[];
  currentLevel: number;
  isHlsActive: boolean;
}

export interface HlsQualityLevel {
  id: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
}

export interface UseMobileVideoPlayerOptions {
  videoUrl: string | null;
  autoPlay?: boolean;
  startTime?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
  onPlay?: () => void;
  onPause?: () => void;
}

export interface UseMobileVideoPlayerReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  state: VideoPlaybackState;
  controls: {
    play: () => Promise<void>;
    pause: () => void;
    togglePlay: () => Promise<void>;
    seek: (time: number) => void;
    seekPercent: (percent: number) => void;
    setVolume: (volume: number) => void;
    toggleMute: () => void;
    setQualityLevel: (levelId: number) => void;
    retry: () => void;
  };
  hlsRef: React.RefObject<Hls | null>;
}

// Detect device/browser type
export function detectDeviceInfo() {
  if (typeof window === 'undefined') {
    return { isMobile: false, isIOS: false, isAndroid: false, isSafari: false };
  }
  
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || isAndroid || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  
  return { isMobile, isIOS, isAndroid, isSafari };
}

// Detect video format from URL
export function detectVideoFormat(url: string | null): {
  extension: string;
  isHLS: boolean;
  isNativeSupported: boolean;
  isUnsupported: boolean;
  formatName: string;
} {
  if (!url) {
    return { extension: '', isHLS: false, isNativeSupported: false, isUnsupported: false, formatName: '' };
  }

  const urlLower = url.toLowerCase().split('?')[0];
  
  // Check for HLS
  if (urlLower.includes('.m3u8')) {
    return { extension: '.m3u8', isHLS: true, isNativeSupported: true, isUnsupported: false, formatName: 'HLS' };
  }
  
  // Extract extension
  const match = urlLower.match(/\.([a-z0-9]+)$/);
  const extension = match ? `.${match[1]}` : '';
  
  // Check if it's a supported format
  const isNativeSupported = MOBILE_SUPPORTED_EXTENSIONS.includes(extension);
  const isUnsupported = UNSUPPORTED_MOBILE_FORMATS.includes(extension);
  const formatName = extension.replace('.', '').toUpperCase() || 'Unknown';
  
  return { extension, isHLS: false, isNativeSupported, isUnsupported, formatName };
}

// Get network info for adaptive buffering
function getNetworkInfo() {
  const connection = (navigator as any).connection;
  if (!connection) {
    return { effectiveType: '4g', isSlowNetwork: false, saveData: false };
  }
  
  const effectiveType = connection.effectiveType || '4g';
  const isSlowNetwork = ['slow-2g', '2g', '3g'].includes(effectiveType);
  const saveData = connection.saveData || false;
  
  return { effectiveType, isSlowNetwork, saveData };
}

// Get mobile-optimized HLS config
function getMobileHlsConfig(isMobile: boolean, isSlowNetwork: boolean) {
  return {
    enableWorker: true,
    lowLatencyMode: false, // Disable for mobile compatibility
    
    // Buffer settings - conservative for mobile
    maxBufferLength: isMobile ? 15 : 30,
    maxMaxBufferLength: isMobile ? 45 : 120,
    maxBufferSize: isMobile ? 30 * 1000 * 1000 : 60 * 1000 * 1000,
    maxBufferHole: 0.5,
    
    // Start level - lower for mobile/slow networks
    startLevel: isMobile || isSlowNetwork ? 0 : -1,
    autoStartLoad: true,
    
    // ABR settings
    abrEwmaDefaultEstimate: isSlowNetwork ? 500000 : 2000000,
    abrBandWidthFactor: isMobile ? 0.7 : 0.8,
    abrBandWidthUpFactor: isMobile ? 0.5 : 0.7,
    
    // Back buffer
    backBufferLength: isMobile ? 15 : 30,
    
    // Fragment loading - more tolerant for mobile
    fragLoadingTimeOut: isMobile ? 30000 : 20000,
    fragLoadingMaxRetry: isMobile ? 8 : 4,
    fragLoadingRetryDelay: isMobile ? 1500 : 1000,
    
    // Level loading
    levelLoadingTimeOut: isMobile ? 20000 : 10000,
    levelLoadingMaxRetry: isMobile ? 6 : 4,
    levelLoadingRetryDelay: isMobile ? 1500 : 1000,
    
    // Manifest loading
    manifestLoadingTimeOut: isMobile ? 20000 : 10000,
    manifestLoadingMaxRetry: isMobile ? 6 : 3,
    manifestLoadingRetryDelay: isMobile ? 2000 : 1000,
    
    // XHR setup - prevent CORS issues
    xhrSetup: (xhr: XMLHttpRequest) => {
      xhr.withCredentials = false;
    },
    
    // Mobile optimizations
    progressive: isMobile,
    capLevelToPlayerSize: isMobile,
  };
}

// Get quality label from resolution
function getQualityLabel(height: number, bitrate: number): string {
  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  if (height >= 240) return '240p';
  return `${height}p`;
}

export function useMobileVideoPlayer(options: UseMobileVideoPlayerOptions): UseMobileVideoPlayerReturn {
  const {
    videoUrl,
    autoPlay = true,
    startTime = 0,
    onTimeUpdate,
    onEnded,
    onError,
    onPlay,
    onPause,
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;

  const [state, setState] = useState<VideoPlaybackState>({
    isPlaying: false,
    isLoading: true,
    isBuffering: false,
    isMuted: false,
    volume: 1,
    currentTime: 0,
    duration: 0,
    progress: 0,
    bufferedProgress: 0,
    error: null,
    isUnsupportedFormat: false,
    formatWarning: null,
    hlsLevels: [],
    currentLevel: -1,
    isHlsActive: false,
  });

  // Detect format and device
  const deviceInfo = detectDeviceInfo();
  const formatInfo = detectVideoFormat(videoUrl);
  const networkInfo = getNetworkInfo();

  // Update state helper
  const updateState = useCallback((updates: Partial<VideoPlaybackState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Initialize video playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) {
      updateState({ isLoading: false, error: 'No video URL provided' });
      return;
    }

    // Reset state
    updateState({
      isLoading: true,
      error: null,
      isUnsupportedFormat: false,
      formatWarning: null,
      hlsLevels: [],
      currentLevel: -1,
      isHlsActive: false,
    });

    // Check for unsupported formats on mobile
    if (deviceInfo.isMobile && formatInfo.isUnsupported) {
      const warning = `⚠️ ${formatInfo.formatName} format is not supported on mobile browsers. The video needs to be converted to MP4 (H.264) or HLS (.m3u8) for mobile playback.`;
      updateState({
        isLoading: false,
        isUnsupportedFormat: true,
        formatWarning: warning,
        error: warning,
      });
      onError?.(warning);
      return;
    }

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Setup video based on format
    if (formatInfo.isHLS) {
      setupHlsPlayback(video);
    } else {
      setupNativePlayback(video);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoUrl]);

  // Setup HLS playback
  const setupHlsPlayback = useCallback((video: HTMLVideoElement) => {
    if (!videoUrl) return;

    // Check for native HLS support (Safari/iOS)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('[VideoPlayer] Using native HLS support (Safari/iOS)');
      video.src = videoUrl;
      
      video.addEventListener('loadedmetadata', () => {
        updateState({ isLoading: false, duration: video.duration });
        if (startTime > 0) video.currentTime = startTime;
        if (autoPlay) {
          attemptAutoplay(video);
        }
      });
      
      video.addEventListener('error', () => {
        handleVideoError('Native HLS playback failed');
      });
      
      return;
    }

    // Use HLS.js for other browsers
    if (!Hls.isSupported()) {
      updateState({ isLoading: false, error: 'HLS is not supported in this browser' });
      return;
    }

    console.log('[VideoPlayer] Using HLS.js for playback');
    const hlsConfig = getMobileHlsConfig(deviceInfo.isMobile, networkInfo.isSlowNetwork);
    const hls = new Hls(hlsConfig);
    hlsRef.current = hls;

    hls.loadSource(videoUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      console.log('[VideoPlayer] HLS manifest parsed:', data.levels?.length, 'quality levels');
      
      // Extract quality levels
      if (data.levels && data.levels.length > 0) {
        const levels: HlsQualityLevel[] = data.levels.map((level, index) => ({
          id: index,
          height: level.height,
          width: level.width,
          bitrate: level.bitrate,
          label: getQualityLabel(level.height, level.bitrate),
        }));
        levels.sort((a, b) => b.height - a.height);
        updateState({ hlsLevels: levels, isHlsActive: true });
      }

      updateState({ isLoading: false, duration: video.duration || 0 });
      if (startTime > 0) video.currentTime = startTime;
      if (autoPlay) {
        attemptAutoplay(video);
      }
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
      updateState({ currentLevel: data.level });
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      console.error('[VideoPlayer] HLS error:', data.type, data.details, data.fatal);
      
      if (data.fatal) {
        handleHlsError(hls, data);
      }
    });

    hls.on(Hls.Events.FRAG_LOADED, () => {
      retryCountRef.current = 0; // Reset retry count on success
    });
  }, [videoUrl, startTime, autoPlay, deviceInfo, networkInfo]);

  // Setup native video playback (MP4, WebM, etc.)
  const setupNativePlayback = useCallback((video: HTMLVideoElement) => {
    if (!videoUrl) return;

    console.log('[VideoPlayer] Using native video playback for:', formatInfo.extension || 'direct URL');
    video.src = videoUrl;

    video.addEventListener('loadedmetadata', () => {
      updateState({ isLoading: false, duration: video.duration });
      if (startTime > 0) video.currentTime = startTime;
      if (autoPlay) {
        attemptAutoplay(video);
      }
    });

    video.addEventListener('error', (e) => {
      const error = video.error;
      let errorMessage = 'Video playback failed';
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Video playback was aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading video';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Video decode error - format may not be supported';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Video format not supported on this device';
            break;
        }
      }
      
      handleVideoError(errorMessage);
    });
  }, [videoUrl, startTime, autoPlay, formatInfo]);

  // Attempt autoplay with muted fallback
  const attemptAutoplay = useCallback(async (video: HTMLVideoElement) => {
    try {
      await video.play();
      updateState({ isPlaying: true, isMuted: video.muted });
    } catch (error) {
      console.log('[VideoPlayer] Autoplay blocked, trying muted:', error);
      
      // Try muted autoplay (required on most mobile browsers)
      video.muted = true;
      try {
        await video.play();
        updateState({ isPlaying: true, isMuted: true });
      } catch (mutedError) {
        console.warn('[VideoPlayer] Even muted autoplay failed:', mutedError);
        updateState({ isPlaying: false });
      }
    }
  }, []);

  // Handle HLS errors with retry logic
  const handleHlsError = useCallback((hls: Hls, data: any) => {
    retryCountRef.current++;
    
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
      console.log(`[VideoPlayer] Network error, retry ${retryCountRef.current}/${MAX_RETRIES}`);
      
      if (retryCountRef.current <= MAX_RETRIES) {
        const delay = Math.min(1000 * retryCountRef.current, 5000);
        setTimeout(() => {
          if (hlsRef.current) {
            hls.startLoad();
          }
        }, delay);
      } else {
        updateState({ error: 'Network error - please check your connection and try again' });
        onError?.('Network error');
      }
    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
      console.log('[VideoPlayer] Media error, attempting recovery...');
      hls.recoverMediaError();
    } else {
      updateState({ error: 'Video playback error - please try a different server' });
      onError?.('Playback error');
    }
  }, [onError]);

  // Handle native video errors
  const handleVideoError = useCallback((message: string) => {
    console.error('[VideoPlayer] Video error:', message);
    updateState({ isLoading: false, error: message });
    onError?.(message);
  }, [onError]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      updateState({ isPlaying: true });
      onPlay?.();
    };

    const handlePause = () => {
      updateState({ isPlaying: false });
      onPause?.();
    };

    const handleTimeUpdate = () => {
      const current = video.currentTime;
      const dur = video.duration || 0;
      const progress = dur > 0 ? (current / dur) * 100 : 0;
      
      updateState({ currentTime: current, duration: dur, progress });
      onTimeUpdate?.(current, dur);
    };

    const handleWaiting = () => updateState({ isBuffering: true });
    const handleCanPlay = () => updateState({ isBuffering: false, isLoading: false });
    const handleEnded = () => {
      updateState({ isPlaying: false });
      onEnded?.();
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const dur = video.duration || 1;
        updateState({ bufferedProgress: (bufferedEnd / dur) * 100 });
      }
    };

    const handleLoadedMetadata = () => {
      updateState({ duration: video.duration, isLoading: false });
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [onTimeUpdate, onEnded, onPlay, onPause]);

  // Controls
  const controls = {
    play: async () => {
      const video = videoRef.current;
      if (!video) return;
      
      try {
        await video.play();
        updateState({ isPlaying: true });
      } catch (error) {
        console.error('[VideoPlayer] Play failed:', error);
      }
    },

    pause: () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        updateState({ isPlaying: false });
      }
    },

    togglePlay: async () => {
      const video = videoRef.current;
      if (!video) return;
      
      if (video.paused) {
        await controls.play();
      } else {
        controls.pause();
      }
    },

    seek: (time: number) => {
      const video = videoRef.current;
      if (video) {
        video.currentTime = Math.max(0, Math.min(time, video.duration || 0));
      }
    },

    seekPercent: (percent: number) => {
      const video = videoRef.current;
      if (video && video.duration) {
        video.currentTime = (percent / 100) * video.duration;
      }
    },

    setVolume: (volume: number) => {
      const video = videoRef.current;
      if (video) {
        video.volume = Math.max(0, Math.min(1, volume));
        video.muted = volume === 0;
        updateState({ volume, isMuted: volume === 0 });
      }
    },

    toggleMute: () => {
      const video = videoRef.current;
      if (video) {
        video.muted = !video.muted;
        updateState({ isMuted: video.muted });
      }
    },

    setQualityLevel: (levelId: number) => {
      const hls = hlsRef.current;
      if (hls) {
        hls.currentLevel = levelId; // -1 for auto
        updateState({ currentLevel: levelId });
      }
    },

    retry: () => {
      retryCountRef.current = 0;
      const video = videoRef.current;
      if (video && videoUrl) {
        updateState({ error: null, isLoading: true });
        
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        
        // Re-trigger setup
        video.src = '';
        video.load();
        
        setTimeout(() => {
          if (formatInfo.isHLS) {
            setupHlsPlayback(video);
          } else {
            setupNativePlayback(video);
          }
        }, 100);
      }
    },
  };

  return {
    videoRef,
    state,
    controls,
    hlsRef,
  };
}
