// Trimmed copies of real API Hub responses (captured Nov 23, 2026) for the docs page.
// The live tester on /developers always shows current data.
export const SAMPLE_ANIME = {
  object: 'anime', id: '0212cbd2-0263-48ad-8875-4716023402fe', revision: '6215', title: 'Overgeared',
  description: 'Shin Youngwoo (a.k.a. Grid), an unlucky man in life and a low-level player…',
  poster_url: 'https://…/anime-thumbnails/covers/1790541853717-56s581q9haq.jpg',
  banner_url: 'https://…/anime-thumbnails/banners/1790541802759-03sx9iw0fqbv.jpg',
  genres: ['Action', 'Adventure', 'Fantasy', 'Crunchyroll'],
  rating: { content_rating: null },
  languages: { audio: ['hi'], subtitles: [], label: 'Hindi Dub' },
  format: 'series',
  release: { year: 2026, status: 'ongoing', schedule_day: 0, total_episodes: 12 },
  studio: 'EGG FIRM', source_material: null, trailer_url: null,
  collections: { crunchyroll: true }, visibility: 'published',
  page_url: 'https://animesavi.com/anime/0212cbd2-0263-48ad-8875-4716023402fe',
  created_at: '2026-09-27T20:44:18.620526+00:00', updated_at: '2026-11-23T06:07:51.000000+00:00',
}

export const SAMPLE_SEASON = {
  object: 'season', id: 'c3fb5b7a-7166-4307-aa05-4ffcbffe5b8f', anime_id: '0212cbd2-0263-48ad-8875-4716023402fe',
  revision: '649', season_number: 1, title: null, release_date: null, visibility: 'published',
  created_at: '2026-09-27T20:44:26.164813+00:00',
}

export const SAMPLE_EPISODE = {
  object: 'episode', id: '0d43d3e7-5cd0-4b72-a0d8-309cfc5d157f', anime_id: '0212cbd2-0263-48ad-8875-4716023402fe',
  season_id: 'c3fb5b7a-7166-4307-aa05-4ffcbffe5b8f', revision: '6021', episode_number: 6, title: 'Overgeared',
  description: null, poster_url: 'https://…/thumbnails/1793560634730-bk6yv6qk5q.jpg', duration_seconds: null,
  audio_language: 'original',
  streams: { video_url: 'https://…/episodes/1793560627242-yccr2zt3qd.mp4', sub_video_url: null, embed_url: 'https://animesavi.com/embed/0d43d3' },
  captions_url: null, intro: { start: null, end: null }, outro: { start: null, end: null }, visibility: 'published',
  watch_url: 'https://animesavi.com/watch/0d43d3e7-5cd0-4b72-a0d8-309cfc5d157f', created_at: '2026-11-01T19:19:21.340615+00:00',
}

export const SAMPLE_WEBHOOK = {
  type: 'content.changes', api_version: '1.0.0', delivery_id: '8b615112-4846-41e9-b6e6-424e305ee2af',
  connection_id: 'e0bab3f0-c48d-476e-a4a4-6b6da6926f59', sent_at: '2026-11-23T06:07:15.775Z',
  events: [
    { event_id: 'cc9ce131-5019-4d91-9d2d-0b2b50bf7b5f', type: 'anime.upsert', entity_type: 'anime', entity_id: '0212cbd2-0263-48ad-8875-4716023402fe', anime_id: '0212cbd2-0263-48ad-8875-4716023402fe', season_id: null, action: 'upsert', revision: '6214', occurred_at: '2026-11-23T06:07:14.613482+00:00', fetch_url: '…/v1/anime/0212cbd2-0263-48ad-8875-4716023402fe', data: { object: 'anime', id: '0212cbd2-…', revision: '6214', title: 'Overgeared', '…': '…' } },
    { event_id: '5c0d…', type: 'season.delete', entity_type: 'season', entity_id: 'f251768d-…', anime_id: 'b80e4b05-…', season_id: null, action: 'delete', revision: '6219', occurred_at: '2026-11-23T06:08:20.112000+00:00', fetch_url: '…/v1/seasons/f251768d-…', data: null },
  ],
  next_cursor: 'c1.ODM4MDcyMzoy',
}
