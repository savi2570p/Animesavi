// Shared helpers for the custom embed system (token → episode → playback source).

export type PlaybackType = 'hls' | 'mp4' | 'other';

export interface ResolvedSource {
  url: string;
  type: PlaybackType;
  label: string;
}

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Opaque, unpredictable, mixed-case token. Always contains an uppercase char
 *  so the root router can tell embed tokens apart from clone-platform slugs. */
export function generateEmbedToken(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  if (!/[A-Z]/.test(out)) {
    const idx = Math.floor(Math.random() * length);
    out = out.slice(0, idx) + 'K' + out.slice(idx + 1);
  }
  return out;
}

export function classifySource(url: string): PlaybackType {
  if (/\.m3u8(\?.*)?$/i.test(url)) return 'hls';
  if (/\.(mp4|m4v|mov)(\?.*)?$/i.test(url)) return 'mp4';
  return 'other';
}

/** Is this one of our own embed/watch pages (never a video source)? */
function isSelfPage(url: string): boolean {
  // Root token links like https://animesavi.cloudsavi/7xK92p are our own embed pages.
  if (/^https?:\/\/(www\.)?animesavi\.(com|cloudsavi)\/[A-Za-z0-9]{4,24}\/?$/i.test(url)) return true;
  return /animesavi\.(com|cloudsavi)|lovable\.(app|dev)|lovableproject\.com/i.test(url) &&
    /\/(embed|watch|e)[-/]/i.test(url);
}


interface ConversionRow {
  hls_url?: string | null;
  ios_ready_url?: string | null;
  status?: string | null;
  conversion_progress?: number | null;
  conversion_stage?: string | null;
  error_message?: string | null;
}

/**
 * Build the ordered playback source list for an episode. Prefers HLS (adaptive
 * quality, native on iOS) then an iOS-ready MP4 then the original upload —
 * exactly the same sources the normal player uses.
 */
export function buildSources(
  episode: { video_url?: string | null; external_url?: string | null },
  conversion: ConversionRow | null,
): ResolvedSource[] {
  const out: ResolvedSource[] = [];
  const push = (url: string | null | undefined, label: string) => {
    if (!url) return;
    const clean = url.trim();
    if (!clean || !/^https?:\/\//i.test(clean)) return;
    if (isSelfPage(clean)) return;
    if (out.some((s) => s.url === clean)) return;
    out.push({ url: clean, type: classifySource(clean), label });
  };

  if (conversion?.status === 'completed' || conversion?.hls_url) push(conversion?.hls_url, 'Auto (HLS)');
  if (conversion?.status === 'completed') push(conversion?.ios_ready_url, 'Compatible MP4');
  push(episode.video_url, 'Original');
  push(episode.external_url, 'External');

  return out;
}

export function isProcessing(conversion: ConversionRow | null): boolean {
  if (!conversion) return false;
  return ['pending', 'processing', 'converting', 'queued', 'analyzing'].includes(
    String(conversion.status ?? '').toLowerCase(),
  );
}
