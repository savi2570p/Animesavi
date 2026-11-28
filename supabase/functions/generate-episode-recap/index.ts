// Generate a ~30 second AI recap for an episode and store it on the row.
// Cached recaps are public; generating or replacing one requires the anime's
// uploader or an admin, with per-account throttling.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const raw = await req.text();
    if (raw.length > 4096) return json({ error: 'Request too large.' }, 413);
    const body = raw ? JSON.parse(raw) : {};
    const episodeId = typeof body?.episode_id === 'string' ? body.episode_id : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(episodeId)) {
      return json({ error: 'A valid episode_id is required.' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { data: ep, error: epErr } = await supabase
      .from('episodes')
      .select('id, title, episode_number, description, ai_recap, season_id, seasons:season_id (season_number, anime_id, anime:anime_id (title, description, genres, uploader_id))')
      .eq('id', episodeId)
      .maybeSingle();
    if (epErr || !ep) return json({ error: 'Episode not found.' }, 404);

    if (ep.ai_recap && body?.force !== true) {
      return json({ ok: true, recap: ep.ai_recap, cached: true });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401);
    const { data: userData, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
    const user = userData?.user;
    if (authError || !user) return json({ error: 'Invalid session.' }, 401);

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const roleNames = (roles ?? []).map((row: { role: string }) => row.role);
    const season: any = Array.isArray(ep.seasons) ? ep.seasons[0] : ep.seasons;
    const anime: any = season ? (Array.isArray(season.anime) ? season.anime[0] : season.anime) : null;
    const isAdmin = roleNames.includes('admin');
    const isOwningUploader = roleNames.includes('uploader') && anime?.uploader_id === user.id;
    if (!isAdmin && !isOwningUploader) return json({ error: 'Uploader access required.' }, 403);

    const limited = await enforceRateLimit({
      req,
      action: 'recap:generate',
      identity: user.id,
      limit: 10,
      windowSeconds: 3600,
      corsHeaders,
    });
    if (limited) return limited;

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return json({ error: 'Recap service unavailable.' }, 503);

    const animeTitle = anime?.title ?? 'this anime';
    const synopsis = (anime?.description ?? '').slice(0, 1200);
    const genres: string[] = anime?.genres ?? [];
    const seasonNum = season?.season_number ?? 1;
    const epNum = ep.episode_number ?? 1;
    const epTitle = ep.title ?? `Episode ${epNum}`;

    const prompt = `Write a "Previously on" style 30-second recap (about 70-90 words, spoken aloud at a calm narrator pace) that catches a returning viewer up before they watch ${animeTitle}, Season ${seasonNum}, Episode ${epNum}: "${epTitle}".

Series synopsis: ${synopsis || '(unavailable)'}
Genres: ${genres.join(', ') || '(unavailable)'}

Constraints:
- Do NOT spoil this episode (Episode ${epNum}). Only recap the world, characters, stakes, and momentum heading into it.
- Open with a hook ("Previously…", "On ${animeTitle}…", or similar).
- One paragraph, no headings, no bullet points, no episode title prefix.
- Plain text only.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': apiKey },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You write short, punchy anime recaps in the voice of a Netflix-style narrator.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!aiRes.ok) return json({ error: 'Recap generation failed.' }, 502);

    const aiJson = await aiRes.json();
    const recap: string = aiJson?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!recap) return json({ error: 'Recap generation returned no text.' }, 502);

    const { error: upErr } = await supabase
      .from('episodes')
      .update({ ai_recap: recap, ai_recap_generated_at: new Date().toISOString() })
      .eq('id', episodeId);
    if (upErr) return json({ error: 'Could not save the recap.' }, 500);

    return json({ ok: true, recap });
  } catch {
    return json({ error: 'Invalid recap request.' }, 400);
  }
});
