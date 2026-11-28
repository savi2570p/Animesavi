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
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const userAgent = typeof body?.user_agent === 'string' ? body.user_agent.slice(0, 512) : null;
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(token)) return json({ error: 'Invalid or disabled unlock link.' }, 404);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) {
      const { data, error } = await admin.auth.getUser(authHeader.slice(7));
      if (error || !data.user) return json({ error: 'Invalid session.' }, 401);
      userId = data.user.id;
    }

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
