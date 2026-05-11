## Goals

1. Make the Anime Detail / Welcome "Start Watching" loaders feel more realistic (not perfectly linear).
2. Shrink the "What's New" popup on mobile so it fits the viewport without scroll.
3. Replace the fake in-app-only notification with a real, end-to-end Web Push system (Android Chrome, desktop browsers, iOS Safari PWA) using VAPID + Service Worker + Supabase + an edge function that fires when a new episode is inserted.

---

## 1. Realistic loaders

- Update `src/components/anime/AnimeDetailLoader.tsx` and the launch loader in `src/pages/Welcome.tsx`:
  - Replace fixed-interval progress with **easing + random micro-jitter** (variable step sizes, occasional pauses, slow-down near 90%).
  - Stage labels switch based on real milestones (image preloaded, first fetch resolved) where possible, with fallback timers.
  - Add a subtle "stall and recover" pattern so it doesn't feel scripted.

## 2. Mobile "What's New" popup

- In `src/components/UpdatePopup.tsx`:
  - Cap dialog width with `max-w-[92vw] sm:max-w-md`, reduce padding (`p-4 sm:p-6`), shrink hero/illustration height on `< sm`, scale heading from `text-2xl` to `text-lg sm:text-xl`, and constrain max-height with internal scroll (`max-h-[85dvh] overflow-y-auto`).
  - Smaller close button hit area on mobile, tighter changelog list spacing.

## 3. Real Web Push Notification System

### 3a. Database (migration)

New tables:

- `push_subscriptions`
  - `id uuid pk`, `user_id uuid not null`, `endpoint text unique not null`, `p256dh text not null`, `auth text not null`, `user_agent text`, `created_at`, `updated_at`
  - RLS: users can insert/select/update/delete only their own rows; admins can select all.
- `notification_queue` (fallback when push send fails or user has no subscription)
  - `id`, `user_id`, `anime_id`, `episode_id`, `title`, `body`, `image_url`, `link`, `is_read bool default false`, `delivered_via text` (`push` / `fallback`), `created_at`.
  - RLS: user can select/update (mark read) their own rows; service role inserts.
- `sent_push_log` (dedupe): unique `(user_id, episode_id)` to prevent duplicate sends.

### 3b. VAPID keys

- Add two secrets via `add_secret`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, plus `VAPID_SUBJECT` (mailto:...).
- The public key is also exposed to the client via a tiny edge function `get-vapid-public-key` (or hard-coded as it is meant to be public — we'll fetch it from the edge function to avoid env coupling on the client).

### 3c. Service Worker

- New file `public/push-sw.js`:
  - `push` event → `showNotification(title, { body, icon, image, badge, data: { url } })`.
  - `notificationclick` event → focus existing client or `clients.openWindow(data.url)`.
  - Compatible with iOS 16.4+ PWA (only fires when installed to home screen on iOS).
- Register from `src/hooks/usePushNotifications.ts` after permission granted; subscribe with the VAPID public key; POST subscription to Supabase via the existing client (RLS-protected insert into `push_subscriptions`, upsert on `endpoint`).
- Console logs at every step: `[push] permission`, `[push] subscribed`, `[push] saved`, `[push] failed`, `[push] denied`.

### 3d. Sender edge function

- `supabase/functions/send-episode-push/index.ts`:
  - Input: `{ episode_id }`.
  - Loads episode → season → anime + favorited user IDs (`user_favorites`).
  - For each favorited user, look up `push_subscriptions`. For each subscription, sign a VAPID JWT (using `npm:web-push` via esm) and POST to the endpoint with the payload (title, body, thumbnail, deep link to `/anime/{anime_id}` or `/watch/{episode_id}`).
  - On 404/410 from the push service → delete that subscription row.
  - Insert a row into `sent_push_log` first with `ON CONFLICT DO NOTHING` to dedupe.
  - On any failure, insert into `notification_queue` so the in-app bell still shows it (fallback path).

### 3e. Trigger on new episode

- Database trigger `after insert on episodes` → calls `pg_net.http_post` to `send-episode-push` with the new episode id (service-role auth header). This guarantees push fires even when episodes are created via dashboards or scripts.

### 3f. UI updates

- `NotificationBell.tsx`: also read from `notification_queue` (unread rows) and merge with the existing favorited-episode logic. Badge count = unread queue + unread fallback.
- `NotificationSettings.tsx`: wire the "Enable" button to the new subscribe flow, surface "Subscribed on this device" state, and a "Send test notification" button (calls a small `send-test-push` function) for debugging.
- Add a status row that warns iOS users they must "Add to Home Screen" for push to work on iOS.

### 3g. Safeguards

- Permission popup: only requested on explicit user click; never auto-prompted on page load.
- Subscriptions are upserted by `endpoint`, so re-enabling on the same device doesn't duplicate.
- `sent_push_log` unique key prevents duplicate sends for the same `(user, episode)`.
- All edge function responses include CORS headers.

---

## Technical notes

- iOS Safari supports Web Push **only** from installed PWAs (iOS 16.4+). We'll detect `navigator.standalone` / `display-mode: standalone` and show a helpful hint when not installed.
- `web-push` runs in Deno via `npm:web-push@3.6.7`.
- VAPID public key is safe to ship to clients; private key stays in edge function env only.
- Service worker is registered at the site root (`/push-sw.js`) so its scope covers the whole app. It's separate from any other SW to avoid breaking preview iframes.

---

## Files to add/edit

- Add: `public/push-sw.js`, `supabase/functions/send-episode-push/index.ts`, `supabase/functions/send-test-push/index.ts`, `supabase/functions/get-vapid-public-key/index.ts`.
- Edit: `src/hooks/usePushNotifications.ts`, `src/components/NotificationSettings.tsx`, `src/components/NotificationBell.tsx`, `src/components/UpdatePopup.tsx`, `src/components/anime/AnimeDetailLoader.tsx`, `src/pages/Welcome.tsx`.
- Migration: new tables + trigger.
- Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

After approval I'll generate VAPID keys instructions and request the three secrets, then implement everything in one pass.
