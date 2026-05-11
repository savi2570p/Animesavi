// Sends Web Push notifications to all users who favorited an anime
// whenever a new episode is inserted. Falls back to the in-app
// notification_queue when push delivery fails.
//
// Triggered by a DB trigger on `episodes` (after insert) and can also
// be invoked manually with { episode_id } in the JSON body.

// @ts-ignore - npm specifier resolved at runtime
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@animesavi.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { episode_id } = await req.json();
    if (!episode_id) {
      return new Response(JSON.stringify({ error: 'episode_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load episode + season + anime
    const { data: ep, error: epErr } = await supabase
      .from('episodes')
      .select('id, title, episode_number, thumbnail, season:season_id(id, season_number, anime:anime_id(id, title, cover_image))')
      .eq('id', episode_id)
      .maybeSingle();

    if (epErr || !ep || !(ep as any).season?.anime) {
      console.log('[send-episode-push] episode/anime not found', episode_id, epErr);
      return new Response(JSON.stringify({ error: 'episode not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anime = (ep as any).season.anime;
    const animeId: string = anime.id;
    const animeTitle: string = anime.title;
    const cover: string | null = ep.thumbnail || anime.cover_image || null;
    const epNum: number = ep.episode_number;
    const link = `/anime/${animeId}`;

    // Find favorited users
    const { data: favs } = await supabase
      .from('user_favorites')
      .select('user_id')
      .eq('anime_id', animeId);

    const userIds = Array.from(new Set((favs || []).map((f: any) => f.user_id)));
    console.log('[send-episode-push]', { episode_id, animeTitle, recipients: userIds.length });

    let sent = 0, failed = 0, queued = 0, skipped = 0;

    for (const userId of userIds) {
      // Dedupe per (user, episode)
      const { error: dupErr } = await supabase
        .from('sent_push_log')
        .insert({ user_id: userId, episode_id });
      if (dupErr) { skipped++; continue; }

      const title = '🎬 New Episode Released';
      const body = `${animeTitle} Episode ${epNum} is now available to watch.`;

      // Always queue an in-app fallback row so the bell shows it.
      await supabase.from('notification_queue').insert({
        user_id: userId,
        anime_id: animeId,
        episode_id,
        title,
        body,
        image_url: cover,
        link,
        delivered_via: 'fallback',
      });
      queued++;

      // Fetch subscriptions
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', userId);

      if (!subs || subs.length === 0) continue;

      for (const s of subs) {
        const payload = JSON.stringify({
          title,
          body,
          icon: cover || undefined,
          image: cover || undefined,
          url: link,
          tag: `episode-${episode_id}`,
        });
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 60 * 24 }
          );
          sent++;
          console.log('[push sent]', userId, s.endpoint.slice(-24));
        } catch (err: any) {
          failed++;
          const code = err?.statusCode;
          console.log('[push failed]', userId, code, err?.body || err?.message);
          if (code === 404 || code === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', s.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, recipients: userIds.length, sent, failed, queued, skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[send-episode-push] error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
