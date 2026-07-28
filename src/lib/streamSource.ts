// Utilities for selecting the most compatible video source per device
// and detecting HLS/DASH manifest URLs.

export function isHlsUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.m3u8(\?.*)?$/i.test(url) || /[?&](format|type)=hls\b/i.test(url);
}

export function isDashUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.mpd(\?.*)?$/i.test(url) || /[?&](format|type)=dash\b/i.test(url);
}

export function isMp4LikeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|m4v|mov)(\?.*)?$/i.test(url);
}

export function isMkvUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.mkv(\?.*)?$/i.test(url);
}

export type DeviceKind = 'ios' | 'android' | 'desktop';

export function detectDeviceKind(): DeviceKind {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (/(Macintosh)/.test(ua) && 'ontouchend' in document)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Rank a URL for playback compatibility on the current device.
 * Higher score = more likely to play. Negative = incompatible.
 */
export function scoreSourceForDevice(url: string, device: DeviceKind = detectDeviceKind()): number {
  if (!url) return -100;
  const hls = isHlsUrl(url);
  const dash = isDashUrl(url);
  const mp4 = isMp4LikeUrl(url);
  const mkv = isMkvUrl(url);

  if (device === 'ios') {
    // iOS Safari: native HLS + MP4 only. No MSE/DASH/MKV in real Safari.
    if (hls) return 100;
    if (mp4) return 80;
    if (dash) return -50;   // dash.js needs MSE which iOS Safari lacks
    if (mkv) return -60;    // unplayable
    return 20;              // unknown — try as last resort
  }
  if (device === 'android') {
    // Android Chrome supports MSE → hls.js + dash.js both work.
    if (hls) return 100;
    if (mp4) return 90;
    if (dash) return 70;
    if (mkv) return -40;    // most Android browsers can't decode MKV containers
    return 20;
  }
  // Desktop
  if (mp4) return 100;
  if (hls) return 95;
  if (dash) return 85;
  if (mkv) return 10;
  return 30;
}

/**
 * Order candidate URLs so the most device-compatible source is tried first,
 * and drop sources that cannot possibly play on this device.
 */
export function selectCompatibleSources(
  urls: (string | null | undefined)[],
  device: DeviceKind = detectDeviceKind(),
): string[] {
  const scored = urls
    .filter((u): u is string => !!u && typeof u === 'string')
    .filter((u, i, arr) => arr.indexOf(u) === i)
    .map((u) => ({ u, s: scoreSourceForDevice(u, device) }));
  const playable = scored.filter((x) => x.s > 0);
  const source = playable.length ? playable : scored; // if everything looks bad, still try
  return source.sort((a, b) => b.s - a.s).map((x) => x.u);
}
