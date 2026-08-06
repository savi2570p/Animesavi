/**
 * Clone platform unlock tokens + slug helpers.
 * Kept framework-free so the logic is unit-testable.
 */

export const UNLOCK_KEY = 'clone_platform_unlock_until';
export const UNLOCK_TOKEN_KEY = 'clone_platform_unlock_token';
export const UNLOCK_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

export function issueUnlockToken(now: number = Date.now()): string {
  const until = now + UNLOCK_DURATION_MS;
  const rand =
    (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const token = `${rand}.${until}`;
  try {
    localStorage.setItem(UNLOCK_KEY, String(until));
    localStorage.setItem(UNLOCK_TOKEN_KEY, token);
  } catch {
    /* storage unavailable — token still returned for the session */
  }
  return token;
}

/** Verifies a token string against the stored expiry. */
export function verifyUnlockToken(
  token: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!token) return false;
  const [, rawUntil] = token.split('.');
  const until = parseInt(rawUntil ?? '', 10);
  if (!Number.isFinite(until) || now >= until) return false;

  try {
    const stored = localStorage.getItem(UNLOCK_TOKEN_KEY);
    if (stored && stored !== token) return false;
  } catch {
    /* ignore */
  }
  return true;
}

export function readStoredUnlockToken(): string | null {
  try {
    return localStorage.getItem(UNLOCK_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function hasActiveUnlock(now: number = Date.now()): boolean {
  return verifyUnlockToken(readStoredUnlockToken(), now);
}

export function clearUnlock() {
  try {
    localStorage.removeItem(UNLOCK_KEY);
    localStorage.removeItem(UNLOCK_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/* --------------------------------------------------------------- slugs */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface SlugValidationInput {
  name: string;
  slug: string;
  existingSlugs: string[];
}

export interface SlugValidationResult {
  effectiveSlug: string;
  nameError: string | null;
  slugError: string | null;
  valid: boolean;
}

export function validateCloneForm({
  name,
  slug,
  existingSlugs,
}: SlugValidationInput): SlugValidationResult {
  const effectiveSlug = slugify(slug || name);
  const nameError = name.trim() ? null : 'Name is required';
  let slugError: string | null = null;

  if (!effectiveSlug) slugError = 'Slug is required';
  else if (existingSlugs.map(slugify).includes(effectiveSlug))
    slugError = 'That slug is already used by another clone page';

  return {
    effectiveSlug,
    nameError,
    slugError,
    valid: !nameError && !slugError,
  };
}
