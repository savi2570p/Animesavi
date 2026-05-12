// AnimeSavi Push Service Worker
// Handles incoming Web Push notifications and click routing.
// Kept intentionally minimal — no caching, no offline handling, just push.

const DEFAULT_ICON = '/icon-512.png';
const DEFAULT_BADGE = '/icon-192.png';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Try to focus an existing tab and navigate it directly to the target.
    for (const c of all) {
      try {
        const url = new URL(c.url);
        if (url.origin === self.location.origin) {
          await c.focus();
          // postMessage so SPA can client-side-route without a hard reload.
          try { c.postMessage({ type: 'PUSH_NAVIGATE', url: target }); } catch (_) {}
          if ('navigate' in c) {
            try { await c.navigate(target); } catch (_) {}
          }
          return;
        }
      } catch (_) {}
    }
    // No tab open — open a new one straight to the deep link.
    await self.clients.openWindow(target);
  })());
});
