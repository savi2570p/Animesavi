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

// Get optimized HLS config for FASTEST playback start
function getMobileHlsConfig(isMobile: boolean, isSlowNetwork: boolean) {
  return {
    enableWorker: true,
    lowLatencyMode: true, // Enable for faster start
    
    // CRITICAL: Minimal initial buffer for instant playback
    maxBufferLength: 10, // Reduced from 15/30 - start playing sooner
    maxMaxBufferLength: isMobile ? 30 : 60, // Reduced max buffer
    maxBufferSize: isMobile ? 20 * 1000 * 1000 : 40 * 1000 * 1000,
    maxBufferHole: 0.3, // Smaller buffer hole tolerance
    
    // FASTEST START: Always start at lowest quality for instant playback
    startLevel: 0, // Always start at lowest quality for fastest start
    autoStartLoad: true,
    startPosition: -1, // Start from beginning
    
    // ABR - aggressive upscaling once playback starts
    abrEwmaDefaultEstimate: isSlowNetwork ? 500000 : 1500000,
    abrBandWidthFactor: 0.9, // More aggressive bandwidth usage
    abrBandWidthUpFactor: 0.8, // Faster quality upscaling
    abrMaxWithRealBitrate: true,
    
    // Minimal back buffer - save memory, faster seeking
    backBufferLength: 5,
    
    // FAST fragment loading with quick timeouts
    fragLoadingTimeOut: 8000, // Reduced from 20-30s
    fragLoadingMaxRetry: 3, // Quick retries
    fragLoadingRetryDelay: 500, // Fast retry
    
    // Fast level loading
    levelLoadingTimeOut: 6000, // Reduced from 10-20s
    levelLoadingMaxRetry: 3,
    levelLoadingRetryDelay: 500,
    
    // Fast manifest loading - CRITICAL for initial start
    manifestLoadingTimeOut: 5000, // Reduced from 10-20s
    manifestLoadingMaxRetry: 2,
    manifestLoadingRetryDelay: 300,
    
    // XHR setup - prevent CORS issues
    xhrSetup: (xhr: XMLHttpRequest) => {
      xhr.withCredentials = false;
    },
    
    // Optimizations for fast start
    progressive: true, // Always progressive for faster initial segment
    capLevelToPlayerSize: isMobile, // Only cap on mobile
    testBandwidth: false, // Skip bandwidth test for faster start
    initialLiveManifestSize: 1, // Minimal initial manifest fetch
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

  // Attempt autoplay - start muted for guaranteed playback on mobile
  const attemptAutoplay = useCallback(async (video: HTMLVideoElement) => {
    // CRITICAL: Start muted for instant, guaranteed playback on mobile
    video.muted = true;
    
    try {
      await video.play();
      updateState({ isPlaying: true, isMuted: true });
      console.log('[VideoPlayer] Autoplay started (muted for compatibility)');
      
      // Try to unmute after a short delay (some browsers allow this)
      setTimeout(() => {
        if (video && !video.paused) {
          video.muted = false;
          updateState({ isMuted: false });
          console.log('[VideoPlayer] Unmuted successfully');
        }
      }, 100);
    } catch (error) {
      console.warn('[VideoPlayer] Even muted autoplay failed:', error);
      updateState({ isPlaying: false, isMuted: true });
    }
  }, [updateState]);

  // Handle video errors
  const handleVideoError = useCallback((message: string) => {
    console.error('[VideoPlayer] Video error:', message);
    updateState({ isLoading: false, error: message });
    onError?.(message);
  }, [onError, updateState]);

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
  }, [onError, updateState]);

  // Setup HLS playback - optimized for fastest start
  const setupHlsPlayback = useCallback((video: HTMLVideoElement) => {
    if (!videoUrl) return;

    // CRITICAL: Start muted for instant playback
    video.muted = true;

    // Check for native HLS support (Safari/iOS)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('[VideoPlayer] Using native HLS support (Safari/iOS)');
      video.src = videoUrl;
      video.preload = 'auto';
      
      video.addEventListener('loadedmetadata', () => {
        updateState({ isLoading: false, duration: video.duration });
        if (startTime > 0) video.currentTime = startTime;
        attemptAutoplay(video);
      }, { once: true });
      
      // Also try to play immediately on canplay
      video.addEventListener('canplay', () => {
        if (video.paused && autoPlay) {
          attemptAutoplay(video);
        }
      }, { once: true });
      
      video.addEventListener('error', () => {
        handleVideoError('Native HLS playback failed');
      }, { once: true });
      
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

    // Start playback as soon as first fragment is loaded
    hls.on(Hls.Events.FRAG_LOADED, () => {
      retryCountRef.current = 0;
      if (video.paused && autoPlay) {
        attemptAutoplay(video);
      }
    });

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
      
      // Immediate autoplay attempt
      attemptAutoplay(video);
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
  }, [videoUrl, startTime, autoPlay, deviceInfo, networkInfo, attemptAutoplay, handleVideoError, handleHlsError, updateState]);

  // Setup native video playback (MP4, WebM, etc.)
  const setupNativePlayback = useCallback((video: HTMLVideoElement) => {
    if (!videoUrl) return;

    // Start muted for instant playback
    video.muted = true;
    video.preload = 'auto';

    console.log('[VideoPlayer] Using native video playback for:', formatInfo.extension || 'direct URL');
    video.src = videoUrl;

    video.addEventListener('loadedmetadata', () => {
      updateState({ isLoading: false, duration: video.duration });
      if (startTime > 0) video.currentTime = startTime;
      attemptAutoplay(video);
    }, { once: true });

    // Also try on canplay for faster start
    video.addEventListener('canplay', () => {
      if (video.paused && autoPlay) {
        attemptAutoplay(video);
      }
    }, { once: true });

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
    }, { once: true });
  }, [videoUrl, startTime, autoPlay, formatInfo, attemptAutoplay, handleVideoError, updateState]);

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
