import { describe, expect, it } from 'vitest'
import {
  compareChangeCursor, decodeChangeCursor, decodePageCursor, encodeChangeCursor, encodePageCursor,
  isPublicIp, signWebhookBody, validateReceiverTarget, verifyWebhookSignature,
} from '../../../supabase/functions/api-hub/lib.ts'
import { mapAnime, mapEpisode } from '../../../supabase/functions/api-hub/records.ts'

describe('receiver URL safety', () => {
  const reject = (o: string, w: string) => validateReceiverTarget(o, w)
  it('rejects plain http', () => expect(reject('http://example.com', 'http://example.com/h').ok).toBe(false))
  it('rejects localhost and internal names', () => {
    expect(reject('https://localhost', 'https://localhost/h').ok).toBe(false)
    expect(reject('https://db.internal', 'https://db.internal/h').ok).toBe(false)
  })
  it('rejects private, loopback and metadata IPs', () => {
    for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '192.168.1.1', '172.20.0.1', '100.64.0.1', '0.0.0.0']) {
      expect(isPublicIp(ip)).toBe(false)
    }
    for (const ip of ['::1', 'fd00:ec2::254', 'fe80::1', '::ffff:10.0.0.1', '::ffff:127.0.0.1']) expect(isPublicIp(ip)).toBe(false)
    expect(isPublicIp('8.8.8.8')).toBe(true)
    expect(isPublicIp('2606:4700:4700::1111')).toBe(true)
  })
  it('rejects non-443 ports', () => expect(reject('https://example.com:8443', 'https://example.com:8443/h')).toMatchObject({ ok: false, code: 'unsafe_port' }))
  it('requires the webhook on the site origin or a subdomain', () => {
    expect(reject('https://example.com', 'https://evil.com/h')).toMatchObject({ ok: false, code: 'origin_mismatch' })
    expect(validateReceiverTarget('https://example.com', 'https://api.example.com/hook').ok).toBe(true)
  })
})

describe('webhook signatures', () => {
  const body = '{"type":"content.changes","events":[]}'
  it('verifies with the right secret inside the 5-minute window', async () => {
    const h = await signWebhookBody(body, ['whsec_a'], 1_000_000)
    expect(await verifyWebhookSignature(h, body, 'whsec_a', 1_000_200)).toBe(true)
    expect(await verifyWebhookSignature(h, body, 'whsec_b', 1_000_200)).toBe(false)
    expect(await verifyWebhookSignature(h, body, 'whsec_a', 1_000_301)).toBe(false)
    expect(await verifyWebhookSignature(h, body + ' ', 'whsec_a', 1_000_000)).toBe(false)
  })
  it('accepts either secret during rotation', async () => {
    const h = await signWebhookBody(body, ['whsec_new', 'whsec_old'], 50)
    expect(await verifyWebhookSignature(h, body, 'whsec_old', 50)).toBe(true)
    expect(await verifyWebhookSignature(h, body, 'whsec_new', 50)).toBe(true)
  })
})

describe('cursors', () => {
  it('round-trips and orders by transaction, then sequence', () => {
    const c = { tx: '8380706', seq: 12 }
    expect(decodeChangeCursor(encodeChangeCursor(c))).toEqual(c)
    expect(compareChangeCursor({ tx: '9', seq: 1 }, { tx: '10', seq: 0 })).toBe(-1)
    expect(compareChangeCursor({ tx: '10', seq: 5 }, { tx: '10', seq: 2 })).toBe(1)
    expect(decodeChangeCursor('c1.not-valid')).toBeNull()
  })
  it('page cursors are bound to their endpoint', () => {
    const id = '0212cbd2-0263-48ad-8875-4716023402fe'
    expect(decodePageCursor('anime', encodePageCursor('anime', id))).toBe(id)
    expect(decodePageCursor('episodes', encodePageCursor('anime', id))).toBeNull()
  })
})

describe('public records', () => {
  it('never exposes uploader, counters or internal flags', () => {
    const a = mapAnime({ id: 'x', title: 'T', content_revision: 5, uploader_id: 'u', view_count: 9, like_count: 1, is_muse: false, is_featured: true })
    for (const k of ['uploader_id', 'view_count', 'like_count', 'is_muse', 'is_featured', 'content_revision']) expect(a).not.toHaveProperty(k)
    expect(a.revision).toBe('5')
    const e = mapEpisode({ id: 'e', anime_id: 'a', season_id: 's', title: 'E', content_revision: 7, ai_recap: 'secret', short_id: 'abc' })
    expect(e).not.toHaveProperty('ai_recap')
    expect(e).not.toHaveProperty('short_id')
  })
})
