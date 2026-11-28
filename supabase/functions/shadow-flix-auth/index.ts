import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const SESSION_HOURS = 8;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const raw = await req.text();
    if (raw.length > 4096) return json({ error: 'Request too large.' }, 413);
    const body = raw ? JSON.parse(raw) : {};
    const action = String(body?.action ?? '');
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    if (action === 'unlock') {
      const limited = await enforceRateLimit({
        req, action: 'shadow:unlock', limit: 5, windowSeconds: 900, corsHeaders,
      });
      if (limited) return limited;

      const password = typeof body?.password === 'string' ? body.password : '';
      if (!password || password.length > 64) return json({ error: 'Invalid access code.' }, 401);
      const expected = Deno.env.get('SHADOW_FLIX_PASSWORD') ?? '';
      const matches = expected.length > 0 && timingSafeHexEqual(
        await sha256Hex(password.trim().toUpperCase()),
        await sha256Hex(expected.trim().toUpperCase()),
      );
      if (!matches) return json({ error: 'Invalid access code.' }, 401);

      const accessToken = randomToken();
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
      const { error } = await admin.from('shadow_flix_sessions').insert({
        token_hash: await sha256Hex(accessToken),
        expires_at: expiresAt.toISOString(),
      });
      if (error) return json({ error: 'Could not start the secure session.' }, 500);

      if (Math.random() < 0.05) {
        await admin.from('shadow_flix_sessions').delete().lt('expires_at', new Date().toISOString());
      }
      return json({ access_token: accessToken, expires_at: expiresAt.toISOString() });
    }

    const accessToken = typeof body?.access_token === 'string' ? body.access_token : '';
    if (!/^[0-9a-f]{64}$/.test(accessToken)) return json({ error: 'Secure session required.' }, 401);
    const tokenHash = await sha256Hex(accessToken);

    if (action === 'revoke') {
      await admin.from('shadow_flix_sessions').delete().eq('token_hash', tokenHash);
      return json({ ok: true });
    }

    if (action !== 'list') return json({ error: 'Unsupported action.' }, 400);
    const limited = await enforceRateLimit({
      req, action: 'shadow:list', identity: tokenHash, limit: 240, windowSeconds: 900, corsHeaders,
    });
    if (limited) return limited;

    const { data: session } = await admin
      .from('shadow_flix_sessions')
      .select('id, expires_at')
      .eq('token_hash', tokenHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (!session) return json({ error: 'Secure session expired.' }, 401);

    const { data, error } = await admin
      .from('shadow_flix_content')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return json({ error: 'Could not load the private catalogue.' }, 500);

    await admin.from('shadow_flix_sessions').update({ last_used_at: new Date().toISOString() }).eq('id', session.id);
    return json({ items: data ?? [] });
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
});
