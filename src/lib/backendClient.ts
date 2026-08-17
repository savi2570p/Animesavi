/**
 * Backend reliability layer.
 *
 * Central place for:
 *  - classifying errors as retryable vs terminal
 *  - bounded exponential backoff with jitter (never infinite)
 *  - hard timeouts on every backend call (nothing hangs forever)
 *  - stable, safe user-facing error messages + a correlation id for logs
 *
 * It deliberately does NOT swallow errors: callers still get a rejection or a
 * structured failure they can act on.
 */

export type BackendErrorCode =
  | 'AUTH_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'DATABASE_ERROR'
  | 'UNKNOWN';

export interface BackendFailure {
  code: BackendErrorCode;
  /** Safe to render in the UI. Never contains stack traces or internals. */
  message: string;
  /** Correlation id — printed to the console log alongside full details. */
  requestId: string;
  retryable: boolean;
}

const SAFE_MESSAGES: Record<BackendErrorCode, string> = {
  AUTH_REQUIRED: 'Please sign in again to continue.',
  PERMISSION_DENIED: "You don't have permission to do that.",
  VALIDATION_ERROR: 'Some of the information provided is invalid.',
  NOT_FOUND: 'That item could not be found.',
  CONFLICT: 'This was already saved.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  TIMEOUT: 'The server took too long to respond. Please try again.',
  NETWORK_ERROR: 'Network problem. Check your connection and try again.',
  DATABASE_ERROR: 'We could not complete that operation. Please try again.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

export function newRequestId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

/** Map any thrown value / PostgREST error into a structured failure. */
export function classifyError(err: unknown, requestId = newRequestId()): BackendFailure {
  const e = (err ?? {}) as Record<string, any>;
  const status: number | undefined =
    typeof e.status === 'number' ? e.status : typeof e.statusCode === 'number' ? e.statusCode : undefined;
  const pgCode: string | undefined = typeof e.code === 'string' ? e.code : undefined;
  const raw = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`.toLowerCase();

  let code: BackendErrorCode = 'UNKNOWN';

  if (e.name === 'AbortError' || raw.includes('timeout') || status === 408 || pgCode === '57014') {
    code = 'TIMEOUT';
  } else if (raw.includes('failed to fetch') || raw.includes('network') || raw.includes('load failed')) {
    code = 'NETWORK_ERROR';
  } else if (status === 429 || pgCode === '429') {
    code = 'RATE_LIMITED';
  } else if (status === 401 || raw.includes('jwt') || raw.includes('auth_required')) {
    code = 'AUTH_REQUIRED';
  } else if (status === 403 || pgCode === '42501' || raw.includes('row-level security') || raw.includes('permission denied')) {
    code = 'PERMISSION_DENIED';
  } else if (status === 404 || pgCode === 'PGRST116') {
    code = 'NOT_FOUND';
  } else if (pgCode === '23505') {
    code = 'CONFLICT';
  } else if (pgCode === '23502' || pgCode === '23503' || pgCode === '22P02' || status === 400 || status === 422) {
    code = 'VALIDATION_ERROR';
  } else if (status && status >= 500) {
    code = 'DATABASE_ERROR';
  } else if (pgCode && /^(08|53|57|40)/.test(pgCode)) {
    // connection / resource / operator-intervention / serialization failures
    code = 'DATABASE_ERROR';
  }

  const retryable =
    code === 'TIMEOUT' ||
    code === 'NETWORK_ERROR' ||
    code === 'RATE_LIMITED' ||
    (code === 'DATABASE_ERROR' && (status === undefined || status >= 500));

  return { code, message: SAFE_MESSAGES[code], requestId, retryable };
}

export interface RetryOptions {
  /** Total attempts including the first one. Bounded — never infinite. */
  attempts?: number;
  /** Base delay in ms; grows exponentially with jitter. */
  baseDelayMs?: number;
  /** Hard timeout applied to each attempt. */
  timeoutMs?: number;
  /** Label used in structured logs. */
  operation: string;
  /** Abort signal from the caller (e.g. component unmount / navigation). */
  signal?: AbortSignal;
}

class TimeoutError extends Error {
  name = 'AbortError';
  constructor(op: string, ms: number) {
    super(`Operation "${op}" timed out after ${ms}ms`);
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });

function withTimeout<T>(p: Promise<T>, ms: number, operation: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(operation, ms)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Run a backend operation with a hard timeout and bounded exponential backoff.
 * Only transient failures are retried — auth, permission, validation and
 * conflict errors fail fast so we never hammer the backend pointlessly.
 */
export async function withRetry<T>(fn: (signal?: AbortSignal) => Promise<T>, opts: RetryOptions): Promise<T> {
  const attempts = Math.max(1, Math.min(5, opts.attempts ?? 3));
  const base = opts.baseDelayMs ?? 400;
  const timeoutMs = opts.timeoutMs ?? 15000;
  const requestId = newRequestId();
  const startedAt = Date.now();

  let lastFailure: BackendFailure | null = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const result = await withTimeout(Promise.resolve(fn(opts.signal)), timeoutMs, opts.operation);
      if (attempt > 1) {
        console.info('[backend]', {
          request_id: requestId,
          operation: opts.operation,
          status: 'recovered',
          attempt,
          duration_ms: Date.now() - startedAt,
        });
      }
      return result;
    } catch (err) {
      if ((err as any)?.name === 'AbortError' && opts.signal?.aborted) throw err;
      const failure = classifyError(err, requestId);
      lastFailure = failure;

      console.warn('[backend]', {
        request_id: requestId,
        operation: opts.operation,
        status: 'error',
        attempt,
        error_code: failure.code,
        retryable: failure.retryable,
        duration_ms: Date.now() - startedAt,
        detail: (err as any)?.message,
      });

      if (!failure.retryable || attempt === attempts) break;

      const delay = Math.round(base * 2 ** (attempt - 1) * (0.7 + Math.random() * 0.6));
      await sleep(delay, opts.signal);
    }
  }

  const failure = lastFailure ?? classifyError(new Error('unknown'), requestId);
  console.error('[backend]', {
    request_id: failure.requestId,
    operation: opts.operation,
    status: 'failed',
    error_code: failure.code,
    duration_ms: Date.now() - startedAt,
  });
  const error = new Error(failure.message) as Error & BackendFailure;
  Object.assign(error, failure);
  throw error;
}

/**
 * Best-effort variant for non-critical side effects (analytics, progress
 * pings). Never throws — playback and navigation must keep working even when
 * a secondary write fails (graceful degradation).
 */
export async function bestEffort<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  opts: RetryOptions,
): Promise<{ ok: true; data: T } | { ok: false; error: BackendFailure }> {
  try {
    return { ok: true, data: await withRetry(fn, opts) };
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      return { ok: false, error: classifyError(err) };
    }
    return { ok: false, error: classifyError(err) };
  }
}

/** Throws when a Supabase response carries an error; otherwise returns data. */
export function unwrap<T>(res: { data: T; error: unknown | null }): T {
  if (res.error) throw res.error;
  return res.data;
}
