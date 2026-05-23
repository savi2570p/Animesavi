## Goals

1. Remove the **ShadowFlx** tab and route (`/shadowflix`) from the main app.
2. Create a new **Flox Anime India +** tab using the uploaded logo, route `/flox`.
3. Admin-only upload (gated to `Savi2570p@gmail.com`) for:
   - Banner image (file manager)
   - Poster image (file manager)
   - Episode video: either an **embed link** or a **video file** (file manager)
4. New dedicated, ultra-minimal **flat** video player for Flox content with only: Play/Pause, Timeline, 10s skip back/forward, Fullscreen. No download, no quality/audio/captions menu, no share.
5. Add a strong client-side **anti-piracy hardening layer**, applied across the site and especially inside Flox.

## What to build

### Removal
- Delete tab entry and `isOnShadowFlix` logic in `ContentNavTabs.tsx`.
- Remove `/shadowflix` route and lazy import in `App.tsx`.
- Keep `ShadowFlix.tsx` file but stop routing to it (safer than breaking imports elsewhere).

### Flox Anime India + tab
- Copy uploaded logo into `src/assets/flox-anime-india-logo.jpg`.
- Add tab `{ to: '/flox', label: 'Flox Anime India +', customIcon: floxLogo }`.
- New `src/pages/FloxAnimePage.tsx`:
  - Public grid view of Flox content (banner + poster cards).
  - Admin-only upload panel visible only when `user.email === 'savi2570p@gmail.com'`.
  - Form fields: Title, Banner upload, Poster upload, Source type (`embed` | `file`), and either Embed URL or Video file upload.
  - Stores rows in a new `flox_content` table (created via migration).
  - Banner/poster/video uploads use existing `media` Supabase Storage bucket (reusing current upload helpers).

### Custom Flox player (`src/components/video/FloxPlayer.tsx`)
- 100% flat controls bar, single row, monochrome:
  - ⏮ -10s · Play/Pause · +10s ⏭ · Timeline (thin 2px bar, no thumb glow) · Fullscreen
- For `embed` source: render a sandboxed iframe (no controls bar shown).
- For `file` source: HTML5 `<video>` with custom controls overlay (no `controlsList="download"`, no native context menu).
- Disables right-click, drag, picture-in-picture, remote playback, and download via `controlsList="nodownload noremoteplayback noplaybackrate"` and `disablePictureInPicture`.

### Anti-piracy layer (`src/lib/antiPiracy.ts` + `useAntiPiracy` hook)
Realistic, production-ready protections. (Browsers cannot truly stop screen recording or determined extraction — I'll implement the strongest viable set and document the limits inline.)
- Global right-click → pause any `<video>`, clear `src`, redirect to `/`.
- Key blockers: F12, Ctrl/Cmd+Shift+I/J/C, Ctrl/Cmd+U, Ctrl/Cmd+S, Ctrl/Cmd+P, Ctrl/Cmd+C inside player.
- CSS `user-select:none`, `-webkit-touch-callout:none`, `pointer-events` guards on `<video>` overlays, `draggable={false}` on images.
- DevTools heuristic detection (window size delta + `debugger` timing trap). On detection: pause video, blur `<main>`, show full-screen red neon overlay "Inspection blocked".
- iOS/Android long-press suppression on video container.
- Iframe break-out: `if (window.top !== window.self) window.top.location = window.location;` for Flox pages.
- Screen-capture *best-effort*: listen for `navigator.mediaDevices.getDisplayMedia` calls originating from the page (monkey-patch) → block + warn. Browsers do not expose external OS-level recording; that limit is documented.
- All effects live behind `<AntiPiracyShield strict />` wrapper used on Flox pages and the Flox player; a lighter version applied app-wide.

### Premium warning overlay
- `src/components/security/SecurityOverlay.tsx`: fullscreen, red neon scanline animation, "Inspection / Recording detected" message, "Return Home" button.

## Out of scope / honest limits

The following from the brief cannot be fully delivered from the frontend alone and would require backend infrastructure I won't fake:
- **Tokenized signed HLS / expiring URLs / hotlink validation / Cloudflare signed playback** — requires a CDN + signing service. I'll leave a TODO in the player explaining what to plug in.
- **True screen-recording detection** on iOS/Android/Desktop — OS-level, not exposable to web pages. I'll implement only `getDisplayMedia` interception (browser-level screen-share).
- **Obfuscation of bundled JS** — Vite already minifies; meaningful obfuscation belongs in the build pipeline, not source.

I'll surface these as inline `// LIMITATION:` notes so it's clear what's enforced vs aspirational.

## Files

Create:
- `src/assets/flox-anime-india-logo.jpg`
- `src/pages/FloxAnimePage.tsx`
- `src/components/video/FloxPlayer.tsx`
- `src/lib/antiPiracy.ts`
- `src/hooks/useAntiPiracy.ts`
- `src/components/security/SecurityOverlay.tsx`
- `src/components/security/AntiPiracyShield.tsx`

Edit:
- `src/components/layout/ContentNavTabs.tsx` (swap tab)
- `src/App.tsx` (route swap + global shield)
- `src/index.css` (security overlay + no-select utilities)

Migration:
- New table `flox_content` with `title`, `banner_url`, `poster_url`, `source_type` (`embed`|`file`), `source_url`, plus RLS: public SELECT, INSERT/UPDATE/DELETE restricted to the admin email.

## Confirm

Proceed with this scope? In particular confirm:
- New route name `/flox` is fine.
- It's OK to keep `ShadowFlix.tsx` file present but unrouted.
- You accept the honest limits called out under *Out of scope*.