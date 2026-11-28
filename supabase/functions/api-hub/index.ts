// AnimeSavi API Hub — public read-only catalogue + signed webhook sync for receiving sites.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { authenticateCronRequest } from '../_shared/cron-auth.ts'
import {
  CHALLENGE_RE, clampLimit, compareChangeCursor, decodeChangeCursor, decodePageCursor, encodeChangeCursor,
  encodePageCursor, isPublicIp, isUuid, managementMessage, hmacHex, randomToken, sanitizeSiteName, sha256Hex,
  signWebhookBody, timingSafeEqualStr, validateReceiverTarget, type ChangeCursor, type PageKind,
} from './lib.ts'
import { ANIME_COLUMNS, EPISODE_COLUMNS, SEASON_COLUMNS, mapAnime, mapEpisode, mapSeason } from './records.ts'
import { API_VERSION, PUBLIC_BASE_URL, INTEGRATION_PROMPT, buildOpenApi } from './contract.ts'

const MAX_PAGE = 200
const DEFAULT_PAGE = 100
const DELIVERY_BATCH = 50
const DELIVERY_TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 12
const SECRET_GRACE_HOURS = 24
const MGMT_TOLERANCE_SEC = 300

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, if-none-match, x-animesavi-connection, x-animesavi-timestamp, x-animesavi-nonce, x-animesavi-signature',
  'Access-Control-Expose-Headers': 'etag, x-animesavi-api-version, retry-after',
  'Access-Control-Max-Age': '86400',
}

let _db: SupabaseClient | null = null
const db = () =>
  (_db ??= createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }))

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message)
  }
}

function baseHeaders(extra: Record<string, string> = {}) {
  return { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'X-AnimeSavi-Api-Version': API_VERSION, ...extra }
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: baseHeaders({ 'Cache-Control': 'no-store', ...extra }) })
}

function errorResponse(e: HttpError) {
  const extra: Record<string, string> = {}
  if (e.status === 429 || e.status === 503) extra['Retry-After'] = String(e.extra.retry_after ?? 30)
  return json({ api_version: API_VERSION, error: { code: e.code, message: e.message, ...e.extra } }, e.status, extra)
}

/** Cacheable JSON with a weak ETag and conditional-request support. */
async function cached(req: Request, body: unknown, maxAge: number) {
  const text = JSON.stringify(body)
  // Volatile fields (generation time, "now" cursor) are excluded so unchanged data revalidates with 304.
  const { generated_at: _g, changes_cursor: _c, ...stable } = (body ?? {}) as Record<string, unknown>
  const etag = `W/"${(await sha256Hex(JSON.stringify(stable))).slice(0, 32)}"`
  const cache = `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`
  const inm = req.headers.get('if-none-match')
  if (inm && inm.split(',').map((s) => s.trim()).includes(etag)) {
    return new Response(null, { status: 304, headers: { ...CORS, ETag: etag, 'Cache-Control': cache, 'X-AnimeSavi-Api-Version': API_VERSION } })
  }
  return new Response(text, { status: 200, headers: baseHeaders({ ETag: etag, 'Cache-Control': cache }) })
}

// ---------- lightweight per-isolate read limiter (fair use; CDN caching does the heavy lifting) ----------
const readBuckets = new Map<string, { n: number; start: number }>()
function clientIp(req: Request) {
  return (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim().slice(0, 64)
}
function readLimit(req: Request) {
  const ip = clientIp(req)
  const now = Date.now()
  const b = readBuckets.get(ip)
  if (!b || now - b.start > 60_000) {
    readBuckets.set(ip, { n: 1, start: now })
    if (readBuckets.size > 5000) readBuckets.clear()
    return
  }
  if (++b.n > 300) throw new HttpError(429, 'rate_limited', 'Too many requests. Fair use is 300 requests per minute per IP; cache responses and use the change feed.', { retry_after: 60 })
}

function dbFail(error: { message?: string; code?: string } | null, what: string): never {
  console.error(`[api-hub] ${what}:`, error?.code, error?.message)
  throw new HttpError(503, 'source_unavailable', `The AnimeSavi source is temporarily unavailable (${what}). Retry later; this is NOT a deletion signal.`, { retryable: true, retry_after: 30 })
}

// ---------- change feed head ----------
async function head(): Promise<{ cursor: ChangeCursor; pruned: ChangeCursor | null }> {
  const { data, error } = await db().rpc('hub_head')
  if (error || !data?.[0]) dbFail(error, 'head')
  const r = data[0]
  return {
    cursor: { tx: String(r.tx_id), seq: Number(r.seq) },
    pruned: r.oldest_tx ? { tx: String(r.oldest_tx), seq: Number(r.oldest_seq ?? 0) } : null,
  }
}

// ---------- catalogue ----------
const VIEW: Record<PageKind, { view: string; cols: string; map: (r: any) => unknown }> = {
  anime: { view: 'hub_public_anime', cols: ANIME_COLUMNS, map: mapAnime },
  seasons: { view: 'hub_public_seasons', cols: SEASON_COLUMNS, map: mapSeason },
  episodes: { view: 'hub_public_episodes', cols: EPISODE_COLUMNS, map: mapEpisode },
}

async function catalogPage(req: Request, url: URL, kind: PageKind) {
  const limit = clampLimit(url.searchParams.get('limit'), DEFAULT_PAGE, MAX_PAGE)
  const rawCursor = url.searchParams.get('cursor')
  const after = rawCursor ? decodePageCursor(kind, rawCursor) : null
  if (rawCursor && !after) throw new HttpError(400, 'invalid_cursor', 'cursor is not a valid page cursor for this endpoint.')
  const v = VIEW[kind]
  let q = db().from(v.view).select(v.cols).order('id', { ascending: true }).limit(limit + 1)
  if (after) q = q.gt('id', after)
  const animeFilter = url.searchParams.get('anime_id')
  if (animeFilter) {
    if (kind === 'anime' || !isUuid(animeFilter)) throw new HttpError(400, 'invalid_filter', 'anime_id must be a UUID (seasons/episodes only).')
    q = q.eq('anime_id', animeFilter)
  }
  const [{ data, error }, h] = await Promise.all([q, rawCursor ? Promise.resolve(null) : head()])
  if (error) dbFail(error, `catalog ${kind}`)
  const rows = (data ?? []) as any[]
  const hasMore = rows.length > limit
  const page = rows.slice(0, limit)
  return cached(req, {
    api_version: API_VERSION,
    object: 'list',
    kind,
    data: page.map(v.map),
    page: {
      limit,
      has_more: hasMore,
      next_cursor: hasMore ? encodePageCursor(kind, page[page.length - 1].id) : null,
    },
    // Only on the first page: start the change feed here after a full import.
    changes_cursor: h ? encodeChangeCursor(h.cursor) : undefined,
    generated_at: new Date().toISOString(),
  }, rawCursor ? 300 : 60)
}

async function count(view: string) {
  const { count: n, error } = await db().from(view).select('id', { count: 'exact', head: true })
  if (error) dbFail(error, `count ${view}`)
  return n ?? 0
}

async function stats(req: Request) {
  const [anime, seasons, episodes, h] = await Promise.all([count('hub_public_anime'), count('hub_public_seasons'), count('hub_public_episodes'), head()])
  return cached(req, {
    api_version: API_VERSION,
    object: 'catalog_stats',
    totals: { anime, seasons, episodes },
    changes_cursor: encodeChangeCursor(h.cursor),
    generated_at: new Date().toISOString(),
  }, 60)
}

async function fetchMany(kind: PageKind, ids: string[]) {
  const out = new Map<string, any>()
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const { data, error } = await db().from(VIEW[kind].view).select(VIEW[kind].cols).in('id', chunk)
    if (error) dbFail(error, `lookup ${kind}`)
    for (const r of (data ?? []) as any[]) out.set(r.id, r)
  }
  return out
}

async function animeLookup(req: Request, url: URL, id: string) {
  if (!isUuid(id)) throw new HttpError(400, 'invalid_id', 'Anime id must be a UUID.')
  const include = url.searchParams.get('include') ?? 'all'
  const { data: a, error } = await db().from('hub_public_anime').select(ANIME_COLUMNS).eq('id', id).maybeSingle()
  if (error) dbFail(error, 'anime lookup')
  if (!a) throw new HttpError(404, 'not_public', 'This anime is not in the published catalogue (unpublished, hidden or deleted).', { entity_id: id })
  const body: any = { api_version: API_VERSION, data: mapAnime(a), generated_at: new Date().toISOString() }
  if (include !== 'none') {
    const [{ data: seasons, error: se }, { data: eps, error: ee }] = await Promise.all([
      db().from('hub_public_seasons').select(SEASON_COLUMNS).eq('anime_id', id).order('season_number'),
      db().from('hub_public_episodes').select(EPISODE_COLUMNS).eq('anime_id', id).order('episode_number').limit(5000),
    ])
    if (se || ee) dbFail(se ?? ee, 'anime subtree')
    const bySeason = new Map<string, any[]>()
    for (const e of (eps ?? []) as any[]) {
      if (!bySeason.has(e.season_id)) bySeason.set(e.season_id, [])
      bySeason.get(e.season_id)!.push(mapEpisode(e))
    }
    body.seasons = ((seasons ?? []) as any[]).map((s) => ({ ...mapSeason(s), episodes: bySeason.get(s.id) ?? [] }))
    body.complete = true // authoritative subtree: children missing here are not published
  }
  return cached(req, body, 60)
}

async function seasonLookup(req: Request, url: URL, id: string) {
  if (!isUuid(id)) throw new HttpError(400, 'invalid_id', 'Season id must be a UUID.')
  const { data: s, error } = await db().from('hub_public_seasons').select(SEASON_COLUMNS).eq('id', id).maybeSingle()
  if (error) dbFail(error, 'season lookup')
  if (!s) throw new HttpError(404, 'not_public', 'This season is not in the published catalogue.', { entity_id: id })
  const body: any = { api_version: API_VERSION, data: mapSeason(s), generated_at: new Date().toISOString() }
  if (url.searchParams.get('include') === 'episodes') {
    const { data: eps, error: ee } = await db().from('hub_public_episodes').select(EPISODE_COLUMNS).eq('season_id', id).order('episode_number').limit(5000)
    if (ee) dbFail(ee, 'season episodes')
    body.episodes = ((eps ?? []) as any[]).map(mapEpisode)
    body.complete = true
  }
  return cached(req, body, 60)
}

async function episodeLookup(req: Request, id: string) {
  if (!isUuid(id)) throw new HttpError(400, 'invalid_id', 'Episode id must be a UUID.')
  const { data: e, error } = await db().from('hub_public_episodes').select(EPISODE_COLUMNS).eq('id', id).maybeSingle()
  if (error) dbFail(error, 'episode lookup')
  if (!e) throw new HttpError(404, 'not_public', 'This episode is not in the published catalogue.', { entity_id: id })
  return cached(req, { api_version: API_VERSION, data: mapEpisode(e), generated_at: new Date().toISOString() }, 60)
}

// ---------- events: resolve to the CURRENT public state ----------
interface RawEvent {
  seq: number; event_id: string; entity_type: 'anime' | 'season' | 'episode'; entity_id: string
  anime_id: string | null; season_id: string | null; action: 'change' | 'delete'; revision: number | string
  tx_id: string; created_at: string
}

const KIND_OF = { anime: 'anime', season: 'seasons', episode: 'episodes' } as const
const BASE_TABLE = { anime: 'anime', season: 'seasons', episode: 'episodes' } as const

async function resolveEvents(events: RawEvent[], memo = new Map<string, any>()) {
  const need: Record<'anime' | 'season' | 'episode', Set<string>> = { anime: new Set(), season: new Set(), episode: new Set() }
  for (const e of events) if (e.action === 'change' && !memo.has(`${e.entity_type}:${e.entity_id}`)) need[e.entity_type].add(e.entity_id)
  for (const t of ['anime', 'season', 'episode'] as const) {
    const ids = [...need[t]]
    if (!ids.length) continue
    const found = await fetchMany(KIND_OF[t], ids)
    const missing = ids.filter((id) => !found.has(id))
    const existing = new Map<string, number>()
    for (let i = 0; i < missing.length; i += 100) {
      const { data, error } = await db().from(BASE_TABLE[t]).select('id,content_revision').in('id', missing.slice(i, i + 100))
      if (error) dbFail(error, 'resolve existence')
      for (const r of (data ?? []) as any[]) existing.set(r.id, Number(r.content_revision))
    }
    for (const id of ids) {
      const row = found.get(id)
      if (row) memo.set(`${t}:${id}`, { state: 'public', row })
      else if (existing.has(id)) memo.set(`${t}:${id}`, { state: 'hidden', revision: existing.get(id) })
      else memo.set(`${t}:${id}`, { state: 'gone' })
    }
  }
  return events.map((e) => {
    const base = {
      event_id: e.event_id,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      anime_id: e.anime_id,
      season_id: e.season_id,
      occurred_at: e.created_at,
      fetch_url: `${PUBLIC_BASE_URL}/v1/${e.entity_type === 'anime' ? 'anime' : e.entity_type === 'season' ? 'seasons' : 'episodes'}/${e.entity_id}`,
    }
    const r = e.action === 'delete' ? { state: 'gone' } : memo.get(`${e.entity_type}:${e.entity_id}`)
    if (r?.state === 'public') {
      const data = r.row
      const mapped = e.entity_type === 'anime' ? mapAnime(data) : e.entity_type === 'season' ? mapSeason(data) : mapEpisode(data)
      return {
        ...base,
        type: `${e.entity_type}.upsert`,
        action: 'upsert' as const,
        anime_id: (mapped as any).anime_id ?? (e.entity_type === 'anime' ? e.entity_id : e.anime_id),
        season_id: (mapped as any).season_id ?? e.season_id,
        revision: String(BigInt(mapped.revision) > BigInt(e.revision) ? mapped.revision : e.revision),
        data: mapped,
      }
    }
    if (r?.state === 'hidden') {
      return { ...base, type: `${e.entity_type}.unpublish`, action: 'unpublish' as const, revision: String(r.revision ?? e.revision), data: null }
    }
    return { ...base, type: `${e.entity_type}.delete`, action: 'delete' as const, revision: String(e.revision), data: null }
  })
}

async function eventsAfter(c: ChangeCursor, limit: number): Promise<RawEvent[]> {
  const { data, error } = await db().rpc('hub_events_after', { _tx: c.tx, _seq: c.seq, _limit: limit })
  if (error) dbFail(error, 'change feed')
  return (data ?? []) as RawEvent[]
}

async function changes(req: Request, url: URL) {
  const raw = url.searchParams.get('cursor')
  const c = decodeChangeCursor(raw)
  if (!c) throw new HttpError(400, 'invalid_cursor', 'cursor is required. Use changes_cursor from the first catalogue page, /v1/catalog/stats or /v1/changes/head.')
  const h = await head()
  if (h.pruned && compareChangeCursor(c, h.pruned) < 0) {
    throw new HttpError(410, 'cursor_expired', 'This cursor is older than the 30-day change history. Run a full catalogue import, then continue from its changes_cursor.')
  }
  const limit = clampLimit(url.searchParams.get('limit'), DEFAULT_PAGE, 500)
  const events = await eventsAfter(c, limit)
  const resolved = await resolveEvents(events)
  const last = events[events.length - 1]
  const next = last ? { tx: String(last.tx_id), seq: Number(last.seq) } : c
  return cached(req, {
    api_version: API_VERSION,
    object: 'change_list',
    events: resolved,
    next_cursor: encodeChangeCursor(next),
    has_more: events.length === limit,
    generated_at: new Date().toISOString(),
  }, events.length === limit ? 300 : 5)
}

// ---------- secrets at rest (AES-GCM) ----------
let _aes: CryptoKey | null = null
async function aesKey() {
  if (_aes) return _aes
  const raw = Deno.env.get('API_HUB_ENCRYPTION_KEY')
  if (!raw) throw new HttpError(500, 'server_misconfigured', 'API Hub encryption key is not configured.')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  _aes = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
  return _aes
}
async function encryptSecret(secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(), new TextEncoder().encode(secret)))
  const all = new Uint8Array(iv.length + ct.length)
  all.set(iv); all.set(ct, iv.length)
  return 'v1:' + btoa(String.fromCharCode(...all))
}
async function decryptSecret(blob: string | null): Promise<string | null> {
  if (!blob?.startsWith('v1:')) return null
  const all = Uint8Array.from(atob(blob.slice(3)), (ch) => ch.charCodeAt(0))
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, await aesKey(), all.slice(12))
  return new TextDecoder().decode(pt)
}
const newWebhookSecret = () => 'whsec_' + randomToken(32)

// ---------- safe outbound requests ----------
async function assertPublicDns(host: string) {
  const ips: string[] = []
  for (const type of ['A', 'AAAA'] as const) {
    try { ips.push(...(await Deno.resolveDns(host, type))) } catch { /* no records of this type */ }
  }
  if (!ips.length) throw new Error('webhook host does not resolve')
  const bad = ips.find((ip) => !isPublicIp(ip))
  if (bad) throw new Error('webhook host resolves to a private or reserved address')
}

async function safePost(urlStr: string, body: string, headers: Record<string, string>) {
  const u = new URL(urlStr)
  await assertPublicDns(u.hostname) // re-checked before every request (DNS-rebinding guard)
  const res = await fetch(u, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json', 'User-Agent': `AnimeSavi-API-Hub/${API_VERSION}`, ...headers },
    redirect: 'manual',
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  })
  const reader = res.body?.getReader()
  let text = ''
  if (reader) {
    const dec = new TextDecoder()
    while (text.length < 8192) {
      const { done, value } = await reader.read()
      if (done) break
      text += dec.decode(value, { stream: true })
    }
    reader.cancel().catch(() => {})
  }
  return { status: res.status, text: text.slice(0, 8192) }
}

// ---------- pairing ----------
async function readJson(req: Request, max = 8192): Promise<{ raw: string; body: any }> {
  const raw = await req.text()
  if (raw.length > max) throw new HttpError(413, 'payload_too_large', 'Request body is too large.')
  if (!raw) return { raw, body: {} }
  try { return { raw, body: JSON.parse(raw) } } catch { throw new HttpError(400, 'invalid_json', 'Body must be JSON.') }
}

async function rateCheck(bucket: string, windowSec: number, max: number) {
  const { data, error } = await db().rpc('hub_rate_check', { _bucket: bucket, _window_seconds: windowSec, _max: max })
  if (error) dbFail(error, 'rate limit')
  if (data !== true) throw new HttpError(429, 'rate_limited', 'Too many pairing attempts. Try again later.', { retry_after: 900 })
}

async function pair(req: Request) {
  const { body } = await readJson(req)
  const siteName = sanitizeSiteName(body.site_name)
  if (!siteName) throw new HttpError(400, 'invalid_site_name', 'site_name must be 2-80 characters.')
  if (typeof body.challenge !== 'string' || !CHALLENGE_RE.test(body.challenge)) {
    throw new HttpError(400, 'invalid_challenge', 'challenge must be 32-256 URL-safe characters generated by your server.')
  }
  const target = validateReceiverTarget(body.site_origin, body.webhook_url)
  if (!target.ok) throw new HttpError(400, target.code, target.message)

  const ipHash = (await sha256Hex('ip:' + clientIp(req))).slice(0, 24)
  await rateCheck(`pair:ip:${ipHash}`, 3600, 10)
  await rateCheck(`pair:host:${target.host}`, 3600, 6)
  await rateCheck('pair:global', 3600, 500)

  try { await assertPublicDns(target.host) } catch (e) {
    throw new HttpError(400, 'unsafe_host', (e as Error).message)
  }

  // Prove the requester controls the webhook endpoint: it must echo the challenge and our nonce.
  const hubNonce = randomToken(24)
  const verification = JSON.stringify({ type: 'animesavi.verification', api_version: API_VERSION, challenge: body.challenge, hub_nonce: hubNonce, sent_at: new Date().toISOString() })
  let res
  try {
    res = await safePost(target.webhookUrl, verification, { 'X-AnimeSavi-Event': 'verification' })
  } catch (e) {
    throw new HttpError(422, 'verification_failed', `Could not reach webhook_url: ${(e as Error).message}`.slice(0, 200))
  }
  if (res.status < 200 || res.status >= 300) throw new HttpError(422, 'verification_failed', `webhook_url answered HTTP ${res.status}; expected 200 with the echoed challenge.`)
  let echoed: any = null
  try { echoed = JSON.parse(res.text) } catch { /* handled below */ }
  if (!echoed || typeof echoed.challenge !== 'string' || typeof echoed.hub_nonce !== 'string' ||
      !timingSafeEqualStr(echoed.challenge, body.challenge) || !timingSafeEqualStr(echoed.hub_nonce, hubNonce)) {
    throw new HttpError(422, 'verification_failed', 'webhook_url did not echo the challenge and hub_nonce.')
  }

  const secret = newWebhookSecret()
  const { data, error } = await db().rpc('hub_create_connection', {
    _site_name: siteName, _site_origin: target.origin, _webhook_url: target.webhookUrl, _ciphertext: await encryptSecret(secret),
  })
  if (error || !data?.[0]) dbFail(error, 'create connection')
  const row = data[0]
  console.log(`[api-hub] paired connection ${row.id} for ${target.host}`)
  return json({
    api_version: API_VERSION,
    object: 'connection',
    connection_id: row.id,
    status: 'active',
    webhook_secret: secret, // shown once; store server-side only
    signature: { header: 'X-AnimeSavi-Signature', scheme: 't=<unix>,v1=<hex HMAC-SHA256(secret, `${t}.${raw_body}`)>' },
    changes_cursor: encodeChangeCursor({ tx: String(row.delivered_tx), seq: Number(row.delivered_seq) }),
    api_base: PUBLIC_BASE_URL,
    next_steps: [
      'Store webhook_secret in server-side secret storage (never in frontend code).',
      'Run the full catalogue import (GET /v1/catalog/anime, /seasons, /episodes) and keep the first page changes_cursor.',
      'Validate totals against GET /v1/catalog/stats before reconciling deletions.',
      'Process webhooks and run the backup GET /v1/changes poll every ~5 minutes.',
    ],
  }, 201)
}

// ---------- signed connection management ----------
async function authConnection(req: Request, path: string, raw: string, allowPreviousSecret = true) {
  const id = req.headers.get('x-animesavi-connection') ?? ''
  const ts = req.headers.get('x-animesavi-timestamp') ?? ''
  const nonce = req.headers.get('x-animesavi-nonce') ?? ''
  const sig = (req.headers.get('x-animesavi-signature') ?? '').replace(/^v1=/, '')
  if (!isUuid(id) || !/^\d{9,12}$/.test(ts) || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) || !/^[0-9a-f]{64}$/.test(sig)) {
    throw new HttpError(401, 'unauthorized', 'Missing or malformed X-AnimeSavi-Connection / -Timestamp / -Nonce / -Signature headers.')
  }
  if (Math.abs(Date.now() / 1000 - Number(ts)) > MGMT_TOLERANCE_SEC) throw new HttpError(401, 'stale_request', 'Timestamp is outside the 5-minute window.')
  const { data: c, error } = await db().from('hub_connections').select('*').eq('id', id).maybeSingle()
  if (error) dbFail(error, 'connection lookup')
  if (!c || c.status !== 'active') throw new HttpError(401, 'unauthorized', 'Unknown or disconnected connection.')
  const msg = managementMessage(ts, nonce, req.method, path, raw)
  const candidates = [await decryptSecret(c.secret_ciphertext)]
  if (c.previous_secret_ciphertext && c.previous_secret_expires_at && new Date(c.previous_secret_expires_at) > new Date()) {
    candidates.push(await decryptSecret(c.previous_secret_ciphertext))
  }
  let ok = false
  for (const s of candidates) if (s && timingSafeEqualStr(await hmacHex(s, msg), sig)) ok = true
  if (!ok) throw new HttpError(401, 'unauthorized', 'Signature mismatch.')
  const { data: fresh, error: ne } = await db().rpc('hub_use_nonce', { _connection_id: id, _nonce: nonce })
  if (ne) dbFail(ne, 'nonce')
  if (fresh !== true) throw new HttpError(401, 'replayed_request', 'This nonce was already used.')
  return c
}

function publicConnection(c: any) {
  return {
    object: 'connection',
    connection_id: c.id,
    site_name: c.site_name,
    site_origin: c.site_origin,
    webhook_url: c.webhook_url,
    status: c.status,
    delivery: {
      state: c.delivery_state,
      delivered_cursor: encodeChangeCursor({ tx: String(c.delivered_tx), seq: Number(c.delivered_seq) }),
      attempt_count: c.attempt_count,
      next_attempt_at: c.next_attempt_at,
      last_attempt_at: c.last_attempt_at,
      last_success_at: c.last_success_at,
      last_error: c.last_error,
      events_delivered: Number(c.events_delivered ?? 0),
    },
    secret_rotation: c.previous_secret_expires_at ? { previous_secret_valid_until: c.previous_secret_expires_at } : null,
    created_at: c.created_at,
  }
}

async function manage(req: Request, path: string, action: string) {
  const { raw, body } = await readJson(req)
  const c = await authConnection(req, path, raw, action !== 'disconnect')
  if (action === 'status') return json({ api_version: API_VERSION, ...publicConnection(c) })
  if (action === 'disconnect') {
    const { error } = await db().from('hub_connections').update({
      status: 'disconnected', disconnected_at: new Date().toISOString(), secret_ciphertext: null,
      previous_secret_ciphertext: null, previous_secret_expires_at: null, lease_until: null,
    }).eq('id', c.id)
    if (error) dbFail(error, 'disconnect')
    return json({ api_version: API_VERSION, object: 'connection', connection_id: c.id, status: 'disconnected' })
  }
  if (action === 'rotate-secret') {
    const secret = newWebhookSecret()
    const until = new Date(Date.now() + SECRET_GRACE_HOURS * 3600_000).toISOString()
    const { error } = await db().from('hub_connections').update({
      secret_ciphertext: await encryptSecret(secret), previous_secret_ciphertext: c.secret_ciphertext, previous_secret_expires_at: until,
    }).eq('id', c.id)
    if (error) dbFail(error, 'rotate')
    return json({ api_version: API_VERSION, object: 'connection', connection_id: c.id, webhook_secret: secret, previous_secret_valid_until: until })
  }
  if (action === 'resume') {
    let cur: ChangeCursor = { tx: String(c.delivered_tx), seq: Number(c.delivered_seq) }
    if (body.replay_from_cursor !== undefined) {
      const r = decodeChangeCursor(body.replay_from_cursor)
      if (!r) throw new HttpError(400, 'invalid_cursor', 'replay_from_cursor is not a valid change cursor.')
      const h = await head()
      if (h.pruned && compareChangeCursor(r, h.pruned) < 0) throw new HttpError(410, 'cursor_expired', 'replay_from_cursor is older than the change history.')
      cur = r
    }
    const { error } = await db().rpc('hub_set_connection_cursor', { _id: c.id, _tx: cur.tx, _seq: cur.seq })
    if (error) dbFail(error, 'resume')
    kickSelf()
    return json({ api_version: API_VERSION, object: 'connection', connection_id: c.id, status: 'active', delivery_state: 'idle', delivered_cursor: encodeChangeCursor(cur) })
  }
  if (action === 'test') {
    const result = await deliver(c, [], 'ping')
    return json({ api_version: API_VERSION, object: 'delivery_test', connection_id: c.id, ok: result.ok, http_status: result.status ?? null, error: result.error ?? null })
  }
  throw new HttpError(404, 'not_found', 'Unknown connection action.')
}

// ---------- delivery ----------
async function deliver(c: any, events: unknown[], type: 'content.changes' | 'ping', nextCursor?: string) {
  const secrets: string[] = []
  const cur = await decryptSecret(c.secret_ciphertext)
  if (!cur) return { ok: false, error: 'connection has no secret' }
  secrets.push(cur)
  if (c.previous_secret_ciphertext && c.previous_secret_expires_at && new Date(c.previous_secret_expires_at) > new Date()) {
    const prev = await decryptSecret(c.previous_secret_ciphertext)
    if (prev) secrets.push(prev)
  }
  const deliveryId = crypto.randomUUID()
  const raw = JSON.stringify({ type, api_version: API_VERSION, delivery_id: deliveryId, connection_id: c.id, sent_at: new Date().toISOString(), events, next_cursor: nextCursor ?? null })
  const ts = Math.floor(Date.now() / 1000)
  try {
    const res = await safePost(c.webhook_url, raw, {
      'X-AnimeSavi-Event': type,
      'X-AnimeSavi-Delivery': deliveryId,
      'X-AnimeSavi-Connection': c.id,
      'X-AnimeSavi-Timestamp': String(ts),
      'X-AnimeSavi-Signature': await signWebhookBody(raw, secrets, ts),
    })
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status }
    return { ok: false, status: res.status, error: `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, error: (e as Error).name === 'TimeoutError' ? 'timeout' : (e as Error).message.slice(0, 200) }
  }
}

async function deliverConnection(c: any, memo: Map<string, any>, deadline: number) {
  let cur: ChangeCursor = { tx: String(c.delivered_tx), seq: Number(c.delivered_seq) }
  for (let batch = 0; batch < 6 && Date.now() < deadline; batch++) {
    const events = await eventsAfter(cur, DELIVERY_BATCH)
    if (!events.length) break
    const resolved = await resolveEvents(events, memo)
    const last = events[events.length - 1]
    const next: ChangeCursor = { tx: String(last.tx_id), seq: Number(last.seq) }
    const r = await deliver(c, resolved, 'content.changes', encodeChangeCursor(next))
    if (!r.ok) {
      await db().rpc('hub_record_delivery_failure', { _id: c.id, _error: r.error ?? 'failed', _max_attempts: MAX_ATTEMPTS })
      return
    }
    await db().rpc('hub_record_delivery_success', { _id: c.id, _tx: next.tx, _seq: next.seq, _count: events.length })
    cur = next
    if (events.length < DELIVERY_BATCH) break
  }
  await db().rpc('hub_release_connection', { _id: c.id })
}

async function runPool<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) {
      const it = queue.shift()!
      try { await fn(it) } catch (e) { console.error('[api-hub] delivery worker error', (e as Error).message) }
    }
  }))
}

async function dispatch(source: string) {
  const started = Date.now()
  const deadline = started + 25_000
  const memo = new Map<string, any>()
  let lastWork = Date.now()
  let connectionsServed = 0
  while (Date.now() < deadline) {
    const { data, error } = await db().rpc('hub_claim_connections', { _limit: 20, _lease_seconds: 60 })
    if (error) { console.error('[api-hub] claim failed', error.message); break }
    const conns = (data ?? []) as any[]
    if (!conns.length) {
      if (Date.now() - lastWork > 4000) break // stay briefly alive to absorb bursts of edits
      await new Promise((r) => setTimeout(r, 1500))
      memo.clear()
      continue
    }
    lastWork = Date.now()
    connectionsServed += conns.length
    await runPool(conns, 5, (c) => deliverConnection(c, memo, deadline))
    memo.clear()
  }
  const { data: pruned } = await db().rpc('hub_prune', { _retention_days: 30 })
  return { ok: true, source, connections_served: connectionsServed, pruned_events: pruned ?? 0, ms: Date.now() - started }
}

let kickCache: { secret: string; at: number } | null = null
async function authorizeDispatch(req: Request) {
  const kick = req.headers.get('x-hub-kick')
  if (kick) {
    if (!kickCache || Date.now() - kickCache.at > 300_000) {
      const { data, error } = await db().from('hub_runtime').select('kick_secret').eq('id', 1).maybeSingle()
      if (error || !data) dbFail(error, 'runtime')
      kickCache = { secret: data.kick_secret, at: Date.now() }
    }
    if (timingSafeEqualStr(kick, kickCache.secret)) return 'kick'
    throw new HttpError(401, 'unauthorized', 'Unauthorized.')
  }
  const denied = authenticateCronRequest(req)
  if (denied) throw new HttpError(401, 'unauthorized', 'Unauthorized.')
  return 'schedule'
}

function kickSelf() {
  // Fire-and-forget: wake the dispatcher after a resume.
  db().from('hub_runtime').select('kick_secret,dispatch_url').eq('id', 1).maybeSingle().then(({ data }) => {
    if (data) fetch(data.dispatch_url, { method: 'POST', headers: { 'x-hub-kick': data.kick_secret, 'Content-Type': 'application/json' }, body: '{"source":"resume"}' }).catch(() => {})
  })
}

// ---------- router ----------
async function route(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/(functions\/v1\/)?api-hub/, '').replace(/\/+$/, '') || '/'
  const m = req.method

  if ((path === '/' || path === '/v1/internal/dispatch') && m === 'POST') {
    const source = await authorizeDispatch(req)
    return json(await dispatch(source))
  }
  if (m === 'GET' && (path === '/' || path === '/v1')) {
    return json({ api_version: API_VERSION, name: 'AnimeSavi API Hub', docs: 'https://animesavi.com/developers', openapi: `${PUBLIC_BASE_URL}/v1/openapi.json` }, 200, { 'Cache-Control': 'public, max-age=300' })
  }

  if (m === 'GET') {
    readLimit(req)
    if (path === '/v1/health') {
      const h = await head()
      return json({ api_version: API_VERSION, status: 'ok', time: new Date().toISOString(), changes_cursor: encodeChangeCursor(h.cursor) }, 200, { 'Cache-Control': 'public, max-age=15' })
    }
    if (path === '/v1/openapi.json') return cached(req, buildOpenApi(), 300)
    if (path === '/v1/integration-prompt') {
      return new Response(INTEGRATION_PROMPT, { headers: { ...CORS, 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
    }
    if (path === '/v1/catalog/anime') return catalogPage(req, url, 'anime')
    if (path === '/v1/catalog/seasons') return catalogPage(req, url, 'seasons')
    if (path === '/v1/catalog/episodes') return catalogPage(req, url, 'episodes')
    if (path === '/v1/catalog/stats') return stats(req)
    if (path === '/v1/changes') return changes(req, url)
    if (path === '/v1/changes/head') {
      const h = await head()
      return json({ api_version: API_VERSION, object: 'change_cursor', cursor: encodeChangeCursor(h.cursor), generated_at: new Date().toISOString() })
    }
    let mm = /^\/v1\/anime\/([^/]+)$/.exec(path)
    if (mm) return animeLookup(req, url, mm[1])
    mm = /^\/v1\/seasons\/([^/]+)$/.exec(path)
    if (mm) return seasonLookup(req, url, mm[1])
    mm = /^\/v1\/episodes\/([^/]+)$/.exec(path)
    if (mm) return episodeLookup(req, mm[1])
    if (path === '/v1/connections/me') return manage(req, path, 'status')
  }

  if (m === 'POST' && path === '/v1/connections/pair') return pair(req)
  if (m === 'POST' && path === '/v1/connections/me/rotate-secret') return manage(req, path, 'rotate-secret')
  if (m === 'POST' && path === '/v1/connections/me/resume') return manage(req, path, 'resume')
  if (m === 'POST' && path === '/v1/connections/me/test') return manage(req, path, 'test')
  if ((m === 'POST' && path === '/v1/connections/me/disconnect') || (m === 'DELETE' && path === '/v1/connections/me')) {
    return manage(req, path, 'disconnect')
  }

  throw new HttpError(m === 'GET' || m === 'POST' || m === 'DELETE' ? 404 : 405, m === 'GET' || m === 'POST' || m === 'DELETE' ? 'not_found' : 'method_not_allowed', 'No such endpoint. See /v1/openapi.json.')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  try {
    return await route(req)
  } catch (e) {
    if (e instanceof HttpError) return errorResponse(e)
    console.error('[api-hub] unexpected', (e as Error)?.message)
    return errorResponse(new HttpError(500, 'internal_error', 'Unexpected server error. Retry later; this is NOT a deletion signal.', { retryable: true }))
  }
})

