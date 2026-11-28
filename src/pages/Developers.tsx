import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Play, Webhook, ShieldAlert, Database, RefreshCw, PlugZap, BookOpen, TerminalSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_VERSION, ENDPOINTS, INTEGRATION_PROMPT, PUBLIC_BASE_URL } from '../../supabase/functions/api-hub/contract.ts';
import receiverReference from '../../supabase/functions/api-hub/receiver-reference.ts?raw';
import { SAMPLE_ANIME, SAMPLE_EPISODE, SAMPLE_SEASON, SAMPLE_WEBHOOK } from '@/data/apiHubSamples';

const NAV = [
  ['overview', 'Overview'], ['endpoints', 'Endpoints'], ['schemas', 'Data & samples'], ['pagination', 'Pagination & cursors'],
  ['connect', 'One-click connection'], ['webhooks', 'Webhooks'], ['sync', 'Retries & deletions'], ['security', 'Security'],
  ['tester', 'API tester'], ['prompt', 'Integration prompt'],
] as const;

const SAFE_TESTS = [
  { label: 'Health', path: '/v1/health' },
  { label: 'Catalogue totals', path: '/v1/catalog/stats' },
  { label: 'Anime page (5)', path: '/v1/catalog/anime?limit=5' },
  { label: 'Seasons page (5)', path: '/v1/catalog/seasons?limit=5' },
  { label: 'Episodes page (5)', path: '/v1/catalog/episodes?limit=5' },
  { label: 'One anime + episodes', path: `/v1/anime/${SAMPLE_ANIME.id}` },
  { label: 'Change feed head', path: '/v1/changes/head' },
] as const;

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <Button variant="glass" size="sm" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); }}>
    {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{done ? 'Copied' : label}
  </Button>;
}

function Code({ children, max = 'max-h-96' }: { children: string; max?: string }) {
  return <pre className={`dev-code mt-3 ${max} overflow-auto rounded-lg border border-border bg-muted/40 p-4 text-[12px] leading-relaxed text-foreground/90`}><code>{children}</code></pre>;
}

function Section({ id, icon: Icon, title, children }: { id: string; icon: typeof BookOpen; title: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-24 py-8 border-b border-border">
    <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{title}</h2>
    <div className="mt-3 text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </section>;
}

const pretty = (v: unknown) => JSON.stringify(v, null, 2);

export default function Developers() {
  const [testPath, setTestPath] = useState<string>(SAFE_TESTS[0].path);
  const [result, setResult] = useState<{ status: number; ms: number; body: string } | null>(null);
  const [running, setRunning] = useState(false);
  const curlExample = useMemo(() => `curl "${PUBLIC_BASE_URL}/v1/catalog/anime?limit=100"`, []);

  async function runTest() {
    setRunning(true);
    const t0 = performance.now();
    try {
      const res = await fetch(PUBLIC_BASE_URL + testPath, { method: 'GET' });
      const text = await res.text();
      let body = text;
      try { body = pretty(JSON.parse(text)); } catch { /* keep raw */ }
      setResult({ status: res.status, ms: Math.round(performance.now() - t0), body: body.length > 30000 ? body.slice(0, 30000) + '\n… (truncated)' : body });
    } catch (e) {
      setResult({ status: 0, ms: Math.round(performance.now() - t0), body: `Request failed: ${(e as Error).message}` });
    } finally { setRunning(false); }
  }

  return <main className="developers-page min-h-screen">
    <div className="container max-w-6xl py-6 sm:py-10">
      <header className="py-8 sm:py-10 border-b border-border">
        <span className="text-xs font-semibold text-primary">AnimeSavi API Hub · v{API_VERSION}</span>
        <h1 className="text-3xl sm:text-4xl font-bold mt-3">Developers</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mt-3 max-w-2xl">
          A public, read-only API that lets any website keep a full, automatic mirror of the published AnimeSavi+ catalogue — anime, seasons and episodes — with signed webhooks for near-instant updates and a change feed as backup.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <code className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs break-all">{PUBLIC_BASE_URL}</code>
          <CopyButton text={PUBLIC_BASE_URL} label="Copy base URL" />
          <Button variant="glass" size="sm" asChild><a href={`${PUBLIC_BASE_URL}/v1/openapi.json`} target="_blank" rel="noopener noreferrer">OpenAPI schema</a></Button>
          <Button size="sm" asChild><a href="#prompt"><Sparkles className="h-3.5 w-3.5" />Integration prompt</a></Button>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-24 py-8 space-y-1 text-xs">
            {NAV.map(([id, label]) => <li key={id}><a href={`#${id}`} className="block py-1.5 text-muted-foreground hover:text-primary transition-colors">{label}</a></li>)}
          </ul>
        </nav>

        <div className="min-w-0">
          <Section id="overview" icon={BookOpen} title="What the API does">
            <p>AnimeSavi+ is the single source of truth. Receiving websites import the published catalogue once, then stay in sync automatically:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b className="text-foreground">Keyless reads</b> — every catalogue endpoint is public. No API key, no login.</li>
              <li><b className="text-foreground">Permanent IDs</b> — anime, seasons and episodes use their permanent AnimeSavi UUIDs; they never change when titles change.</li>
              <li><b className="text-foreground">Webhooks first</b> — connected sites get signed change events seconds after an edit.</li>
              <li><b className="text-foreground">Change feed backup</b> — a cursor-based feed lets any site catch up after downtime.</li>
              <li><b className="text-foreground">What's included</b> — the published catalogue. MuseIN titles, upcoming seasons and episodes without a video are not part of it.</li>
            </ul>
            <Code max="max-h-40">{curlExample}</Code>
          </Section>

          <Section id="endpoints" icon={TerminalSquare} title="Endpoints">
            <div className="overflow-x-auto -mx-1"><table className="w-full text-xs mt-1">
              <thead><tr className="text-left text-foreground"><th className="py-2 px-1 font-semibold">Method</th><th className="py-2 px-1 font-semibold">Path</th><th className="py-2 px-1 font-semibold">Auth</th><th className="py-2 px-1 font-semibold">Purpose</th></tr></thead>
              <tbody>{ENDPOINTS.map((e) => <tr key={e.method + e.path} className="border-t border-border align-top">
                <td className="py-2 px-1 font-mono text-primary">{e.method}</td><td className="py-2 px-1 font-mono text-foreground whitespace-nowrap">{e.path}</td>
                <td className="py-2 px-1">{e.auth === 'none' ? 'Public' : e.auth === 'signed' ? 'Signed' : 'Challenge'}</td><td className="py-2 px-1">{e.summary}</td></tr>)}</tbody>
            </table></div>
            <p>All responses are JSON with <code>api_version</code>. Errors look like <code>{'{"error":{"code":"…","message":"…"}}'}</code>. A <code>503 source_unavailable</code> or any timeout is temporary — never a deletion signal.</p>
          </Section>

          <Section id="schemas" icon={Database} title="Data & sample JSON">
            <p>Samples below are trimmed real responses. <code>revision</code> is a monotonic integer sent as a string — compare it as a big integer. <code>visibility</code> is always <code>published</code>; <code>release.status</code> (ongoing/completed) is a separate thing.</p>
            <h3 className="text-sm font-semibold text-foreground pt-2">Anime</h3><Code>{pretty(SAMPLE_ANIME)}</Code>
            <h3 className="text-sm font-semibold text-foreground pt-2">Season</h3><Code>{pretty(SAMPLE_SEASON)}</Code>
            <h3 className="text-sm font-semibold text-foreground pt-2">Episode</h3><Code>{pretty(SAMPLE_EPISODE)}</Code>
          </Section>

          <Section id="pagination" icon={RefreshCw} title="Pagination & cursors">
            <ul className="list-disc pl-5 space-y-1">
              <li>Catalogue lists are ordered by id. Pass <code>limit</code> (max 200) and follow <code>page.next_cursor</code> until <code>has_more</code> is false.</li>
              <li>The <b className="text-foreground">first</b> page includes <code>changes_cursor</code>. Save it, finish the import, then read <code>/v1/changes?cursor=…</code> from it.</li>
              <li>Validate your import against <code>/v1/catalog/stats</code> before removing anything locally.</li>
              <li>The change feed only serves fully committed changes in order, so a cursor never skips an edit. Cursors older than 30 days return <code>410 cursor_expired</code> → run a full import again.</li>
              <li>Responses carry <code>ETag</code> and <code>Cache-Control</code>; send <code>If-None-Match</code> to get <code>304</code> when nothing changed.</li>
            </ul>
          </Section>

          <Section id="connect" icon={PlugZap} title="One-click connection protocol">
            <ol className="list-decimal pl-5 space-y-1">
              <li>An admin of the receiving site clicks <b className="text-foreground">Connect AnimeSavi</b> in that site's own admin panel.</li>
              <li>Its server creates a single-use challenge (≥ 32 random URL-safe characters, 10-minute expiry).</li>
              <li>The site publishes a DNS TXT record <code>_animesavi-hub.&lt;webhook host&gt;</code> whose value is the lowercase SHA-256 hex of the challenge. The Hub checks it before contacting the site.</li>
              <li>Its server calls <code>POST /v1/connections/pair</code> with <code>site_name</code>, <code>site_origin</code>, <code>webhook_url</code> and <code>challenge</code>.</li>
              <li>The Hub calls the webhook URL with <code>{'{"type":"animesavi.verification","challenge","hub_nonce"}'}</code>; the site must echo both values with HTTP 200.</li>
              <li>Approved automatically. The response returns <code>connection_id</code> and a unique <code>webhook_secret</code> (shown once — store it server-side only).</li>
            </ol>
            <p>Webhook URLs must be HTTPS on port 443, on a public domain equal to <code>site_origin</code> or its subdomain. Localhost, private/internal addresses, cloud metadata addresses and raw IPs are rejected, DNS is re-checked before every request and redirects are not followed. Pairing is rate-limited.</p>
            <p>Management requests (<code>/v1/connections/me</code>, <code>/test</code>, <code>/resume</code>, <code>/rotate-secret</code>, <code>/disconnect</code>) are signed with the connection secret plus a timestamp and single-use nonce. A secret can only manage its own connection; it can never change AnimeSavi content.</p>
          </Section>

          <Section id="webhooks" icon={Webhook} title="Webhooks & signature verification">
            <p>Each delivery is a batch of events. Verify <code>X-AnimeSavi-Signature: t=…,v1=…</code> = hex HMAC-SHA256 of <code>{'`${t}.${raw_body}`'}</code> with your secret, within 5 minutes. During secret rotation two <code>v1</code> values are sent for 24 hours.</p>
            <Code max="max-h-72">{`// Node / edge runtime
import crypto from 'node:crypto'
export function verify(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')))
  const sigs = header.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3))
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false
  const expected = crypto.createHmac('sha256', secret).update(\`\${parts.t}.\${rawBody}\`).digest('hex')
  return sigs.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)))
}

// PHP
// $ok = hash_equals(hash_hmac('sha256', "$t.$rawBody", $secret), $v1) && abs(time() - $t) <= 300;`}</Code>
            <h3 className="text-sm font-semibold text-foreground pt-2">Real delivery (trimmed)</h3><Code>{pretty(SAMPLE_WEBHOOK)}</Code>
            <p>Reply <b className="text-foreground">2xx only after</b> you have safely stored the events. Every event carries the <b className="text-foreground">current</b> public record, so late or repeated deliveries never bring back old data.</p>
          </Section>

          <Section id="sync" icon={RefreshCw} title="Retries, ordering & deletions">
            <ul className="list-disc pl-5 space-y-1">
              <li>First attempt immediately; then exponential backoff with jitter for about a day, then every 12 hours. One failing site never delays others.</li>
              <li>Deduplicate on <code>event_id</code>. Apply an upsert only if its <code>revision</code> is ≥ what you stored.</li>
              <li><code>unpublish</code> and <code>delete</code> remove the item (anime → its seasons and episodes). Keep tombstones; deleted ids are never reused.</li>
              <li>Only a complete, validated snapshot or a confirmed <code>unpublish</code>/<code>delete</code> event may remove data. Timeouts, errors and partial pages never do.</li>
              <li>Poll <code>/v1/changes</code> every ~5 minutes with jitter as a backup. Change history is kept for 30 days.</li>
            </ul>
            <details className="pt-2"><summary className="cursor-pointer text-foreground text-sm font-semibold">Reference receiver logic (TypeScript)</summary><Code>{receiverReference}</Code></details>
          </Section>

          <Section id="security" icon={ShieldAlert} title="Security & public video links">
            <p className="text-foreground"><b>Public access means anyone can retrieve the video and stream URLs in this API.</b> They are included on purpose so receiving sites can play episodes.</p>
            <p>The API never exposes drafts, MuseIN titles, user accounts, tokens, admin data, storage credentials or server keys. CORS is enabled for convenience and is not a security boundary. Fair use is about 300 requests per minute per IP — cache responses and use the change feed instead of re-downloading the catalogue.</p>
          </Section>

          <Section id="tester" icon={Play} title="API tester (read-only)">
            <p>Runs safe <code>GET</code> requests against the live API from your browser.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {SAFE_TESTS.map((t) => <Button key={t.path} size="sm" variant={testPath === t.path ? 'default' : 'glass'} onClick={() => setTestPath(t.path)}>{t.label}</Button>)}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <code className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs break-all">GET {testPath}</code>
              <Button size="sm" onClick={runTest} disabled={running}><Play className="h-3.5 w-3.5" />{running ? 'Running…' : 'Send request'}</Button>
            </div>
            {result && <div aria-live="polite"><p className="pt-2 text-xs"><span className={result.status >= 200 && result.status < 300 ? 'text-primary' : 'text-destructive'}>HTTP {result.status || 'error'}</span> · {result.ms} ms</p><Code>{result.body}</Code></div>}
          </Section>

          <Section id="prompt" icon={Sparkles} title="Universal Integration Prompt">
            <p>Paste this into Lovable, Bolt, Replit, Cursor or any AI builder working on the receiving website. It is generated from the same file the API serves at <code>/v1/integration-prompt</code>, so it always matches the live API.</p>
            <div className="flex flex-wrap gap-2"><CopyButton text={INTEGRATION_PROMPT} label="Copy prompt" />
              <Button variant="glass" size="sm" asChild><a href={`${PUBLIC_BASE_URL}/v1/integration-prompt`} target="_blank" rel="noopener noreferrer">Open as Markdown</a></Button></div>
            <Code max="max-h-[32rem]">{INTEGRATION_PROMPT}</Code>
          </Section>

          <p className="py-8 text-xs text-muted-foreground">Questions? Reach us on <a className="text-primary" href="https://t.me/Lv_Savi" target="_blank" rel="noopener noreferrer">Telegram</a> · <Link className="text-primary" to="/">Back to AnimeSavi+</Link></p>
        </div>
      </div>
    </div>
  </main>;
}
