// AnimeSavi Push + Icon-Cache Purge Service Worker
// - Handles incoming Web Push notifications and click routing.
// - On activate, force-claims clients and wipes ALL caches so stale
//   favicon / apple-touch-icon / manifest responses are dropped immediately
//   after every deploy.
// Bump SW_VERSION whenever icon assets change to guarantee a fresh activate.

const SW_VERSION = 'v3-2026-05-23';
const DEFAULT_ICON = '/logo-v2.png?v=3';
const DEFAULT_BADGE = '/logo-v2.png?v=3';

self.addEventListener('install', (event) => {
  // Activate this worker immediately, do not wait for old SW to release.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1. Take control of all open clients right now.
    await self.clients.claim();

    // 2. Purge every Cache Storage entry so stale icons / manifest /
    //    apple-touch-icon responses are forced to refetch from the network.
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    } catch (_) { /* ignore */ }

    // 3. Tell every controlled page to drop in-memory icon URLs.
    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: 'ICON_CACHE_PURGED', version: SW_VERSION }));
    } catch (_) { /* ignore */ }
  })());
});

// Network-first for icon + manifest requests — never serve a stale copy.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  const isIconAsset =
    url.pathname === '/logo-v2.png' ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/favicon.png' ||
    url.pathname === '/manifest.json' ||
    url.pathname.startsWith('/apple-touch-icon');

  if (!isIconAsset) return;

  event.respondWith((async () => {
    try {
      // Always go to network; bypass HTTP cache too.
      const fresh = await fetch(req, { cache: 'reload' });
      return fresh;
    } catch (e) {
      // Fall back to whatever the browser has if the network is offline.
      const cached = await caches.match(req);
      return cached || Response.error();
    }
  })());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    try { data = { title: 'AnimeSavi', body: event.data?.text() || '' }; } catch (_) {}
  }

  const title = data.title || '🎬 New Episode Released';
  const options = {
    body: data.body || 'A new episode is available to watch.',
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_BADGE,
    image: data.image || undefined,
    tag: data.tag || 'animesavi-episode',
    renotify: true,
    requireInteraction: false,
    // Persist the deep-link URL so notificationclick can route to the
    // exact anime/episode page even after the page is reloaded.
    data: { url: data.url || '/', ...(data.data || {}) },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      try {
        const u = new URL(c.url);
        if (u.pathname === targetUrl || c.url.endsWith(targetUrl)) {
          await c.focus();
          return;
        }
      } catch (_) {}
    }
    await self.clients.openWindow(targetUrl);
  })());
});
