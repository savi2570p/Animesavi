import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    // Fetch episodes with anime + season info, sorted latest first
    const { data: episodes, error } = await supabase
      .from('episodes')
      .select(`
        id,
        title,
        description,
        thumbnail,
        episode_number,
        created_at,
        season_id,
        seasons!inner (
          season_number,
          anime_id,
          anime!inner (
            title,
            cover_image
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    const createSlug = (title: string): string =>
      title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const result = (episodes || []).map((ep: any) => {
      const season = ep.seasons
      const anime = season?.anime
      const animeTitle = anime?.title || 'Unknown'
      const animeSlug = createSlug(animeTitle)
      const seasonNum = season?.season_number || 1
      const epNum = ep.episode_number || 1

      return {
        title: animeTitle,
        episode: `Episode ${epNum}`,
        season: `Season ${seasonNum}`,
        description: ep.description || '',
        thumbnail: ep.thumbnail || anime?.cover_image || '',
        embed: `https://animesavi.lovable.app/embed/${animeSlug}/season-${seasonNum}/episode-${epNum}`,
        created_at: ep.created_at,
      }
    })

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeaders,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
