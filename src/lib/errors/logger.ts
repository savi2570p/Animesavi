/**
 * Centralized frontend error logging + global handlers.
 *
 * Goals:
 *  - one consistent place to classify/report errors
 *  - never let an unhandled rejection or a benign async error blank the app
 *  - de-duplicate noisy repeated errors (players/iframes fire the same error a lot)
 */

export type ErrorScope =
  | 'boundary'
  | 'player'
  | 'api'
  | 'auth'
  | 'storage'
  | 'upload'
  | 'unknown';

export interface LoggedError {
  scope: ErrorScope;
  message: string;
  detail?: unknown;
  at: number;
}

const recent = new Map<string, number>();
const DEDUPE_MS = 4000;
const history: LoggedError[] = [];
const MAX_HISTORY = 50;

function shouldReport(key: string) {
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < DEDUPE_MS) return false;
  recent.set(key, now);
  if (recent.size > 200) recent.clear();
  return true;
}

export function toMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'object' && 'message' in (error as any)) {
    return String((error as any).message);
  }
  try {
    return JSON.stringify(error).slice(0, 300);
  } catch {
    return 'Unknown error';
  }
}

/** Benign/noisy errors that should never be surfaced or spammed. */
function isIgnorable(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes('resizeobserver loop') ||
    m.includes('script error') ||
    m.includes('the play() request was interrupted') ||
    m.includes('the operation was aborted') ||
    m.includes('aborterror') ||
    m.includes('load failed') || // Safari fetch abort on navigation
    m.includes('networkerror when attempting to fetch') ||
    m.includes('failed to fetch') // offline / cancelled — handled by UI states
  );
}

export function logError(scope: ErrorScope, error: unknown, detail?: unknown) {
  const message = toMessage(error);
  if (isIgnorable(message)) return;
  if (!shouldReport(`${scope}:${message}`)) return;

  history.push({ scope, message, detail, at: Date.now() });
  if (history.length > MAX_HISTORY) history.shift();

  // Keep console output structured; no stack traces are ever shown to users.
  console.error(`[${scope}]`, message, detail ?? '');
}

/** Recent errors — used by the health/QA pages, never rendered to end users. */
export function getErrorHistory(): LoggedError[] {
  return [...history];
}

/** A friendly, non-technical message for any error. */
export function friendlyMessage(error: unknown): string {
  const m = toMessage(error).toLowerCase();
  if (!navigator.onLine) return 'You appear to be offline. Check your connection and try again.';
  if (m.includes('timeout') || m.includes('timed out')) return 'This took too long to respond. Please try again.';
  if (m.includes('permission') || m.includes('row-level security') || m.includes('not authorized')) {
    return "You don't have access to this. Try signing in again.";
  }
  if (m.includes('fetch') || m.includes('network')) return 'Network problem. Please retry in a moment.';
  return 'Something went wrong. Please try again.';
}

let installed = false;

/** Install global handlers once, at app start. */
export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    logError('unknown', event.error ?? event.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    logError('unknown', event.reason);
    // Prevent noisy "Uncaught (in promise)" overlays; the app stays alive.
    const msg = toMessage(event.reason);
    if (isIgnorable(msg)) event.preventDefault();
  });
}
