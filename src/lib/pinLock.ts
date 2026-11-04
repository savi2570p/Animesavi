// Client-side PIN lock utilities. PINs are hashed (SHA-256) before storage.
// The unlocked state lives in sessionStorage so the site re-locks once
// the user closes the browser/tab entirely.

const PIN_HASH_KEY = "as_pin_hash_v1";
const PIN_LENGTH_KEY = "as_pin_length_v1";
const PIN_UNLOCKED_KEY = "as_pin_unlocked_v1";
const PIN_FAILS_KEY = "as_pin_fails_v1";
const PIN_LOCKED_UNTIL_KEY = "as_pin_locked_until_v1";

/** Wrong PIN entries allowed before the gate locks. */
export const PIN_MAX_ATTEMPTS = 3;
/** How long the gate stays locked after too many wrong entries. */
export const PIN_LOCKOUT_MS = 60 * 60 * 1000;

/** Returns the lockout end timestamp if the PIN gate is currently locked, else null. Clears an expired lockout. */
export function getPinLockoutUntil(now: number = Date.now()): number | null {
  try {
    const until = parseInt(localStorage.getItem(PIN_LOCKED_UNTIL_KEY) || "0", 10);
    if (until > now) return until;
    if (until) {
      localStorage.removeItem(PIN_LOCKED_UNTIL_KEY);
      localStorage.removeItem(PIN_FAILS_KEY);
    }
    return null;
  } catch {
    return null;
  }
}

export function getFailedPinAttempts(): number {
  try {
    return Math.max(0, parseInt(localStorage.getItem(PIN_FAILS_KEY) || "0", 10) || 0);
  } catch {
    return 0;
  }
}

/** Records a wrong PIN. After PIN_MAX_ATTEMPTS failures, locks for PIN_LOCKOUT_MS. */
export function recordFailedPinAttempt(now: number = Date.now()): { attempts: number; lockedUntil: number | null } {
  const attempts = getFailedPinAttempts() + 1;
  try {
    if (attempts >= PIN_MAX_ATTEMPTS) {
      const lockedUntil = now + PIN_LOCKOUT_MS;
      localStorage.setItem(PIN_LOCKED_UNTIL_KEY, String(lockedUntil));
      localStorage.setItem(PIN_FAILS_KEY, String(attempts));
      return { attempts, lockedUntil };
    }
    localStorage.setItem(PIN_FAILS_KEY, String(attempts));
  } catch {}
  return { attempts, lockedUntil: null };
}

export function resetPinAttempts() {
  try {
    localStorage.removeItem(PIN_FAILS_KEY);
    localStorage.removeItem(PIN_LOCKED_UNTIL_KEY);
  } catch {}
}

export type PinLength = 4 | 6;

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isPinEnabled(): boolean {
  try {
    return Boolean(localStorage.getItem(PIN_HASH_KEY));
  } catch {
    return false;
  }
}

export function getPinLength(): PinLength {
  try {
    const v = parseInt(localStorage.getItem(PIN_LENGTH_KEY) || "4", 10);
    return v === 6 ? 6 : 4;
  } catch {
    return 4;
  }
}

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(PIN_UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markUnlocked() {
  try {
    sessionStorage.setItem(PIN_UNLOCKED_KEY, "1");
    window.dispatchEvent(new Event("pinlock:changed"));
  } catch {}
}

export function lockNow() {
  try {
    sessionStorage.removeItem(PIN_UNLOCKED_KEY);
    window.dispatchEvent(new Event("pinlock:changed"));
  } catch {}
}

export async function setPin(pin: string, length: PinLength) {
  const hash = await sha256(pin);
  localStorage.setItem(PIN_HASH_KEY, hash);
  localStorage.setItem(PIN_LENGTH_KEY, String(length));
  resetPinAttempts();
  markUnlocked();
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return false;
  const hash = await sha256(pin);
  return hash === stored;
}

export function disablePin() {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(PIN_LENGTH_KEY);
  resetPinAttempts();
  sessionStorage.removeItem(PIN_UNLOCKED_KEY);
  window.dispatchEvent(new Event("pinlock:changed"));
}
