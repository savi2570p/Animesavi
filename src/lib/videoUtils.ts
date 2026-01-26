/**
 * Video Utilities for Mobile-Friendly Playback
 * Handles format detection, compatibility checks, and mobile-specific optimizations
 */

// Supported formats for HTML5 native playback
const NATIVE_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.ogv', '.m4v'];

// Formats that require conversion or special handling
const CONVERSION_REQUIRED_EXTENSIONS = ['.mkv', '.avi', '.mov', '.wmv', '.flv', '.mp4v'];

// HLS streaming extension
const HLS_EXTENSION = '.m3u8';

// DASH streaming extension  
const DASH_EXTENSION = '.mpd';

export interface VideoFormatInfo {
  isSupported: boolean;
  isHLS: boolean;
  isDASH: boolean;
  requiresConversion: boolean;
  extension: string;
  mimeType: string;
  playbackMethod: 'native' | 'hls' | 'dash' | 'iframe' | 'unsupported';
}

/**
 * Detects video format and compatibility from URL
 */
export function detectVideoFormat(url: string | null): VideoFormatInfo {
  if (!url) {
    return {
      isSupported: false,
      isHLS: false,
      isDASH: false,
      requiresConversion: false,
      extension: '',
      mimeType: '',
      playbackMethod: 'unsupported',
    };
  }

  // Extract extension from URL (handle query params)
  const urlWithoutQuery = url.split('?')[0].toLowerCase();
  const extension = '.' + (urlWithoutQuery.split('.').pop() || '');

  // Check for HLS
  if (url.includes('.m3u8')) {
    return {
      isSupported: true,
      isHLS: true,
      isDASH: false,
      requiresConversion: false,
      extension: HLS_EXTENSION,
      mimeType: 'application/x-mpegURL',
      playbackMethod: 'hls',
    };
  }

  // Check for DASH
  if (url.includes('.mpd')) {
    return {
      isSupported: true,
      isHLS: false,
      isDASH: true,
      requiresConversion: false,
      extension: DASH_EXTENSION,
      mimeType: 'application/dash+xml',
      playbackMethod: 'dash',
    };
  }

  // Check for native formats
  if (NATIVE_VIDEO_EXTENSIONS.includes(extension)) {
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.ogv': 'video/ogg',
      '.m4v': 'video/mp4',
    };
    return {
      isSupported: true,
      isHLS: false,
      isDASH: false,
      requiresConversion: false,
      extension,
      mimeType: mimeTypes[extension] || 'video/mp4',
      playbackMethod: 'native',
    };
  }

  // Check for formats needing conversion
  if (CONVERSION_REQUIRED_EXTENSIONS.includes(extension)) {
    return {
      isSupported: false,
      isHLS: false,
      isDASH: false,
      requiresConversion: true,
      extension,
      mimeType: '',
      playbackMethod: 'unsupported',
    };
  }

  // Default: try native playback (might be a CDN URL without extension)
  return {
    isSupported: true,
    isHLS: false,
    isDASH: false,
    requiresConversion: false,
    extension: '',
    mimeType: 'video/mp4',
    playbackMethod: 'native',
  };
}

/**
 * Checks if the current device/browser is mobile
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Checks if the device is iOS
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Checks if the device is Android
 */
export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
}

/**
 * Gets network connection info for adaptive streaming
 */
export function getNetworkInfo(): {
  effectiveType: string;
  isSlowNetwork: boolean;
  isCellular: boolean;
  saveData: boolean;
} {
  const connection = (navigator as any).connection;
  
  if (!connection) {
    return {
      effectiveType: '4g',
      isSlowNetwork: false,
      isCellular: false,
      saveData: false,
    };
  }

  const effectiveType = connection.effectiveType || '4g';
  const isSlowNetwork = ['slow-2g', '2g', '3g'].includes(effectiveType) || connection.saveData;
  const isCellular = connection.type === 'cellular';
  
  return {
    effectiveType,
    isSlowNetwork,
    isCellular,
    saveData: connection.saveData || false,
  };
}

/**
 * Gets optimal video attributes for mobile playback
 */
export function getMobileVideoAttributes(): Record<string, string | boolean> {
  const isMobile = isMobileDevice();
  const isIOS = isIOSDevice();
  
  return {
    // Critical for iOS inline playback
    playsInline: true,
    'webkit-playsinline': 'true',
    
    // iOS AirPlay support
    'x-webkit-airplay': 'allow',
    
    // Android/UC Browser/QQ Browser specific
    'x5-video-player-type': 'h5-page',
    'x5-video-player-fullscreen': 'true',
    'x5-video-orientation': 'landscape',
    
    // Preload strategy - metadata is best for mobile
    preload: isMobile ? 'metadata' : 'auto',
    
    // Disable controls initially (we use custom controls)
    controls: false,
    
    // For autoplay on mobile, video must start muted
    // We'll unmute after user interaction
    muted: isMobile,
    autoPlay: true,
  };
}

/**
 * Gets optimized HLS.js config for the current device/network
 */
export function getHLSConfig() {
  const { isSlowNetwork, isCellular } = getNetworkInfo();
  const isMobile = isMobileDevice();
  
  return {
    enableWorker: true,
    lowLatencyMode: false, // Disable for better mobile compatibility
    
    // Buffer settings - more conservative on mobile
    maxBufferLength: isMobile ? 15 : 30,
    maxMaxBufferLength: isMobile ? 60 : 120,
    maxBufferSize: isMobile ? 60 * 1000 * 1000 : 120 * 1000 * 1000,
    maxBufferHole: 0.5,
    
    // Start with lower quality for faster startup on mobile
    startLevel: isMobile || isSlowNetwork ? 0 : -1,
    autoStartLoad: true,
    
    // ABR (Adaptive Bitrate) settings
    abrEwmaDefaultEstimate: isSlowNetwork ? 500000 : (isCellular ? 1500000 : 3000000),
    abrBandWidthFactor: isMobile ? 0.7 : 0.8,
    abrBandWidthUpFactor: isMobile ? 0.5 : 0.6,
    
    // Back buffer for seeking
    backBufferLength: isMobile ? 15 : 30,
    
    // Fragment loading - more tolerant timeouts for mobile
    fragLoadingTimeOut: isMobile ? 30000 : 20000,
    fragLoadingMaxRetry: isMobile ? 8 : 6,
    fragLoadingRetryDelay: isMobile ? 1500 : 1000,
    
    // Level loading
    levelLoadingTimeOut: isMobile ? 15000 : 10000,
    levelLoadingMaxRetry: isMobile ? 6 : 4,
    levelLoadingRetryDelay: isMobile ? 1500 : 1000,
    
    // Manifest loading
    manifestLoadingTimeOut: isMobile ? 15000 : 10000,
    manifestLoadingMaxRetry: isMobile ? 6 : 4,
    manifestLoadingRetryDelay: isMobile ? 1500 : 1000,
    
    // XHR setup - important for CORS and mobile compatibility
    xhrSetup: (xhr: XMLHttpRequest) => {
      xhr.withCredentials = false;
    },
  };
}

/**
 * Attempts to play video with mobile autoplay handling
 * Returns true if playback started successfully
 */
export async function attemptVideoPlay(
  video: HTMLVideoElement,
  options: { unmute?: boolean } = {}
): Promise<boolean> {
  const isMobile = isMobileDevice();
  
  try {
    // First try: play with current settings
    await video.play();
    
    // If we want to unmute after successful play and was muted for autoplay
    if (options.unmute && video.muted && isMobile) {
      // Unmute after a small delay to ensure playback started
      setTimeout(() => {
        video.muted = false;
      }, 100);
    }
    
    return true;
  } catch (error) {
    console.warn('Initial play failed, trying muted:', error);
    
    // Second try: force muted for autoplay policy compliance
    if (!video.muted) {
      video.muted = true;
      try {
        await video.play();
        console.log('Muted autoplay succeeded');
        return true;
      } catch (mutedError) {
        console.error('Even muted play failed:', mutedError);
        return false;
      }
    }
    
    return false;
  }
}

/**
 * Checks if a video URL is likely to be playable
 */
export function isPlayableVideoUrl(url: string | null): boolean {
  if (!url) return false;
  
  const format = detectVideoFormat(url);
  return format.isSupported || format.isHLS || format.isDASH;
}

/**
 * Gets the message for unsupported video formats
 */
export function getUnsupportedFormatMessage(url: string | null): string {
  if (!url) return 'No video URL provided';
  
  const format = detectVideoFormat(url);
  
  if (format.requiresConversion) {
    const formatName = format.extension.replace('.', '').toUpperCase();
    return `${formatName} format requires server-side conversion. Please convert to MP4 (H.264) or use HLS streaming for mobile compatibility.`;
  }
  
  return 'This video format may not be playable on all devices.';
}

/**
 * Formats bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formats bitrate to human readable string
 */
export function formatBitrate(bps: number): string {
  if (bps >= 1000000) {
    return (bps / 1000000).toFixed(1) + ' Mbps';
  }
  return Math.round(bps / 1000) + ' kbps';
}
