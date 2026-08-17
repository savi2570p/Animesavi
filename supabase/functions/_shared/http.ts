/**
 * Shared HTTP helpers for edge functions:
 * structured responses, correlation ids, safe errors, structured logging.
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-request-id, x-idempotency-key',
};

const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'DATABASE_ERROR'
  | 'STORAGE_ERROR'
  | 'INTERNAL_ERROR';

const STATUS: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  TIMEOUT: 504,
  DATABASE_ERROR: 500,
  STORAGE_ERROR: 500,
  INTERNAL_ERROR: 500,
};

export function requestId(req?: Request): string {
  return req?.headers.get('x-request-id') || crypto.randomUUID();
}

export function jsonOk(data: unknown, reqId: string, status = 200): Response {
  return new Response(JSON.stringify({ success: true, request_id: reqId, data }), {
    status,
    headers: { ...JSON_HEADERS, 'x-request-id': reqId },
  });
}

/**
 * Safe error response. `detail` is logged server-side only — it never reaches
 * the client, so stack traces / credentials / DB internals cannot leak.
 */
export function jsonError(code: ErrorCode, message: string, reqId: string, detail?: unknown): Response {
  log({ request_id: reqId, status: 'error', error_code: code, detail: serialize(detail) });
  return new Response(
    JSON.stringify({ success: false, request_id: reqId, error: { code, message } }),
    { status: STATUS[code], headers: { ...JSON_HEADERS, 'x-request-id': reqId } },
  );
}

function serialize(v: unknown) {
  if (v instanceof Error) return { name: v.name, message: v.message };
  return v;
}

export function log(fields: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...fields }));
}

/** Hard timeout so a hung dependency can never pin an edge invocation open. */
export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms) as unknown as number;
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
