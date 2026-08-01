/**
 * Short embed links.
 *
 * Every episode has a database-generated `short_id` — the first 6 hex chars of
 * its UUID (e.g. "gy7e12"). That lets us hand out compact links like
 * `https://animesavi.com/embed/gy7e12` instead of the full 36-char UUID.
 *
 * The embed route accepts BOTH forms, so old full-UUID links keep working.
 */

export const EMBED_ORIGIN = 'https://animesavi.com';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_RE = /^[0-9a-f]{4,12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return !!value && UUID_RE.test(value.trim());
}

export function isShortEmbedCode(value: string | null | undefined): boolean {
  return !!value && !isUuid(value) && SHORT_RE.test(value.trim());
}

/** Derive the short code from a full episode UUID (matches the DB column). */
export function shortEmbedCode(episodeId: string): string {
  if (!episodeId) return '';
  const compact = episodeId.replace(/-/g, '').toLowerCase();
  return isUuid(episodeId) ? compact.slice(0, 6) : episodeId;
}

/** Build the short, shareable embed URL for an episode. */
export function buildEmbedUrl(episodeId: string, origin?: string): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : EMBED_ORIGIN);
  return `${base}/embed/${shortEmbedCode(episodeId)}`;
}

/**
 * Is this URL one of OUR OWN embed pages?
 *
 * Auto-generated embed links are stored in `episodes.external_url`. If the
 * embed player then treats that value as a *video source*, it tries to play an
 * HTML page and fails with "Failed to load — please try again". These URLs must
 * be filtered out of any video-source candidate list.
 */
export function isSelfEmbedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : EMBED_ORIGIN);
    const host = u.hostname.toLowerCase();
    const isOwnHost =
      host === 'animesavi.com' ||
      host === 'www.animesavi.com' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.lovable.app') ||
      host.endsWith('.lovable.dev') ||
      host.endsWith('.lovableproject.com') ||
      (typeof window !== 'undefined' && host === window.location.hostname);
    return isOwnHost && /^\/embed[-/]/.test(u.pathname);
  } catch {
    return false;
  }
}
