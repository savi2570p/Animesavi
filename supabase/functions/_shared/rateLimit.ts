import { createClient } from 'npm:@supabase/supabase-js@2';

interface RateLimitOptions {
  req: Request;
  action: string;
  limit: number;
  windowSeconds: number;
  corsHeaders: Record<string, string>;
  /** A verified user ID or high-entropy token hash. Defaults to the client IP. */
  identity?: string;
}

function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip')?.trim()
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Best-effort fixed-window throttling for sensitive edge endpoints. The private
 * table is service-role only and stores an HMAC, never a raw IP or access token.
 * This is not a DDoS mitigation layer.
 */
export async function enforceRateLimit({
  req,
  action,
  limit,
  windowSeconds,
  corsHeaders,
  identity,
}: RateLimitOptions): Promise<Response | null> {
  const secret = Deno.env.get('RATE_LIMIT_HASH_KEY');
  if (!secret) {
    return new Response(JSON.stringify({ error: 'Security check unavailable.' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const keyHash = await hmacSha256Hex(secret, `${action}:${identity ?? clientIp(req)}`);
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await admin.rpc('consume_rate_limit', {
    _action: action,
    _key_hash: keyHash,
    _limit: limit,
    _window_seconds: windowSeconds,
  });

  if (error) {
    console.error('[rate-limit] check failed', { action, code: error.code });
    return new Response(JSON.stringify({ error: 'Security check temporarily unavailable.' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (result?.allowed === true) return null;

  const retryAfter = Math.max(1, Number(result?.retry_after) || windowSeconds);
  return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
    status: 429,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Retry-After': String(retryAfter),
    },
  });
}
