// Client-side PIN lock utilities. PINs are hashed (SHA-256) before storage.
// The unlocked state lives in sessionStorage so the site re-locks once
// the user closes the browser/tab entirely.

const PIN_HASH_KEY = "as_pin_hash_v1";
const PIN_LENGTH_KEY = "as_pin_length_v1";
const PIN_UNLOCKED_KEY = "as_pin_unlocked_v1";

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
  sessionStorage.removeItem(PIN_UNLOCKED_KEY);
  window.dispatchEvent(new Event("pinlock:changed"));
}
