// Same-origin proxy for downloads that are blocked by CORS.
// Streams the upstream response back to the client with proper CORS headers,
// preserving Range requests so resume / seeking works.

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response(JSON.stringify({ error: 'Missing url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers: Record<string, string> = {};
    const range = req.headers.get('range');
    if (range) headers['Range'] = range;

    const upstream = await fetch(target, { method: req.method, headers });

    const respHeaders = new Headers(corsHeaders);
    for (const h of ['content-length', 'content-range', 'accept-ranges', 'content-type', 'last-modified', 'etag']) {
      const v = upstream.headers.get(h);
      if (v) respHeaders.set(h, v);
    }
    // Force download disposition where possible
    const fname = url.searchParams.get('filename');
    if (fname) respHeaders.set('content-disposition', `attachment; filename="${fname.replace(/"/g, '')}"`);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
