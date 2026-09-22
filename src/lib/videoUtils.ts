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
 * Video codecs in order of preference. Modern codecs (AV1 / HEVC) deliver the
 * same true 4K at a fraction of the bytes; H.264 stays as universal fallback.
 */
export function getPreferredVideoCodecs(): string[] {
  const supports = (mime: string) => {
    try {
      const MS: any = (window as any).ManagedMediaSource || (window as any).MediaSource;
      return !!MS?.isTypeSupported?.(mime);
    } catch {
      return false;
    }
  };
  const codecs: string[] = [];
  if (supports('video/mp4; codecs="av01.0.08M.08"')) codecs.push('av01');
  if (supports('video/mp4; codecs="hvc1.1.6.L153.B0"') || supports('video/mp4; codecs="hev1.1.6.L153.B0"')) {
    codecs.push('hvc1', 'hev1');
  }
  codecs.push('avc1');
  return codecs;
}

/**
 * Gets data-efficient HLS.js config for the current device/network.
 * Keeps full 4K renditions available while only fetching segments playback needs.
 */
export function getHLSConfig() {
  const { isSlowNetwork, isCellular, saveData } = getNetworkInfo() as any;
  const isMobile = isMobileDevice();
  const slow = isSlowNetwork || saveData;

  return {
    enableWorker: true,
    lowLatencyMode: false, // VoD: avoids partial-segment/duplicate requests

    // Buffer only what playback needs (prevents downloading far-ahead 4K segments)
    maxBufferLength: slow ? 8 : isMobile ? 10 : 16,
    maxMaxBufferLength: slow ? 20 : isMobile ? 24 : 40,
    maxBufferSize: slow ? 16 * 1000 * 1000 : isMobile ? 24 * 1000 * 1000 : 48 * 1000 * 1000,
    maxBufferHole: 0.5,

    // Start low for fast first frame; ABR ramps up to 4K
    startLevel: 0,
    autoStartLoad: true,

    // ABR tuned to avoid overshoot (overshoot = discarded downloads)
    abrEwmaDefaultEstimate: slow ? 500000 : (isCellular ? 4000000 : 10000000),
    abrEwmaFastVoD: 3,
    abrEwmaSlowVoD: 9,
    abrBandWidthFactor: isMobile ? 0.8 : 0.9,
    abrBandWidthUpFactor: isMobile ? 0.6 : 0.75,
    abrMaxWithRealBitrate: true,

    // Discard already-played data
    backBufferLength: isMobile ? 10 : 20,

    // 4K segments are large: generous timeouts prevent wasteful re-downloads
    fragLoadingTimeOut: isMobile ? 30000 : 20000,
    fragLoadingMaxRetry: 4,
    fragLoadingRetryDelay: 600,

    levelLoadingTimeOut: isMobile ? 15000 : 10000,
    levelLoadingMaxRetry: 4,
    levelLoadingRetryDelay: 800,

    manifestLoadingTimeOut: isMobile ? 15000 : 10000,
    manifestLoadingMaxRetry: 3,
    manifestLoadingRetryDelay: 800,

    progressive: false,
    capLevelToPlayerSize: false,
    ignoreDevicePixelRatio: true,
    videoPreference: { allowedVideoCodecs: getPreferredVideoCodecs() } as any,

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
