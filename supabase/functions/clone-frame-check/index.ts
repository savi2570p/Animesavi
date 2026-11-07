import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { corsHeaders, jsonError, jsonOk, requestId, withTimeout } from '../_shared/http.ts';
import { isFrameableBy } from '../_shared/framePolicy.ts';

/**
 * Reports whether a clone platform's site allows being shown inside
 * AnimeSavi. Only looks up URLs saved in clone_platforms (never arbitrary
 * URLs), and only reads headers — it never relays the site's content.
 *   POST { slug, origin } -> { embeddable: boolean | null }
 * `null` means the check could not finish; the client keeps the normal view.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const reqId = requestId(req);

  let body: { slug?: unknown; origin?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError('VALIDATION_ERROR', 'Invalid JSON body', reqId);
  }
  const slug = typeof body.slug === 'string' ? body.slug.trim().slice(0, 80) : '';
  const origin = typeof body.origin === 'string' ? body.origin.slice(0, 200) : '';
  if (!slug || !/^https?:\/\//i.test(origin)) {
    return jsonError('VALIDATION_ERROR', 'slug and origin are required', reqId);
  }

  const db = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: row, error } = await db
    .from('clone_platforms')
    .select('target_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) return jsonError('DATABASE_ERROR', 'Lookup failed', reqId, error);
  if (!row?.target_url) return jsonError('NOT_FOUND', 'Platform not found', reqId);

  try {
    const res = await withTimeout(
      fetch(row.target_url, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html' } }),
      6000,
      'frame check',
    );
    // Headers are all we need; drop the body.
    res.body?.cancel().catch(() => {});
    return jsonOk({ embeddable: isFrameableBy(res.headers, origin) }, reqId);
  } catch {
    return jsonOk({ embeddable: null }, reqId);
  }
});
