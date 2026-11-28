import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 60 * 60 * 1000;
const SESSION_MS = 24 * 60 * 60 * 1000;
const ITERATIONS = 310000;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const hexToBytes = (hex: string) => new Uint8Array(hex.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));

async function sha256Hex(value: string): Promise<string> {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}
function randomHex(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToHex(value);
}
function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
async function derivePin(pin: string, saltHex: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401);
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const { data: userData, error: authError } = await admin.auth.getUser(authHeader.slice(7));
    if (authError || !userData.user) return json({ error: 'Invalid session.' }, 401);
    const userId = userData.user.id;

    const raw = await req.text();
    if (raw.length > 4096) return json({ error: 'Request too large.' }, 413);
    const body = raw ? JSON.parse(raw) : {};
    const action = String(body?.action ?? 'status');
    const { data: credential } = await admin.from('pin_lock_credentials').select('*').eq('user_id', userId).maybeSingle();

    if (action === 'status') {
      let unlocked = false;
      const accessToken = typeof body?.access_token === 'string' ? body.access_token : '';
      if (credential && /^[0-9a-f]{64}$/.test(accessToken)) {
        const { data: session } = await admin.from('pin_lock_sessions').select('token_hash')
          .eq('token_hash', await sha256Hex(accessToken)).eq('user_id', userId)
          .gt('expires_at', new Date().toISOString()).maybeSingle();
        unlocked = !!session;
      }
      return json({
        enabled: !!credential,
        length: credential?.pin_length ?? 4,
        attempts: credential?.failed_attempts ?? 0,
        locked_until: credential?.locked_until ? new Date(credential.locked_until).getTime() : null,
        unlocked,
      });
    }

    if (action === 'revoke') {
      const accessToken = typeof body?.access_token === 'string' ? body.access_token : '';
      if (/^[0-9a-f]{64}$/.test(accessToken)) {
        await admin.from('pin_lock_sessions').delete().eq('token_hash', await sha256Hex(accessToken)).eq('user_id', userId);
      }
      return json({ ok: true });
    }

    const limited = await enforceRateLimit({
      req,
      action: action === 'verify' ? 'pin:verify' : 'pin:manage',
      identity: userId,
      limit: action === 'verify' ? 20 : 10,
      windowSeconds: 900,
      corsHeaders,
    });
    if (limited) return limited;

    const lockedUntil = credential?.locked_until ? new Date(credential.locked_until).getTime() : null;
    if (lockedUntil && lockedUntil > Date.now()) {
      return json({ ok: false, attempts: credential.failed_attempts, locked_until: lockedUntil, error: 'PIN is temporarily locked.' }, 429);
    }

    const checkPin = async (pin: string) => {
      if (!credential) return { ok: false, attempts: 0, lockedUntil: null };
      if (lockedUntil && lockedUntil <= Date.now()) {
        await admin.from('pin_lock_credentials').update({ failed_attempts: 0, locked_until: null }).eq('user_id', userId);
        credential.failed_attempts = 0;
      }
      const actual = await derivePin(pin, credential.pin_salt, credential.iterations);
      if (equalHex(actual, credential.pin_hash)) {
        await admin.from('pin_lock_credentials').update({ failed_attempts: 0, locked_until: null }).eq('user_id', userId);
        return { ok: true, attempts: 0, lockedUntil: null };
      }
      const attempts = (credential.failed_attempts ?? 0) + 1;
      const nextLock = attempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null;
      await admin.from('pin_lock_credentials').update({
        failed_attempts: attempts,
        locked_until: nextLock ? new Date(nextLock).toISOString() : null,
      }).eq('user_id', userId);
      credential.failed_attempts = attempts;
      return { ok: false, attempts, lockedUntil: nextLock };
    };

    if (action === 'verify') {
      const pin = typeof body?.pin === 'string' ? body.pin : '';
      if (!credential || !new RegExp(`^\\d{${credential.pin_length}}$`).test(pin)) return json({ error: 'PIN is not set up.' }, 404);
      const result = await checkPin(pin);
      if (!result.ok) return json(result, result.lockedUntil ? 429 : 401);

      await admin.from('pin_lock_sessions').delete().eq('user_id', userId);
      const accessToken = randomHex();
      await admin.from('pin_lock_sessions').insert({
        token_hash: await sha256Hex(accessToken),
        user_id: userId,
        expires_at: new Date(Date.now() + SESSION_MS).toISOString(),
      });
      return json({ ...result, access_token: accessToken });
    }

    if (action === 'set') {
      const pin = typeof body?.pin === 'string' ? body.pin : '';
      const length = Number(body?.length);
      if (![4, 6].includes(length) || !new RegExp(`^\\d{${length}}$`).test(pin)) return json({ error: 'PIN must be 4 or 6 digits.' }, 400);
      if (credential) {
        const currentPin = typeof body?.current_pin === 'string' ? body.current_pin : '';
        const current = await checkPin(currentPin);
        if (!current.ok) return json(current, current.lockedUntil ? 429 : 401);
      }
      const salt = randomHex(16);
      const hash = await derivePin(pin, salt, ITERATIONS);
      const { error } = await admin.from('pin_lock_credentials').upsert({
        user_id: userId,
        pin_salt: salt,
        pin_hash: hash,
        pin_length: length,
        iterations: ITERATIONS,
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      });
      if (error) return json({ error: 'Could not save PIN.' }, 500);
      await admin.from('pin_lock_sessions').delete().eq('user_id', userId);
      const accessToken = randomHex();
      await admin.from('pin_lock_sessions').insert({
        token_hash: await sha256Hex(accessToken), user_id: userId, expires_at: new Date(Date.now() + SESSION_MS).toISOString(),
      });
      return json({ ok: true, access_token: accessToken });
    }

    if (action === 'remove') {
      if (!credential) return json({ ok: true });
      const currentPin = typeof body?.current_pin === 'string' ? body.current_pin : '';
      const current = await checkPin(currentPin);
      if (!current.ok) return json(current, current.lockedUntil ? 429 : 401);
      await admin.from('pin_lock_sessions').delete().eq('user_id', userId);
      await admin.from('pin_lock_credentials').delete().eq('user_id', userId);
      return json({ ok: true });
    }

    return json({ error: 'Unsupported action.' }, 400);
  } catch {
    return json({ error: 'Invalid PIN request.' }, 400);
  }
});
