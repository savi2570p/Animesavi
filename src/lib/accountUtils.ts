const SAVED_ACCOUNTS_KEY = 'anime_saved_accounts';

interface SavedAccount {
  email: string;
  username: string;
  lastUsed: number;
}

/** Reads saved accounts from localStorage. */
export function getSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Saves the account list to localStorage. */
export function setSavedAccounts(accounts: SavedAccount[]) {
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

/** Adds or updates an account in the saved list. */
export function rememberAccount(email: string, username: string, maxAccounts = 2) {
  const accounts = getSavedAccounts();
  const existing = accounts.find((a) => a.email === email);
  const filtered = accounts.filter((a) => a.email !== email);
  filtered.unshift({ email, username: username || existing?.username || email.split('@')[0], lastUsed: Date.now() });
  setSavedAccounts(filtered.slice(0, maxAccounts));
}

/** Returns the number of saved accounts. */
export function getSavedAccountCount(): number {
  return getSavedAccounts().length;
}

/** Removes an account from the saved list. */
export function forgetAccount(email: string) {
  const accounts = getSavedAccounts().filter((a) => a.email !== email);
  setSavedAccounts(accounts);
}

export type { SavedAccount };
