import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const limited = await enforceRateLimit({
    req, action: 'token:redeem', limit: 10, windowSeconds: 900, corsHeaders,
  });
  if (limited) return limited;

  try {
    const raw = await req.text();
    if (raw.length > 4096) return json({ error: 'Request too large.' }, 413);
    const body = raw ? JSON.parse(raw) : {};
    const action = typeof body?.action === 'string' ? body.action : 'redeem';
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const isPublishableBearer = bearer === Deno.env.get('SUPABASE_ANON_KEY') || bearer.startsWith('sb_publishable_');
    if (bearer && !isPublishableBearer) {
      const { data, error } = await admin.auth.getUser(bearer);
      if (error || !data.user) return json({ error: 'Invalid session.' }, 401);
      userId = data.user.id;
    }

    if (action === 'claim') {
      if (!userId) return json({ error: 'Authentication required.' }, 401);
      const tokenId = typeof body?.token_id === 'string' ? body.token_id : '';
      const expiresAt = Number(body?.expires_at);
      if (!/^[0-9a-f-]{36}$/i.test(tokenId) || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
        return json({ error: 'Invalid local access claim.' }, 400);
      }

      const { data: existing } = await admin.from('token_usage').select('id')
        .eq('token_id', tokenId).eq('user_id', userId).limit(1).maybeSingle();
      if (existing) return json({ ok: true });

      const { data: unlockToken } = await admin.from('unlock_tokens').select('id')
        .eq('id', tokenId).eq('is_active', true).neq('token', '__system_toggle__').maybeSingle();
      if (!unlockToken) return json({ error: 'This access link is no longer active.' }, 403);

      // Claim only a real anonymous redemption with the exact server-issued
      // expiry. Callers cannot choose a token ID or manufacture a duration.
      const { data: anonymousUse } = await admin.from('token_usage').select('id')
        .eq('token_id', tokenId).is('user_id', null).eq('expires_at', expiresAt)
        .order('used_at', { ascending: false }).limit(1).maybeSingle();
      if (!anonymousUse) return json({ error: 'No matching anonymous redemption found.' }, 404);

      const { error } = await admin.from('token_usage').update({ user_id: userId }).eq('id', anonymousUse.id);
      if (error) return json({ error: 'Could not sync access.' }, 500);
      return json({ ok: true });
    }

    if (action !== 'redeem') return json({ error: 'Unsupported action.' }, 400);
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const userAgent = typeof body?.user_agent === 'string' ? body.user_agent.slice(0, 512) : null;
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(token)) return json({ error: 'Invalid or disabled unlock link.' }, 404);

    const { data, error } = await admin.rpc('redeem_unlock_token', {
      _token: token,
      _user_id: userId,
      _user_agent: userAgent,
    });
    if (error) return json({ error: 'Verification failed. Please try again.' }, 500);
    const redeemed = Array.isArray(data) ? data[0] : null;
    if (!redeemed) return json({ error: 'Invalid or disabled unlock link.' }, 404);
    return json(redeemed);
  } catch {
    return json({ error: 'Invalid verification request.' }, 400);
  }
});
