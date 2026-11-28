const TOKEN_KEY = 'shadowflix_access_token';
const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shadow-flix-auth`;

export class ShadowFlixAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getShadowFlixAccessToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveShadowFlixAccessToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearShadowFlixAccessToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem('shadowflix_unlocked');
  } catch {
    // Storage can be unavailable in hardened/private browser modes.
  }
}

export async function shadowFlixAccessRequest<T>(body: Record<string, string>): Promise<T> {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ShadowFlixAccessError(
      typeof data?.error === 'string' ? data.error : 'Secure request failed.',
      response.status,
    );
  }
  return data as T;
}
