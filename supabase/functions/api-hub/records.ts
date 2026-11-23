// Maps AnimeSavi database rows to the public API Hub record shapes.
// Field selection lives here so every endpoint and webhook returns the same JSON.

export const SITE_URL = 'https://animesavi.com'

export const ANIME_COLUMNS =
  'id,title,description,cover_image,banner_image,genres,release_year,status,type,trailer_url,is_crunchyroll,' +
  'schedule_day,studio,total_episodes,source_material,content_rating,is_eng_dub,is_sub_only,created_at,updated_at,content_revision'
export const SEASON_COLUMNS = 'id,anime_id,season_number,title,release_date,created_at,content_revision'
export const EPISODE_COLUMNS =
  'id,anime_id,season_id,episode_number,title,description,thumbnail,video_url,sub_video_url,external_url,duration,' +
  'audio_language,captions_url,intro_start_time,intro_end_time,outro_start_time,outro_end_time,created_at,content_revision'

type Row = Record<string, any>

const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const nonEmpty = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : null)

export function animeLanguages(a: Row) {
  if (a.is_sub_only) return { audio: ['ja'], subtitles: ['en'], label: 'Japanese (SUB)' }
  if (a.is_eng_dub) return { audio: ['en'], subtitles: [], label: 'English Dub' }
  return { audio: ['hi'], subtitles: [], label: 'Hindi Dub' }
}

export function mapAnime(a: Row) {
  return {
    object: 'anime' as const,
    id: a.id as string,
    revision: str(a.content_revision)!,
    title: a.title as string,
    description: a.description ?? null,
    poster_url: nonEmpty(a.cover_image),
    banner_url: nonEmpty(a.banner_image),
    genres: Array.isArray(a.genres) ? a.genres : [],
    rating: { content_rating: a.content_rating ?? null },
    languages: animeLanguages(a),
    format: a.type ?? null,
    release: {
      year: a.release_year ?? null,
      status: a.status ?? null,
      schedule_day: a.schedule_day ?? null,
      total_episodes: a.total_episodes ?? null,
    },
    studio: a.studio ?? null,
    source_material: a.source_material ?? null,
    trailer_url: nonEmpty(a.trailer_url),
    collections: { crunchyroll: !!a.is_crunchyroll },
    visibility: 'published' as const,
    page_url: `${SITE_URL}/anime/${a.id}`,
    created_at: a.created_at,
    updated_at: a.updated_at,
  }
}

export function mapSeason(s: Row) {
  return {
    object: 'season' as const,
    id: s.id as string,
    anime_id: s.anime_id as string,
    revision: str(s.content_revision)!,
    season_number: s.season_number as number,
    title: s.title ?? null,
    release_date: s.release_date ?? null,
    visibility: 'published' as const,
    created_at: s.created_at,
  }
}

export function mapEpisode(e: Row) {
  return {
    object: 'episode' as const,
    id: e.id as string,
    anime_id: e.anime_id as string,
    season_id: e.season_id as string,
    revision: str(e.content_revision)!,
    episode_number: e.episode_number as number,
    title: e.title as string,
    description: e.description ?? null,
    poster_url: nonEmpty(e.thumbnail),
    duration_seconds: e.duration ?? null,
    audio_language: e.audio_language ?? null,
    streams: {
      video_url: nonEmpty(e.video_url),
      sub_video_url: nonEmpty(e.sub_video_url),
      embed_url: nonEmpty(e.external_url),
    },
    captions_url: nonEmpty(e.captions_url),
    intro: { start: e.intro_start_time ?? null, end: e.intro_end_time ?? null },
    outro: { start: e.outro_start_time ?? null, end: e.outro_end_time ?? null },
    visibility: 'published' as const,
    watch_url: `${SITE_URL}/watch/${e.id}`,
    created_at: e.created_at,
  }
}

export type PublicAnime = ReturnType<typeof mapAnime>
export type PublicSeason = ReturnType<typeof mapSeason>
export type PublicEpisode = ReturnType<typeof mapEpisode>
