/**
 * Uploader-managed allowlist of approved embed domains for the "Embed" server.
 *
 * Goal: only iframe trusted external hosts. The list is stored in localStorage
 * so uploaders / admins can manage it without a DB migration. If the list is
 * empty (default), all embed hosts are allowed (backwards compatible). Once
 * an uploader adds entries, the allowlist becomes enforcing.
 */

const STORAGE_KEY = 'embed_domain_allowlist_v1';

/** Default suggestions shown to uploaders — NOT auto-enforced. */
export const DEFAULT_SUGGESTED_DOMAINS = [
  'upnshare.com',
  'rpmshare.com',
  'doodstream.com',
  'dood.li',
  'streamtape.com',
  'filemoon.sx',
  'vidplay.site',
  'streamwish.to',
  'mixdrop.co',
  'vidcloud.co',
  'vidsrc.to',
  '2embed.cc',
  'streamhg.com',
  'voe.sx',
] as const;

export interface AllowlistState {
  /** When true, only domains in `domains` may be iframed. */
  enforced: boolean;
  /** Lowercased bare hostnames (no scheme, no path). */
  domains: string[];
}

const DEFAULT_STATE: AllowlistState = { enforced: false, domains: [] };

function safeParse(raw: string | null): AllowlistState {
  if (!raw) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray(parsed.domains) &&
      typeof parsed.enforced === 'boolean'
    ) {
      return {
        enforced: parsed.enforced,
        domains: parsed.domains
          .filter((d: unknown): d is string => typeof d === 'string')
          .map((d: string) => d.trim().toLowerCase())
          .filter(Boolean),
      };
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_STATE;
}

export function getAllowlist(): AllowlistState {
  if (typeof localStorage === 'undefined') return DEFAULT_STATE;
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

export function setAllowlist(state: AllowlistState): void {
  if (typeof localStorage === 'undefined') return;
  const cleaned: AllowlistState = {
    enforced: !!state.enforced,
    domains: Array.from(
      new Set(
        state.domains
          .map((d) => normalizeDomain(d))
          .filter((d): d is string => !!d),
      ),
    ),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
}

/** Strip scheme/path/port and return a bare lowercased hostname, or null. */
export function normalizeDomain(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return u.hostname || null;
  } catch {
    return null;
  }
}

/** Extract the hostname from a URL string, or null if invalid. */
export function getHostname(url: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Is the given embed URL allowed to render?
 *
 * Rules:
 *  - If the allowlist is not enforced (default) → always allow.
 *  - Otherwise, the URL's hostname (or any parent domain) must match an entry.
 *    e.g. "play.doodstream.com" is allowed when "doodstream.com" is listed.
 */
export function isEmbedUrlAllowed(url: string, state?: AllowlistState): boolean {
  const list = state ?? getAllowlist();
  const host = getHostname(url);

  // Our own embed pages (same origin / branded embed domains) are always allowed.
  if (
    host &&
    (host === 'animesavi.com' ||
      host === 'www.animesavi.com' ||
      host === 'animesavi.cloudsavi' ||
      host.endsWith('.lovable.app') ||
      (typeof window !== 'undefined' && host === window.location.hostname))
  ) {
    return true;
  }

  if (!list.enforced) return true;
  if (list.domains.length === 0) return false;
  if (!host) return false;


  return list.domains.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}
