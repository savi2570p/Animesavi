import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: cors })
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const SITE = 'https://animesavi.com'

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const url = new URL(req.url)
  const key = req.headers.get('x-api-key') || url.searchParams.get('key') || ''
  if (!key || key.length > 200) return json({ error: 'Missing API key' }, 401)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: pk } = await db.from('partner_api_keys').select('id,is_active')
    .eq('key_hash', await sha256(key)).maybeSingle()
  if (!pk || !pk.is_active) return json({ error: 'Invalid API key' }, 403)
  db.from('partner_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', pk.id).then(() => {})

  const since = url.searchParams.get('since')
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '500') || 500, 1), 1000)

  let q = db.from('anime').select(`id,title,description,cover_image,banner_image,genres,release_year,status,type,
    studio,total_episodes,content_rating,is_eng_dub,is_sub_only,trailer_url,created_at,updated_at,
    seasons(id,season_number,title,release_date,is_upcoming,
      episodes(id,episode_number,title,description,thumbnail,duration,audio_language,captions_url,external_url,created_at))`)
    .eq('is_muse', false).order('updated_at', { ascending: false }).limit(limit)
  if (since) q = q.gte('updated_at', since)
  const { data, error } = await q
  if (error) return json({ error: error.message }, 500)

  const anime = (data || []).map((a: any) => {
    const s = slug(a.title)
    return {
      ...a,
      slug: s,
      audio: a.is_sub_only ? 'Japanese (SUB)' : a.is_eng_dub ? 'English Dub' : 'Hindi Dub',
      page_url: `${SITE}/anime/${a.id}`,
      seasons: (a.seasons || []).sort((x: any, y: any) => x.season_number - y.season_number).map((se: any) => ({
        ...se,
        episodes: (se.episodes || []).sort((x: any, y: any) => x.episode_number - y.episode_number).map((e: any) => ({
          ...e,
          embed_url: `${SITE}/embed/${s}/season-${se.season_number}/episode-${e.episode_number}`,
        })),
      })),
    }
  })
  return json({ count: anime.length, generated_at: new Date().toISOString(), anime })
})
