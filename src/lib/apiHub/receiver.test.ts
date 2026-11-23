import { describe, expect, it } from 'vitest'
import { applyEvent, createStore, fullImport, type HubEvent } from '../../../supabase/functions/api-hub/receiver-reference.ts'

const A = 'aaaaaaaa-0000-4000-8000-000000000001'
const S = 'bbbbbbbb-0000-4000-8000-000000000001'
const E = 'cccccccc-0000-4000-8000-000000000001'
let n = 0
const ev = (p: Partial<HubEvent>): HubEvent => ({
  event_id: `evt-${++n}`, entity_type: 'anime', entity_id: A, action: 'upsert', revision: '10',
  data: { id: A, revision: p.revision ?? '10', title: 'Title' }, ...p,
})
const seeded = () => {
  const s = createStore()
  s.anime.set(A, { id: A, revision: '10', title: 'Old' })
  s.season.set(S, { id: S, anime_id: A, revision: '10' })
  s.episode.set(E, { id: E, anime_id: A, season_id: S, revision: '10' })
  return s
}

describe('receiver rules', () => {
  it('a repeated webhook event does not apply twice', () => {
    const s = seeded()
    const e = ev({ revision: '11', data: { id: A, revision: '11', title: 'New' } })
    expect(applyEvent(s, e)).toBe('applied')
    expect(applyEvent(s, e)).toBe('duplicate')
    expect(s.anime.size).toBe(1)
  })

  it('an older revision arriving late never overwrites a newer one', () => {
    const s = seeded()
    applyEvent(s, ev({ revision: '20', data: { id: A, revision: '20', title: 'Newest' } }))
    expect(applyEvent(s, ev({ revision: '15', data: { id: A, revision: '15', title: 'Stale' } }))).toBe('stale')
    expect(s.anime.get(A)?.title).toBe('Newest')
  })

  it('unpublishing an anime removes its seasons and episodes; a stale upsert cannot restore it', () => {
    const s = seeded()
    applyEvent(s, ev({ action: 'unpublish', revision: '30', data: null }))
    expect(s.anime.has(A) || s.season.has(S) || s.episode.has(E)).toBe(false)
    expect(applyEvent(s, ev({ revision: '25', data: { id: A, revision: '25' } }))).toBe('stale')
    expect(s.anime.has(A)).toBe(false)
    // Re-published later with a newer revision -> comes back (subtree fetched by caller).
    expect(applyEvent(s, ev({ revision: '31', data: { id: A, revision: '31' } }))).toBe('needs_parent_fetch')
    expect(s.anime.has(A)).toBe(true)
  })

  it('a deleted entity is never resurrected', () => {
    const s = seeded()
    applyEvent(s, ev({ entity_type: 'episode', entity_id: E, action: 'delete', revision: '40', data: null }))
    const late = ev({ entity_type: 'episode', entity_id: E, revision: '99', data: { id: E, anime_id: A, season_id: S, revision: '99' } })
    expect(applyEvent(s, late)).toBe('blocked')
    expect(s.episode.has(E)).toBe(false)
  })

  it('an episode whose parent is missing asks for the full anime instead of creating an orphan', () => {
    const s = createStore()
    const e = ev({ entity_type: 'episode', entity_id: E, data: { id: E, anime_id: A, season_id: S, revision: '5' } })
    expect(applyEvent(s, e)).toBe('needs_parent_fetch')
    expect(s.episode.size).toBe(0)
  })
})

describe('safe full import', () => {
  const page = (data: any[], extra: any = {}) => ({ data, page: { has_more: false, next_cursor: null }, ...extra })
  const api = (over: Record<string, any> = {}) => async (path: string) => {
    if (path in over) { const v = over[path]; if (v instanceof Error) throw v; return v }
    if (path.startsWith('/v1/catalog/anime')) return page([{ id: A, revision: '10' }], { changes_cursor: 'c1.x' })
    if (path.startsWith('/v1/catalog/seasons')) return page([{ id: S, anime_id: A, revision: '10' }])
    if (path.startsWith('/v1/catalog/episodes')) return page([{ id: E, anime_id: A, season_id: S, revision: '10' }])
    if (path === '/v1/catalog/stats') return { totals: { anime: 1, seasons: 1, episodes: 1 } }
    throw new Error('unexpected ' + path)
  }

  it('a temporary API failure never wipes the current catalogue', async () => {
    const s = seeded()
    s.anime.set('keep-me', { id: 'keep-me', revision: '1' })
    const r = await fullImport(s, api({ '/v1/catalog/episodes?limit=200': new Error('503 source_unavailable') }))
    expect(r.ok).toBe(false)
    expect(s.anime.has('keep-me')).toBe(true)
  })

  it('an incomplete snapshot (totals mismatch) changes nothing', async () => {
    const s = seeded()
    s.anime.set('keep-me', { id: 'keep-me', revision: '1' })
    const r = await fullImport(s, api({ '/v1/catalog/stats': { totals: { anime: 2, seasons: 1, episodes: 1 } } }))
    expect(r.ok).toBe(false)
    expect(s.anime.has('keep-me')).toBe(true)
  })

  it('a complete snapshot removes records AnimeSavi no longer publishes and stores the cursor', async () => {
    const s = seeded()
    s.anime.set('gone', { id: 'gone', revision: '1' })
    const r = await fullImport(s, api())
    expect(r).toEqual({ ok: true, cursor: 'c1.x' })
    expect([...s.anime.keys()]).toEqual([A])
    expect(s.cursor).toBe('c1.x')
  })
})
