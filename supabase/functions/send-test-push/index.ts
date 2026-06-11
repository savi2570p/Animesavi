// Sends a test push notification to all of the authenticated user's
// subscribed devices. Mirrors send-episode-push's load pattern so the
// worker never crashes at module-init.

// @ts-ignore - npm specifier resolved at runtime
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const RAW_SUBJECT = (Deno.env.get('VAPID_SUBJECT') || '').trim();
// VAPID subject must be a valid mailto: or https:// URL. Coerce anything else
// (including legacy admin-typed values like "AnimeSavi") to a safe default so
// the worker never crashes at init.
function normalizeSubject(s: string): string {
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(s)) return s;
  if (/^https:\/\/[^\s]+$/i.test(s)) return s;
  return 'mailto:admin@animesavi.com';
}
const VAPID_SUBJECT = normalizeSubject(RAW_SUBJECT);
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

let vapidReady = false;
try {
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidReady = true;
    console.log('[send-test-push] VAPID ready with subject', VAPID_SUBJECT);
  } else {
    console.error('[send-test-push] Missing VAPID keys');
  }
} catch (e) {
  console.error('[send-test-push] VAPID init failed:', e);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!vapidReady) {
      return new Response(JSON.stringify({ error: 'Push service not configured (missing VAPID keys).' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth = req.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'You must be signed in to send a test notification.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Identify caller via anon-key client w/ their JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Session expired. Please sign in again.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = userData.user;

    const { data: subs, error: subErr } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user.id);

    if (subErr) {
      console.error('[send-test-push] DB error:', subErr);
      return new Response(JSON.stringify({ error: 'Could not load your devices. Try again.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ error: 'No subscribed devices found. Enable notifications first.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title: '✅ Test Notification',
      body: 'Push notifications are working perfectly on this device.',
      url: '/',
      tag: 'test-push',
    });

    let sent = 0, failed = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 },
        );
        sent++;
      } catch (err: any) {
        failed++;
        console.error('[send-test-push] send error', err?.statusCode, err?.body || err?.message);
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, devices: subs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[send-test-push] fatal', e);
    return new Response(JSON.stringify({ error: e?.message || 'Unexpected error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
