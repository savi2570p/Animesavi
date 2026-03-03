const SAVED_ACCOUNTS_KEY = 'anime_saved_accounts';

interface SavedAccount {
  email: string;
  username: string;
  lastUsed: number;
}

const DEFAULT_MAX_ACCOUNTS = 5;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function sanitizeAccounts(input: unknown): SavedAccount[] {
  if (!Array.isArray(input)) return [];

  const byEmail = new Map<string, SavedAccount>();

  for (const item of input) {
    if (!item || typeof item !== 'object') continue;

    const rawEmail = typeof (item as SavedAccount).email === 'string' ? (item as SavedAccount).email : '';
    const email = normalizeEmail(rawEmail);
    if (!email || !email.includes('@')) continue;

    const fallbackUsername = email.split('@')[0];
    const rawUsername = typeof (item as SavedAccount).username === 'string' ? (item as SavedAccount).username.trim() : '';
    const username = rawUsername || fallbackUsername;

    const rawLastUsed = Number((item as SavedAccount).lastUsed);
    const lastUsed = Number.isFinite(rawLastUsed) ? rawLastUsed : Date.now();

    const nextAccount: SavedAccount = { email, username, lastUsed };
    const existing = byEmail.get(email);

    if (!existing || nextAccount.lastUsed >= existing.lastUsed) {
      byEmail.set(email, nextAccount);
    }
  }

  return Array.from(byEmail.values()).sort((a, b) => b.lastUsed - a.lastUsed);
}

/** Reads saved accounts from localStorage. */
export function getSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    const sanitized = sanitizeAccounts(parsed);

    if (JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(sanitized));
    }

    return sanitized;
  } catch {
    return [];
  }
}

/** Saves the account list to localStorage. */
export function setSavedAccounts(accounts: SavedAccount[]) {
  const sanitized = sanitizeAccounts(accounts);
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(sanitized));
}

/** Adds or updates an account in the saved list. */
export function rememberAccount(email: string, username: string, maxAccounts = DEFAULT_MAX_ACCOUNTS) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const accounts = getSavedAccounts().filter((a) => a.email !== normalizedEmail);
  const fallbackUsername = normalizedEmail.split('@')[0];

  accounts.unshift({
    email: normalizedEmail,
    username: (username || fallbackUsername).trim() || fallbackUsername,
    lastUsed: Date.now(),
  });

  setSavedAccounts(accounts.slice(0, Math.max(1, maxAccounts)));
}

/** Returns the number of saved accounts. */
export function getSavedAccountCount(): number {
  return getSavedAccounts().length;
}

/** Removes an account from the saved list. */
export function forgetAccount(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const accounts = getSavedAccounts().filter((a) => a.email !== normalizedEmail);
  setSavedAccounts(accounts);
}

export type { SavedAccount };
