import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildSources, generateEmbedToken, isProcessing } from '../_shared/embedSource.ts';

const EMBED_ORIGIN = 'https://animesavi.cloudsavi';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type Action = 'ensure' | 'generate' | 'regenerate' | 'disable' | 'test' | 'status';
const ACTIONS: Action[] = ['ensure', 'generate', 'regenerate', 'disable', 'test', 'status'];

interface Check { step: string; ok: boolean; detail?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '') as Action;
    const episodeId = typeof body?.episodeId === 'string' ? body.episodeId.trim() : '';

    if (!ACTIONS.includes(action)) return json({ error: 'Unsupported action.' }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(episodeId)) return json({ error: 'A valid episodeId is required.' }, 400);

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { data: userData } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    const user = userData?.user;
    if (!user) return json({ error: 'Invalid session.' }, 401);

    // --- Load episode + ownership chain -------------------------------------
    const { data: episode } = await admin
      .from('episodes')
      .select('id, title, episode_number, video_url, external_url, season_id')
      .eq('id', episodeId)
      .maybeSingle();
    if (!episode) return json({ error: 'Episode not found.' }, 404);

    const { data: season } = await admin
      .from('seasons').select('id, anime_id').eq('id', episode.season_id).maybeSingle();
    const { data: anime } = season?.anime_id
      ? await admin.from('anime').select('id, uploader_id').eq('id', season.anime_id).maybeSingle()
      : { data: null };

    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin' || r.role === 'moderator');
    const isOwner = anime?.uploader_id === user.id;
    if (!isAdmin && !isOwner) return json({ error: 'You do not have permission to manage this embed.' }, 403);

    // --- Playback source ----------------------------------------------------
    const { data: conversion } = await admin
      .from('video_conversions')
      .select('hls_url, ios_ready_url, status, conversion_progress, conversion_stage, error_message')
      .eq('episode_id', episode.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sources = buildSources(episode, conversion ?? null);
    const processing = isProcessing(conversion ?? null);

    const { data: existing } = await admin
      .from('video_embeds')
      .select('id, token, status, playback_url, playback_type, error_message, created_at')
      .eq('episode_id', episode.id)
      .neq('status', 'DISABLED')
      .maybeSingle();

    const publicUrl = (token: string) => `${EMBED_ORIGIN}/${token}`;

    /** Keep the episode's `external_url` pointing at its own public embed link,
     *  so "Use Embed Player" works everywhere. Never overwrites a third-party URL. */
    const syncExternalUrl = async (token: string) => {
      const target = publicUrl(token);
      const current = (episode.external_url ?? '').trim();
      const ownEmbed = /^https?:\/\/(www\.)?animesavi\.(com|cloudsavi)\/[A-Za-z0-9]{4,24}\/?$/i.test(current);
      if (current && !ownEmbed) return;
      if (current === target) return;
      await admin.from('episodes').update({ external_url: target }).eq('id', episode.id);
    };


    if (action === 'status') {
      return json(existing
        ? { exists: true, token: existing.token, url: publicUrl(existing.token), status: existing.status,
            error: existing.error_message }
        : { exists: false });
    }

    if (action === 'disable') {
      if (!existing) return json({ error: 'No active embed to disable.' }, 404);
      await admin.from('video_embeds').update({ status: 'DISABLED' }).eq('id', existing.id);
      return json({ disabled: true, token: existing.token });
    }

    if (action === 'test') {
      const checks: Check[] = [];
      checks.push({ step: 'Token valid', ok: !!existing, detail: existing?.token ?? 'No token generated yet' });
      checks.push({ step: 'Mapping valid', ok: !!existing && existing.status !== 'DISABLED' });
      checks.push({ step: 'Video found', ok: true, detail: `Episode ${episode.episode_number} — ${episode.title}` });
      checks.push({
        step: 'Playback source available',
        ok: sources.length > 0,
        detail: sources[0]?.url ? `${sources[0].type.toUpperCase()} · ${sources[0].label}` :
          processing ? 'Still encoding' : 'No source',
      });

      let resolverOk = false;
      let resolverDetail = 'No token to resolve';
      if (existing) {
        try {
          const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/embed-resolve/${existing.token}`);
          const payload = await res.json();
          resolverOk = payload?.status === 'READY' || payload?.status === 'PROCESSING';
          resolverDetail = payload?.status === 'READY'
            ? 'Resolver returned a playable source'
            : `Resolver status: ${payload?.status} — ${payload?.reason ?? ''}`;
        } catch (e) {
          resolverDetail = (e as Error).message;
        }
      }
      checks.push({ step: 'Embed ready', ok: resolverOk, detail: resolverDetail });

      return json({
        ok: checks.every((c) => c.ok),
        checks,
        token: existing?.token ?? null,
        url: existing ? publicUrl(existing.token) : null,
      });
    }

    // --- ensure / generate / regenerate --------------------------------------
    if (action === 'ensure' && existing) {
      // Keep the mapping pointed at the current valid source (video replacement).
      const status = sources.length ? 'READY' : processing ? 'PROCESSING' : 'FAILED';
      await admin.from('video_embeds').update({
        status,
        playback_url: sources[0]?.url ?? null,
        playback_type: sources[0]?.type ?? null,
        error_message: sources.length ? null : (conversion?.error_message ?? 'No playback source yet.'),
        last_verified_at: new Date().toISOString(),
      }).eq('id', existing.id);
      await syncExternalUrl(existing.token);
      return json({ created: false, token: existing.token, url: publicUrl(existing.token), status });
    }

    if (action === 'regenerate' && existing) {
      await admin.from('video_embeds').update({ status: 'DISABLED' }).eq('id', existing.id);
    }
    if (action === 'generate' && existing) {
      await syncExternalUrl(existing.token);
      return json({ created: false, token: existing.token, url: publicUrl(existing.token), status: existing.status });
    }

    if (!sources.length && !processing) {
      return json({
        error: 'No valid playback source yet. Upload or finish encoding the video first.',
        status: 'FAILED',
      }, 409);
    }

    // Unique token with collision retry.
    let token = '';
    let inserted: { id: string; token: string } | null = null;
    for (let attempt = 0; attempt < 6 && !inserted; attempt++) {
      token = generateEmbedToken(8);
      const { data, error } = await admin.from('video_embeds').insert({
        token,
        episode_id: episode.id,
        playback_url: sources[0]?.url ?? null,
        playback_type: sources[0]?.type ?? null,
        status: sources.length ? 'READY' : 'PROCESSING',
        created_by: user.id,
        last_verified_at: new Date().toISOString(),
      }).select('id, token').maybeSingle();
      if (!error && data) inserted = data;
      else if (error && !/duplicate key/i.test(error.message)) {
        return json({ error: `Could not save embed mapping: ${error.message}` }, 500);
      }
    }
    if (!inserted) return json({ error: 'Could not allocate a unique embed token.' }, 500);

    // Verification pass — never report success without a real resolution.
    let verified = false;
    let verifyReason = '';
    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/embed-resolve/${inserted.token}`);
      const payload = await res.json();
      verified = payload?.status === 'READY' || payload?.status === 'PROCESSING';
      verifyReason = payload?.reason ?? payload?.status ?? '';
      if (!verified) {
        await admin.from('video_embeds')
          .update({ status: 'FAILED', error_message: verifyReason || 'Verification failed.' })
          .eq('id', inserted.id);
      }
    } catch (e) {
      verifyReason = (e as Error).message;
      await admin.from('video_embeds')
        .update({ status: 'FAILED', error_message: verifyReason }).eq('id', inserted.id);
    }

    if (!verified) {
      return json({ created: true, verified: false, token: inserted.token,
        url: publicUrl(inserted.token), status: 'FAILED', error: verifyReason }, 200);
    }

    await syncExternalUrl(inserted.token);

    return json({
      created: true,
      verified: true,
      token: inserted.token,
      url: publicUrl(inserted.token),
      status: sources.length ? 'READY' : 'PROCESSING',
    });
  } catch (err) {
    return json({ error: (err as Error).message ?? 'Unexpected error.' }, 500);
  }
});
