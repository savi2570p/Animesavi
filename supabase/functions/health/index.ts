import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { corsHeaders, jsonOk, jsonError, log, requestId, withTimeout } from '../_shared/http.ts';

/**
 * Real dependency health checks — never a hardcoded "OK".
 *   GET /health            → database + storage + auth
 *   GET /health/database
 *   GET /health/storage
 * Also runs stuck-job recovery on demand: POST /health?action=recover-jobs
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function timed<T>(label: string, fn: () => Promise<T>, ms = 5000) {
  const start = Date.now();
  try {
    await withTimeout(fn(), ms, label);
    return { name: label, status: 'up' as const, duration_ms: Date.now() - start };
  } catch (err) {
    return {
      name: label,
      status: 'down' as const,
      duration_ms: Date.now() - start,
      error: (err as Error).message?.slice(0, 200),
    };
  }
}

const checkDatabase = () =>
  timed('database', async () => {
    const { error } = await admin().from('anime').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) throw error;
  });

const checkStorage = () =>
  timed('storage', async () => {
    const { error } = await admin().storage.from('anime-videos').list('', { limit: 1 });
    if (error) throw error;
  });

const checkAuth = () =>
  timed('auth', async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SERVICE_KEY } });
    if (!res.ok) throw new Error(`auth health ${res.status}`);
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const reqId = requestId(req);
  const started = Date.now();
  const url = new URL(req.url);
  const scope = url.pathname.replace(/\/+$/, '').split('/').pop() || 'health';

  try {
    if (req.method === 'POST' && url.searchParams.get('action') === 'recover-jobs') {
      const staleMinutes = Number(url.searchParams.get('stale_minutes') ?? 30);
      const { data, error } = await admin().rpc('recover_stuck_conversions', {
        _stale_minutes: Number.isFinite(staleMinutes) ? staleMinutes : 30,
      });
      if (error) return jsonError('DATABASE_ERROR', 'Job recovery failed', reqId, error);
      log({ request_id: reqId, operation: 'recover-jobs', status: 'ok', result: data });
      return jsonOk({ recovered: data }, reqId);
    }

    let checks;
    if (scope === 'database') checks = [await checkDatabase()];
    else if (scope === 'storage') checks = [await checkStorage()];
    else checks = await Promise.all([checkDatabase(), checkStorage(), checkAuth()]);

    const healthy = checks.every((c) => c.status === 'up');
    log({
      request_id: reqId,
      operation: `health:${scope}`,
      status: healthy ? 'healthy' : 'degraded',
      duration_ms: Date.now() - started,
    });

    if (!healthy) {
      return new Response(
        JSON.stringify({ success: false, request_id: reqId, data: { healthy, checks } }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    return jsonOk({ healthy, checks }, reqId);
  } catch (err) {
    return jsonError('INTERNAL_ERROR', 'Health check failed', reqId, err);
  }
});
