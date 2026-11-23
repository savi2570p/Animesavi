// Pure helpers shared by the API Hub edge function, its tests and the docs.
// No Deno- or Node-specific imports: only Web Crypto + URL, so the same code
// runs in the edge runtime, in Vitest and in the browser.

const enc = new TextEncoder()

// ---------- base64url ----------
export function b64urlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? enc.encode(input) : input
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecodeToString(input: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) return null
  try {
    const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
    const bin = atob(input.replace(/-/g, '+').replace(/_/g, '/') + pad)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

export function randomToken(bytes = 32): string {
  const b = new Uint8Array(bytes)
  crypto.getRandomValues(b)
  return b64urlEncode(b)
}

// ---------- cursors ----------
export interface ChangeCursor { tx: string; seq: number }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

export function encodeChangeCursor(c: ChangeCursor): string {
  return 'c1.' + b64urlEncode(`${c.tx}:${c.seq}`)
}

export function decodeChangeCursor(raw: string | null | undefined): ChangeCursor | null {
  if (!raw || raw.length > 200 || !raw.startsWith('c1.')) return null
  const s = b64urlDecodeToString(raw.slice(3))
  const m = s ? /^(\d{1,20}):(\d{1,18})$/.exec(s) : null
  if (!m) return null
  return { tx: m[1], seq: Number(m[2]) }
}

/** -1 if a < b, 0 if equal, 1 if a > b (ordered by transaction, then sequence). */
export function compareChangeCursor(a: ChangeCursor, b: ChangeCursor): number {
  const ta = BigInt(a.tx), tb = BigInt(b.tx)
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.seq === b.seq ? 0 : a.seq < b.seq ? -1 : 1
}

export type PageKind = 'anime' | 'seasons' | 'episodes'

export function encodePageCursor(kind: PageKind, lastId: string): string {
  return 'p1.' + b64urlEncode(`${kind}:${lastId}`)
}

export function decodePageCursor(kind: PageKind, raw: string | null | undefined): string | null {
  if (!raw || raw.length > 200 || !raw.startsWith('p1.')) return null
  const s = b64urlDecodeToString(raw.slice(3))
  if (!s) return null
  const idx = s.indexOf(':')
  if (idx < 0 || s.slice(0, idx) !== kind) return null
  const id = s.slice(idx + 1)
  return isUuid(id) ? id.toLowerCase() : null
}

export function clampLimit(raw: string | null, def: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n) || n < 1) return def
  return Math.min(n, max)
}

// ---------- HMAC signatures ----------
async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(message: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(message))
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Webhook header: `t=<unix seconds>,v1=<hex>[,v1=<hex>]` signed over `${t}.${rawBody}`. */
export async function signWebhookBody(rawBody: string, secrets: string[], timestampSec: number): Promise<string> {
  const parts = [`t=${timestampSec}`]
  for (const s of secrets) parts.push(`v1=${await hmacHex(s, `${timestampSec}.${rawBody}`)}`)
  return parts.join(',')
}

export async function verifyWebhookSignature(
  header: string | null,
  rawBody: string,
  secret: string,
  nowSec: number,
  toleranceSec = 300,
): Promise<boolean> {
  if (!header) return false
  let t: number | null = null
  const sigs: string[] = []
  for (const part of header.split(',')) {
    const [k, v] = part.trim().split('=', 2)
    if (k === 't' && /^\d{1,12}$/.test(v ?? '')) t = Number(v)
    if (k === 'v1' && /^[0-9a-f]{64}$/.test(v ?? '')) sigs.push(v)
  }
  if (t === null || !sigs.length || Math.abs(nowSec - t) > toleranceSec) return false
  const expected = await hmacHex(secret, `${t}.${rawBody}`)
  return sigs.some((s) => timingSafeEqualStr(s, expected))
}

/** String signed by receivers for connection-management requests. */
export function managementMessage(timestampSec: string, nonce: string, method: string, path: string, rawBody: string) {
  return `${timestampSec}.${nonce}.${method.toUpperCase()}.${path}.${rawBody}`
}

// ---------- outbound URL safety (SSRF guard) ----------
function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return null
  const o = m.slice(1).map(Number)
  if (o.some((x) => x > 255)) return null
  return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3]
}

const V4_BLOCKS: Array<[string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]

function v4IsPublic(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return false
  for (const [base, bits] of V4_BLOCKS) {
    const b = ipv4ToInt(base)!
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
    if (((n & mask) >>> 0) === ((b & mask) >>> 0)) return false
  }
  return true
}

function expandIpv6(ip: string): number[] | null {
  let s = ip.toLowerCase()
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1)
  if (s.includes('%')) return null
  // Embedded IPv4 tail (::ffff:1.2.3.4)
  const v4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s)
  if (v4) {
    const n = ipv4ToInt(v4[1])
    if (n === null) return null
    s = s.slice(0, -v4[1].length) + ((n >>> 16) & 0xffff).toString(16) + ':' + (n & 0xffff).toString(16)
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 && missing !== 0) return null
  if (missing < 0) return null
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.map((g) => parseInt(g, 16))
}

function v6IsPublic(ip: string): boolean {
  const g = expandIpv6(ip)
  if (!g) return false
  if (g.every((x) => x === 0)) return false // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return false // ::1
  // IPv4-mapped / translated / compatible: judge the embedded IPv4 address.
  const embedded = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) return v4IsPublic(embedded)
  if (g[0] === 0x64 && g[1] === 0xff9b) return v4IsPublic(embedded)
  if ((g[0] & 0xfe00) === 0xfc00) return false // fc00::/7 unique local (incl. fd00:ec2::254 metadata)
  if ((g[0] & 0xffc0) === 0xfe80) return false // link-local
  if ((g[0] & 0xff00) === 0xff00) return false // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false // documentation
  if (g[0] === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return false // discard
  if (g[0] === 0x2002) return v4IsPublic(`${g[1] >> 8}.${g[1] & 255}.${g[2] >> 8}.${g[2] & 255}`) // 6to4
  return (g[0] & 0xe000) === 0x2000 // only global unicast 2000::/3
}

export function isPublicIp(ip: string): boolean {
  return ip.includes(':') ? v6IsPublic(ip) : v4IsPublic(ip)
}

export const isIpLiteral = (host: string) =>
  ipv4ToInt(host) !== null || host.includes(':') || (host.startsWith('[') && host.endsWith(']'))

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.home.arpa', '.corp', '.intranet', '.localdomain', '.test', '.invalid', '.example']
const BLOCKED_HOSTS = new Set(['localhost', 'metadata', 'metadata.google.internal', 'instance-data', 'kubernetes.default'])

export type TargetCheck =
  | { ok: true; origin: string; host: string; webhookUrl: string }
  | { ok: false; code: string; message: string }

/**
 * Static validation of a receiver origin + webhook URL. DNS is checked separately
 * (and again before every outbound request) by the edge function.
 */
export function validateReceiverTarget(siteOrigin: unknown, webhookUrl: unknown, opts: { allowHttp?: boolean } = {}): TargetCheck {
  const bad = (code: string, message: string): TargetCheck => ({ ok: false, code, message })
  if (typeof siteOrigin !== 'string' || typeof webhookUrl !== 'string') return bad('invalid_request', 'site_origin and webhook_url are required strings.')
  if (siteOrigin.length > 300 || webhookUrl.length > 2048) return bad('invalid_url', 'URL is too long.')
  let o: URL, w: URL
  try { o = new URL(siteOrigin); w = new URL(webhookUrl) } catch { return bad('invalid_url', 'site_origin and webhook_url must be absolute URLs.') }
  const allowed = opts.allowHttp ? ['https:', 'http:'] : ['https:']
  if (!allowed.includes(o.protocol) || !allowed.includes(w.protocol)) return bad('https_required', 'Both URLs must use HTTPS.')
  if (o.username || o.password || w.username || w.password) return bad('invalid_url', 'URLs must not contain credentials.')
  if ((o.pathname !== '/' && o.pathname !== '') || o.search || o.hash) return bad('invalid_origin', 'site_origin must be an origin only, e.g. https://example.com')
  if (w.hash) return bad('invalid_url', 'webhook_url must not contain a fragment.')
  for (const u of [o, w]) {
    if (u.port && u.port !== '443') return bad('unsafe_port', 'Only the default HTTPS port (443) is allowed.')
    const host = u.hostname.toLowerCase().replace(/\.$/, '')
    if (BLOCKED_HOSTS.has(host) || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return bad('unsafe_host', 'Local, internal or reserved hostnames are not allowed.')
    if (isIpLiteral(host)) {
      if (!isPublicIp(host)) return bad('unsafe_host', 'Private, loopback, link-local and metadata IP addresses are not allowed.')
      return bad('hostname_required', 'Use a public domain name, not a raw IP address.')
    }
    if (!host.includes('.') || !/^[a-z0-9.-]+$/.test(host)) return bad('unsafe_host', 'Hostname must be a public domain name.')
  }
  const oh = o.hostname.toLowerCase().replace(/\.$/, '')
  const wh = w.hostname.toLowerCase().replace(/\.$/, '')
  if (wh !== oh && !wh.endsWith('.' + oh)) return bad('origin_mismatch', 'webhook_url must be on site_origin or one of its subdomains.')
  return { ok: true, origin: o.origin, host: wh, webhookUrl: w.toString() }
}

export function sanitizeSiteName(v: unknown): string | null {
  if (typeof v !== 'string') return null
  // deno-lint-ignore no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 80)
  return s.length >= 2 ? s : null
}

export const CHALLENGE_RE = /^[A-Za-z0-9_-]{32,256}$/

/** Exponential backoff with ±20% jitter (seconds), capped at 6 hours. Mirrors hub_record_delivery_failure. */
export function backoffSeconds(attempt: number, rand = Math.random()): number {
  const base = Math.min(Math.pow(2, attempt) * 15, 21600)
  return base * (0.8 + rand * 0.4)
}
