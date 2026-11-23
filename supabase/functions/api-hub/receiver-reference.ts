// Reference implementation of the receiver rules from the Universal Integration Prompt.
// Framework-free and storage-agnostic (in-memory maps here); receivers port the same
// logic to their own database. Covered by src/lib/apiHub/receiver.test.ts.

export type EntityType = 'anime' | 'season' | 'episode'
export interface Rec { id: string; revision: string; anime_id?: string; season_id?: string; [k: string]: unknown }
export interface HubEvent {
  event_id: string
  entity_type: EntityType
  entity_id: string
  anime_id?: string | null
  season_id?: string | null
  action: 'upsert' | 'unpublish' | 'delete'
  revision: string
  data: Rec | null
}
export interface Tombstone { revision: bigint; kind: 'unpublished' | 'deleted' }

export interface MirrorStore {
  anime: Map<string, Rec>
  season: Map<string, Rec>
  episode: Map<string, Rec>
  tombstones: Map<string, Tombstone>
  processed: Set<string>
  cursor: string | null
}

export const createStore = (): MirrorStore => ({
  anime: new Map(), season: new Map(), episode: new Map(), tombstones: new Map(), processed: new Set(), cursor: null,
})

const key = (t: EntityType, id: string) => `${t}:${id}`

function removeCascade(store: MirrorStore, t: EntityType, id: string) {
  store[t].delete(id)
  if (t === 'anime') {
    for (const [sid, s] of store.season) if (s.anime_id === id) removeCascade(store, 'season', sid)
    for (const [eid, e] of store.episode) if (e.anime_id === id) store.episode.delete(eid)
  } else if (t === 'season') {
    for (const [eid, e] of store.episode) if (e.season_id === id) store.episode.delete(eid)
  }
}

export type ApplyResult = 'applied' | 'duplicate' | 'stale' | 'blocked' | 'needs_parent_fetch'

export function applyEvent(store: MirrorStore, ev: HubEvent): ApplyResult {
  if (store.processed.has(ev.event_id)) return 'duplicate'
  const rev = BigInt(ev.revision)
  const k = key(ev.entity_type, ev.entity_id)
  const tomb = store.tombstones.get(k)
  const local = store[ev.entity_type].get(ev.entity_id)

  if (ev.action === 'upsert') {
    if (!ev.data) return 'blocked'
    if (tomb?.kind === 'deleted') { store.processed.add(ev.event_id); return 'blocked' }
    if ((tomb && rev < tomb.revision) || (local && rev < BigInt(local.revision))) { store.processed.add(ev.event_id); return 'stale' }
    if (ev.entity_type !== 'anime') {
      const animeId = ev.data.anime_id as string | undefined
      const seasonId = ev.data.season_id as string | undefined
      if (!animeId || !store.anime.has(animeId)) return 'needs_parent_fetch'
      if (ev.entity_type === 'episode' && (!seasonId || !store.season.has(seasonId))) return 'needs_parent_fetch'
    } else if (!local) {
      // New (or republished) anime: caller should import the complete subtree via GET /v1/anime/{id}.
      store.anime.set(ev.entity_id, ev.data)
      store.tombstones.delete(k)
      store.processed.add(ev.event_id)
      return 'needs_parent_fetch'
    }
    store[ev.entity_type].set(ev.entity_id, ev.data)
    store.tombstones.delete(k)
    store.processed.add(ev.event_id)
    return 'applied'
  }

  // unpublish / delete
  if (ev.action === 'unpublish' && local && BigInt(local.revision) > rev) { store.processed.add(ev.event_id); return 'stale' }
  removeCascade(store, ev.entity_type, ev.entity_id)
  const kind: Tombstone['kind'] = ev.action === 'delete' || tomb?.kind === 'deleted' ? 'deleted' : 'unpublished'
  store.tombstones.set(k, { revision: tomb && tomb.revision > rev ? tomb.revision : rev, kind })
  store.processed.add(ev.event_id)
  return 'applied'
}

/** Apply GET /v1/anime/{id} (complete: true). Children missing from the tree are removed. */
export function applyAnimeTree(store: MirrorStore, tree: { data: Rec; seasons: Array<Rec & { episodes: Rec[] }>; complete?: boolean }) {
  const a = tree.data
  if (store.tombstones.get(key('anime', a.id))?.kind === 'deleted') return
  store.anime.set(a.id, a)
  store.tombstones.delete(key('anime', a.id))
  const keepS = new Set<string>(), keepE = new Set<string>()
  for (const s of tree.seasons) {
    const { episodes, ...season } = s
    keepS.add(s.id)
    store.season.set(s.id, season as Rec)
    for (const e of episodes) { keepE.add(e.id); store.episode.set(e.id, e) }
  }
  if (tree.complete) {
    for (const [sid, s] of store.season) if (s.anime_id === a.id && !keepS.has(sid)) removeCascade(store, 'season', sid)
    for (const [eid, e] of store.episode) if (e.anime_id === a.id && !keepE.has(eid)) store.episode.delete(eid)
  }
}

export type FetchJson = (path: string) => Promise<any>

/**
 * Safe Full Mirror import: stages everything, validates totals, and only then
 * replaces the catalogue. Any error leaves the existing store untouched.
 */
export async function fullImport(store: MirrorStore, fetchJson: FetchJson, pageSize = 200): Promise<{ ok: true; cursor: string } | { ok: false; error: string }> {
  const staged: Record<'anime' | 'seasons' | 'episodes', Rec[]> = { anime: [], seasons: [], episodes: [] }
  let cursor: string | null = null
  try {
    for (const kind of ['anime', 'seasons', 'episodes'] as const) {
      let next: string | null = null
      for (let guard = 0; guard < 10_000; guard++) {
        const page = await fetchJson(`/v1/catalog/${kind}?limit=${pageSize}${next ? `&cursor=${encodeURIComponent(next)}` : ''}`)
        if (!page || !Array.isArray(page.data) || !page.page) throw new Error(`malformed ${kind} page`)
        if (kind === 'anime' && !next) cursor = page.changes_cursor ?? null
        staged[kind].push(...page.data)
        if (!page.page.has_more) break
        if (!page.page.next_cursor) throw new Error(`missing next_cursor for ${kind}`)
        next = page.page.next_cursor
      }
    }
    const stats = await fetchJson('/v1/catalog/stats')
    const t = stats?.totals
    if (!t || t.anime !== staged.anime.length || t.seasons !== staged.seasons.length || t.episodes !== staged.episodes.length) {
      throw new Error('snapshot totals do not match /v1/catalog/stats; retry later')
    }
    if (!cursor) throw new Error('first page had no changes_cursor')
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  // Commit: upsert everything, then remove only records absent from the complete snapshot.
  const swap = (t: EntityType, rows: Rec[]) => {
    const ids = new Set(rows.map((r) => r.id))
    for (const r of rows) {
      const local = store[t].get(r.id)
      if (store.tombstones.get(key(t, r.id))?.kind === 'deleted') continue
      if (!local || BigInt(r.revision) >= BigInt(local.revision)) store[t].set(r.id, r)
      store.tombstones.delete(key(t, r.id))
    }
    for (const id of [...store[t].keys()]) if (!ids.has(id)) store[t].delete(id)
  }
  swap('anime', staged.anime)
  swap('season', staged.seasons)
  swap('episode', staged.episodes)
  store.cursor = cursor
  return { ok: true, cursor: cursor! }
}
