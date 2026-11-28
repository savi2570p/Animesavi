import { supabase } from '@/integrations/supabase/client';

const PIN_LENGTH_KEY = 'as_pin_length_v1';
const PIN_SESSION_KEY = 'as_pin_session_v1';
const LEGACY_KEYS = ['as_pin_hash_v1', 'as_pin_unlocked_v1', 'as_pin_fails_v1', 'as_pin_locked_until_v1'];
const PIN_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pin-lock`;

export const PIN_MAX_ATTEMPTS = 3;
export const PIN_LOCKOUT_MS = 60 * 60 * 1000;
export type PinLength = 4 | 6;

export interface PinStatus {
  enabled: boolean;
  length: PinLength;
  attempts: number;
  locked_until: number | null;
  unlocked: boolean;
}

export interface PinVerification {
  ok: boolean;
  attempts: number;
  lockedUntil: number | null;
}

export class PinLockError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function getPinSessionToken(): string | null {
  try {
    const token = sessionStorage.getItem(PIN_SESSION_KEY) ?? '';
    return /^[0-9a-f]{64}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}

function savePinSessionToken(token: string) {
  sessionStorage.setItem(PIN_SESSION_KEY, token);
}

function clearPinSessionToken() {
  try {
    sessionStorage.removeItem(PIN_SESSION_KEY);
    sessionStorage.removeItem('as_pin_unlocked_v1');
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

function clearLegacyPin() {
  try {
    LEGACY_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

async function pinRequest<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new PinLockError('Sign in to use PIN lock.', 401);
  const response = await fetch(PIN_FUNCTION_URL, {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new PinLockError(typeof data?.error === 'string' ? data.error : 'PIN request failed.', response.status, data);
  }
  return data as T;
}

export async function getPinStatus(): Promise<PinStatus> {
  const status = await pinRequest<PinStatus>({ action: 'status', access_token: getPinSessionToken() });
  clearLegacyPin();
  try {
    localStorage.setItem(PIN_LENGTH_KEY, String(status.length === 6 ? 6 : 4));
  } catch {
    // The server remains authoritative when local storage is unavailable.
  }
  if (!status.enabled || status.unlocked === false) clearPinSessionToken();
  return status;
}

export function getPinLength(): PinLength {
  try {
    return parseInt(localStorage.getItem(PIN_LENGTH_KEY) || '4', 10) === 6 ? 6 : 4;
  } catch {
    return 4;
  }
}

export function isPinEnabled(): boolean {
  // Used only as a fail-closed hint if the status request is unreachable.
  try {
    return Boolean(localStorage.getItem('as_pin_hash_v1')) || Boolean(getPinSessionToken());
  } catch {
    return false;
  }
}

export async function verifyPin(pin: string): Promise<PinVerification> {
  try {
    const result = await pinRequest<{ ok: boolean; attempts: number; locked_until: number | null; access_token: string }>({ action: 'verify', pin });
    if (result.ok && result.access_token) savePinSessionToken(result.access_token);
    return { ok: result.ok, attempts: result.attempts, lockedUntil: result.locked_until ?? null };
  } catch (error) {
    if (error instanceof PinLockError && typeof error.data.attempts === 'number') {
      return {
        ok: false,
        attempts: error.data.attempts,
        lockedUntil: typeof error.data.locked_until === 'number' ? error.data.locked_until : null,
      };
    }
    throw error;
  }
}

export async function setPin(pin: string, length: PinLength, currentPin?: string) {
  const result = await pinRequest<{ access_token: string }>({
    action: 'set',
    pin,
    length,
    current_pin: currentPin,
  });
  savePinSessionToken(result.access_token);
  clearLegacyPin();
  try {
    localStorage.setItem(PIN_LENGTH_KEY, String(length));
  } catch {
    // The server remains authoritative when local storage is unavailable.
  }
  window.dispatchEvent(new Event('pinlock:changed'));
}

export async function disablePin(currentPin: string) {
  await pinRequest({ action: 'remove', current_pin: currentPin });
  clearPinSessionToken();
  clearLegacyPin();
  window.dispatchEvent(new Event('pinlock:changed'));
}

export function lockNow() {
  const accessToken = getPinSessionToken();
  clearPinSessionToken();
  window.dispatchEvent(new Event('pinlock:changed'));
  if (accessToken) void pinRequest({ action: 'revoke', access_token: accessToken }).catch(() => undefined);
}
