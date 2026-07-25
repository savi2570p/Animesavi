import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const GATEWAY_BASE = 'https://connector-gateway.lovable.dev/google_search_console';
const SITE_IDENTIFIER = 'https://animesavi.com/';
const ENCODED_SITE = encodeURIComponent(SITE_IDENTIFIER);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Require an authenticated admin caller — this proxies the workspace GSC
  // credentials, so it must never be publicly invokable.
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const authed = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await authed.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );
    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: claimsData.claims.sub,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);
  } catch {
    return json({ error: 'Unauthorized' }, 401);
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const GSC_KEY = Deno.env.get('GOOGLE_SEARCH_CONSOLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return json({ error: 'LOVABLE_API_KEY missing' }, 500);
  }
  if (!GSC_KEY) {
    return json({ error: 'GOOGLE_SEARCH_CONSOLE_API_KEY missing — connect Google Search Console' }, 500);
  }

  const headers = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': GSC_KEY,
  };

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'status';

    if (action === 'verify') {
      // Trigger Google to fetch the meta tag and verify
      const r = await fetch(
        `${GATEWAY_BASE}/siteVerification/v1/webResource?verificationMethod=META`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ site: { identifier: SITE_IDENTIFIER, type: 'SITE' } }),
        }
      );
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return json({ verified: false, status: r.status, error: body }, 200);

      // Try to add to Search Console properties (idempotent)
      await fetch(`${GATEWAY_BASE}/webmasters/v3/sites/${ENCODED_SITE}`, {
        method: 'PUT',
        headers,
      }).catch(() => {});

      return json({ verified: true, addedToSearchConsole: true, detail: body }, 200);
    }

    // Default: status check — does the site exist in webmasters AND is it verified?
    const [siteRes, webRes] = await Promise.all([
      fetch(`${GATEWAY_BASE}/webmasters/v3/sites/${ENCODED_SITE}`, { headers }),
      fetch(`${GATEWAY_BASE}/siteVerification/v1/webResource/${ENCODED_SITE}`, { headers }),
    ]);

    const siteBody = await siteRes.json().catch(() => null);
    const webBody = await webRes.json().catch(() => null);

    const inSearchConsole = siteRes.ok;
    const isVerified = webRes.ok && Array.isArray(webBody?.owners) && webBody.owners.length > 0;

    return json(
      {
        site: SITE_IDENTIFIER,
        verified: isVerified,
        inSearchConsole,
        permissionLevel: siteBody?.permissionLevel ?? null,
        verificationMethod: webBody?.site?.type ?? null,
        owners: webBody?.owners ?? [],
        rawSiteStatus: siteRes.status,
        rawVerifyStatus: webRes.status,
      },
      200
    );
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
