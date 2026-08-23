import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildSources, isProcessing } from '../_shared/embedSource.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const fromPath = url.pathname.split('/').filter(Boolean).pop() ?? '';
    const raw = url.searchParams.get('token') ?? (fromPath === 'embed-resolve' ? '' : fromPath);
    const token = raw.trim();
    const episodeIdParam = (url.searchParams.get('episodeId') ?? '').trim();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // Public token lookup by episode — lets the main player's "Use Embed Player"
    // button find the episode's public token without exposing anything else.
    if (!token && episodeIdParam) {
      if (!/^[0-9a-f-]{36}$/i.test(episodeIdParam)) {
        return json({ status: 'NOT_FOUND', reason: 'Invalid episode id.' }, 404);
      }
      const { data } = await supabase
        .from('video_embeds')
        .select('token, status')
        .eq('episode_id', episodeIdParam)
        .neq('status', 'DISABLED')
        .maybeSingle();
      return data
        ? json({ token: data.token, status: data.status })
        : json({ status: 'NOT_FOUND', reason: 'No embed for this episode.' }, 404);
    }

    if (!token || !/^[A-Za-z0-9]{4,24}$/.test(token)) {
      return json({ status: 'NOT_FOUND', reason: 'Invalid embed token.' }, 404);
    }


    const { data: embed, error: embedError } = await supabase
      .from('video_embeds')
      .select('id, token, episode_id, status, playback_url, playback_type, error_message')
      .eq('token', token)
      .maybeSingle();

    if (embedError) return json({ status: 'FAILED', reason: 'Embed lookup failed.' }, 500);
    if (!embed) return json({ status: 'NOT_FOUND', reason: 'This embed link does not exist.' }, 404);
    if (embed.status === 'DISABLED') {
      return json({ status: 'DISABLED', reason: 'This embed link has been disabled.' }, 410);
    }
    if (!embed.episode_id) {
      return json({ status: 'FAILED', reason: 'Embed is not linked to a video.' }, 404);
    }

    const { data: episode } = await supabase
      .from('episodes')
      .select('id, title, episode_number, thumbnail, duration, video_url, external_url, captions_url, season_id')
      .eq('id', embed.episode_id)
      .maybeSingle();

    if (!episode) {
      await supabase.from('video_embeds')
        .update({ status: 'FAILED', error_message: 'Linked video no longer exists.' })
        .eq('id', embed.id);
      return json({ status: 'FAILED', reason: 'The linked video was deleted.' }, 404);
    }

    const [{ data: season }, { data: conversion }] = await Promise.all([
      supabase.from('seasons').select('id, season_number, anime_id').eq('id', episode.season_id).maybeSingle(),
      supabase
        .from('video_conversions')
        .select('hls_url, ios_ready_url, status, conversion_progress, conversion_stage, error_message')
        .eq('episode_id', episode.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let animeTitle: string | null = null;
    let poster: string | null = null;
    if (season?.anime_id) {
      const { data: anime } = await supabase
        .from('anime').select('title, cover_image, banner_image').eq('id', season.anime_id).maybeSingle();
      animeTitle = anime?.title ?? null;
      poster = anime?.banner_image ?? anime?.cover_image ?? null;
    }

    const allSources = buildSources(episode, conversion ?? null);

    // Drop sources whose file no longer exists (failed/partial uploads leave
    // dead storage URLs behind) so the player never shows a false error.
    const reachable = await Promise.all(
      allSources.map(async (s) => {
        try {
          const probe = await fetch(s.url, { method: 'GET', headers: { Range: 'bytes=0-1' } });
          try { await probe.body?.cancel(); } catch { /* ignore */ }
          return probe.ok || probe.status === 206 || probe.status === 405 ? s : null;
        } catch {
          return null;
        }
      }),
    );
    const liveSources = reachable.filter((s): s is NonNullable<typeof s> => s !== null);
    const sources = liveSources.length > 0 ? liveSources : [];

    const meta = {
      token: embed.token,
      title: episode.title,
      episodeNumber: episode.episode_number,
      seasonNumber: season?.season_number ?? null,
      animeTitle,
      poster: episode.thumbnail || poster,
      duration: episode.duration,
      captions: episode.captions_url || null,
    };

    if (sources.length === 0) {
      const processing = isProcessing(conversion ?? null);
      const status = processing ? 'PROCESSING' : 'FAILED';
      const reason = processing
        ? 'Video is still processing.'
        : allSources.length > 0
          ? 'The video file for this episode is missing or was not uploaded completely. Please re-upload it.'
          : conversion?.error_message || 'No playback source is available for this video yet.';


      if (embed.status !== status) {
        await supabase.from('video_embeds').update({ status, error_message: reason }).eq('id', embed.id);
      }
      return json({
        status,
        reason,
        progress: conversion?.conversion_progress ?? null,
        stage: conversion?.conversion_stage ?? null,
        ...meta,
      }, 200);
    }

    // Playback exists → keep the mapping fresh and mark it ready.
    if (embed.status !== 'READY' || embed.playback_url !== sources[0].url) {
      await supabase.from('video_embeds').update({
        status: 'READY',
        playback_url: sources[0].url,
        playback_type: sources[0].type,
        error_message: null,
        last_verified_at: new Date().toISOString(),
      }).eq('id', embed.id);
    }

    return json({ status: 'READY', sources, source: sources[0], ...meta });
  } catch (err) {
    return json({ status: 'FAILED', reason: (err as Error).message ?? 'Unexpected resolver error.' }, 500);
  }
});
