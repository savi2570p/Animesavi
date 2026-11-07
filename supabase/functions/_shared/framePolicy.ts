/**
 * Decides whether a site's response headers allow it to be shown inside an
 * iframe on another origin. Pure function (no Deno APIs) so it can be unit
 * tested from the web app's test suite.
 */
export function isFrameableBy(
  headers: { get(name: string): string | null },
  embedderOrigin: string,
): boolean {
  const xfo = (headers.get('x-frame-options') || '').trim().toLowerCase();
  if (xfo === 'deny' || xfo === 'sameorigin') return false;

  const csp = headers.get('content-security-policy') || '';
  const directive = csp
    .split(',')
    .flatMap((policy) => policy.split(';'))
    .map((d) => d.trim())
    .find((d) => d.toLowerCase().startsWith('frame-ancestors'));

  // frame-ancestors overrides X-Frame-Options when present.
  if (!directive) return true;

  const sources = directive.split(/\s+/).slice(1).map((s) => s.toLowerCase());
  if (sources.includes('*')) return true;

  let host = '';
  let scheme = '';
  try {
    const url = new URL(embedderOrigin);
    host = url.host.toLowerCase();
    scheme = url.protocol.toLowerCase();
  } catch {
    return false;
  }

  return sources.some((src) => {
    if (src === "'none'" || src === "'self'") return false;
    if (src === scheme || src === `${scheme}//*`) return true;
    const bare = src.replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '');
    if (bare === host) return true;
    if (bare.startsWith('*.')) return host.endsWith(bare.slice(1));
    return false;
  });
}
