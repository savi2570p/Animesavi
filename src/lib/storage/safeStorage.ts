/**
 * Quota-safe, corruption-safe localStorage wrapper.
 *
 * Direct localStorage usage crashes in:
 *  - Safari private mode (setItem throws)
 *  - iOS PWA quota exhaustion (QuotaExceededError)
 *  - corrupted values (JSON.parse throws and takes the render tree down)
 *
 * Every helper here fails soft and never throws.
 */

import { logError } from '@/lib/errors/logger';

function available(): boolean {
  try {
    const probe = '__flox_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const memoryFallback = new Map<string, string>();
let usable: boolean | null = null;

function canUse(): boolean {
  if (usable === null) usable = available();
  return usable;
}

export function getItem(key: string): string | null {
  try {
    if (!canUse()) return memoryFallback.get(key) ?? null;
    return localStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

export function setItem(key: string, value: string): boolean {
  try {
    if (!canUse()) {
      memoryFallback.set(key, value);
      return false;
    }
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    // Quota exceeded — drop the biggest non-critical caches and retry once.
    memoryFallback.set(key, value);
    if (pruneCaches()) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch { /* still full */ }
    }
    logError('storage', e, { key });
    return false;
  }
}

export function removeItem(key: string) {
  try {
    memoryFallback.delete(key);
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

/** Read + parse JSON, returning the fallback on any corruption. */
export function getJSON<T>(key: string, fallback: T): T {
  const raw = getItem(key);
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    // Corrupted entry — remove it so it can never crash the app again.
    removeItem(key);
    return fallback;
  }
}

export function setJSON(key: string, value: unknown): boolean {
  try {
    return setItem(key, JSON.stringify(value));
  } catch (e) {
    logError('storage', e, { key });
    return false;
  }
}

/**
 * Versioned read: if the stored version differs, the entry is discarded.
 * Use for shapes that change between releases (settings, caches).
 */
export function getVersionedJSON<T>(key: string, version: number, fallback: T): T {
  const wrapped = getJSON<{ v?: number; d?: T } | null>(key, null);
  if (!wrapped || wrapped.v !== version || wrapped.d === undefined) return fallback;
  return wrapped.d;
}

export function setVersionedJSON(key: string, version: number, data: unknown): boolean {
  return setJSON(key, { v: version, d: data });
}

/** Keys safe to evict when storage is full (pure caches, never user state). */
const EVICTABLE_PREFIXES = ['cache:', 'meta-cache:', 'thumb-cache:', 'speed-samples'];

function pruneCaches(): boolean {
  let pruned = false;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && EVICTABLE_PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
    }
    keys.forEach((k) => {
      localStorage.removeItem(k);
      pruned = true;
    });
  } catch { /* ignore */ }
  return pruned;
}

export const safeStorage = {
  getItem,
  setItem,
  removeItem,
  getJSON,
  setJSON,
  getVersionedJSON,
  setVersionedJSON,
};
