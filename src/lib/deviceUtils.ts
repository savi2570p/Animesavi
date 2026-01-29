// Device detection utilities for video format serving

export const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export const isAndroidDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
};

export const isWindowsDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Windows/i.test(navigator.userAgent);
};

export const isMacDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Mac/i.test(navigator.userAgent) && !/iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export const getDeviceType = (): 'ios' | 'android' | 'windows' | 'mac' | 'other' => {
  if (isIOSDevice()) return 'ios';
  if (isAndroidDevice()) return 'android';
  if (isWindowsDevice()) return 'windows';
  if (isMacDevice()) return 'mac';
  return 'other';
};

// Check if device needs iOS-compatible format
export const needsIOSFormat = (): boolean => {
  return isIOSDevice();
};

// Get preferred video format based on device
export const getPreferredVideoFormat = (): 'ios_ready' | 'original' => {
  return needsIOSFormat() ? 'ios_ready' : 'original';
};

// FFmpeg command generator for manual conversion
export const generateFFmpegCommand = (inputPath: string, outputPath?: string): string => {
  const output = outputPath || inputPath.replace(/\.[^.]+$/, '_ios.mp4');
  
  return `ffmpeg -i "${inputPath}" \\
  -c:v libx264 \\
  -profile:v high \\
  -level:v 4.1 \\
  -pix_fmt yuv420p \\
  -preset medium \\
  -crf 23 \\
  -c:a aac \\
  -b:a 192k \\
  -ac 2 \\
  -movflags +faststart \\
  -sn \\
  -map 0:v:0 \\
  -map 0:a:0 \\
  "${output}"`;
};

// Video format detection
export const getVideoFormat = (url: string): string => {
  if (!url) return 'unknown';
  
  const extension = url.split('.').pop()?.toLowerCase().split('?')[0];
  
  switch (extension) {
    case 'mp4':
    case 'm4v':
      return 'mp4';
    case 'mkv':
      return 'mkv';
    case 'webm':
      return 'webm';
    case 'avi':
      return 'avi';
    case 'm3u8':
      return 'hls';
    case 'mpd':
      return 'dash';
    default:
      return 'unknown';
  }
};

// Check if video format is iOS compatible
export const isIOSCompatibleFormat = (url: string): boolean => {
  const format = getVideoFormat(url);
  // iOS natively supports MP4 (H.264), HLS, and some MOV files
  return ['mp4', 'hls'].includes(format);
};

// Check if video needs conversion for iOS
export const needsConversionForIOS = (url: string): boolean => {
  if (!isIOSDevice()) return false;
  return !isIOSCompatibleFormat(url);
};
