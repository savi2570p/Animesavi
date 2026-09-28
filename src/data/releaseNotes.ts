export type BadgeKind = 'NEW' | 'IMPROVED' | 'FIX';

export interface ChangelogItem {
  icon: string;
  title: string;
  desc: string;
  badge: BadgeKind;
}

export interface VersionGroup {
  version: string;
  date: string;
  highlight: string;
  items: ChangelogItem[];
}

export const APP_VERSION = 'S2-V1.1';
export const RELEASE_DATE = 'September 28, 2026';
export const DOWNLOAD_SIZE_MB = 10;

export const BETA_NOTE =
  'Shadow link v2 is now running BETA 2 — a minimal, branding-free standalone player with in-player episode switching and an auto-hiding title overlay.';

export const VERSION_GROUPS: VersionGroup[] = [
  {
    version: 'S2-V1.1',
    date: RELEASE_DATE,
    highlight:
      'A quick polish update — reliable phone downloads, a clearer What\'s New popup, correct SUB tags everywhere, partner sharing and smoother mobile pages.',
    items: [
      { icon: '📲', badge: 'FIX', title: 'Phone Downloads Save Properly', desc: 'Download All now gives each finished episode a "Save to device" button so videos actually land on iPhone and Android.' },
      { icon: '🈁', badge: 'FIX', title: 'Correct SUB Tags', desc: 'SUB titles no longer show H-DUB on detail, Latest Series, Latest Episodes or Browse — and More Info shows "Japanese" audio.' },
      { icon: '📱', badge: 'FIX', title: 'Mobile Detail Page', desc: 'The loading screen now fills the whole screen and the bottom bar stays at the bottom on iOS and Android.' },
      { icon: '🔗', badge: 'IMPROVED', title: 'Cleaner Shadow Link', desc: 'Episode switching moved inside the player and servers were removed for a simpler viewing experience.' },
      { icon: '👁️', badge: 'IMPROVED', title: 'Readable What\'s New', desc: 'The update popup now uses a solid card with brighter text so everything is easy to read.' },
      { icon: '🤝', badge: 'NEW', title: 'Partner Sites', desc: 'Partner sites like Flox Anime India can now automatically receive new anime and play embed links.' },
      { icon: '⬆️', badge: 'FIX', title: 'Uploader Editing', desc: 'Uploaders can now open and save edits to any series without being sent back to Upload.' },
      { icon: '🐞', badge: 'FIX', title: 'General Bug Fixes', desc: 'Various stability and layout fixes across the app.' },
    ],
  },
  {
    version: 'S2-V1',
    date: 'September 23, 2026',
    highlight:
      'Season 2 begins — the fastest AnimeSavi yet. Faster startup on iOS, Android and PC, lighter 4K streaming, a new SUB-ONLY tab and a long list of fixes.',
    items: [
      { icon: '🚀', badge: 'IMPROVED', title: 'Much Faster App Startup', desc: 'The first screen now appears far sooner on iOS, Android and PC — background checks, popups and extras load only after the app is on screen.' },
      { icon: '📦', badge: 'IMPROVED', title: 'Lighter Downloads', desc: 'The app is split into smaller pieces, so each visit downloads less and repeat visits open almost instantly from cache.' },
      { icon: '🪶', badge: 'IMPROVED', title: 'Smoother Everywhere', desc: 'Home rows, carousels, episode grids and page transitions glide at a steady 60 FPS, with lighter effects on older phones.' },
      { icon: '📶', badge: 'IMPROVED', title: 'Real 4K, Less Data', desc: 'True 3840×2160 playback keeps its quality while loading only what you are about to watch — faster start, fewer stalls, smaller mobile bills.' },
      { icon: '🎬', badge: 'IMPROVED', title: 'Faster Player Loading', desc: 'Quicker startup, a smaller loading spinner and a redesigned glassy buffering indicator with smarter stall detection.' },
      { icon: '🈁', badge: 'NEW', title: 'SUB-ONLY Tab', desc: 'A dedicated SUB-ONLY section on home with its own page — subbed titles now show a single green SUB tag everywhere.' },
      { icon: '🏷️', badge: 'FIX', title: 'Correct Audio Tags', desc: 'Wrong H-DUB tags no longer appear on SUB and English-dub titles across home, Latest, Browse and detail pages.' },
      { icon: '🔗', badge: 'IMPROVED', title: 'Shadow Link v2 (BETA 2)', desc: 'Episode switching now lives inside the player, servers are hidden, and the copied link opens the exact same clean player.' },
      { icon: '⬆️', badge: 'IMPROVED', title: 'Upload Reliability', desc: 'Faster large uploads with resume support, instant button response, and embed links generated automatically in the background.' },
      { icon: '📺', badge: 'FIX', title: 'Playback Fixes', desc: 'Fixed unplayable files, embed link errors, blocked sources and the occasional "could not be played" message.' },
      { icon: '🍎', badge: 'FIX', title: 'iOS Polish', desc: 'Correct navbar position, stable safe areas, fixed trending artwork and reliable sheet close buttons.' },
      { icon: '🔄', badge: 'FIX', title: 'Continue Watching', desc: 'No more old episodes resurfacing — progress auto-advances at 90% and series mark complete after the final episode.' },
      { icon: '🐞', badge: 'FIX', title: 'General Bug Fixes', desc: 'Dozens of stability, layout and interaction fixes across the whole app.' },
    ],
  },
  {
    version: 'V32',
    date: 'September 5, 2026',
    highlight:
      'A major performance and stability update with a smoother 60 FPS experience, Shadow link v2 refinements, and polished player controls.',
    items: [
      { icon: '⚡', badge: 'IMPROVED', title: '60 FPS Performance Pass', desc: 'Adaptive device-tier detection, deferred home sections, and visibility-gated animations for buttery smoothness on every device.' },
      { icon: '🌀', badge: 'IMPROVED', title: 'Liquid-Glass Buffering', desc: 'Redesigned buffering indicator with a glassy orb aesthetic and smarter stall detection for slow networks.' },
      { icon: '🔐', badge: 'NEW', title: 'End Token Option', desc: 'Verify Token dialog now lets you safely end an active session after a confirmation with issuer and timestamp details.' },
      { icon: '📅', badge: 'FIX', title: 'Schedule Reliability', desc: 'Fixed weekday ordering, 24-hour countdown for Everyday releases, and "Release date not announced" handling.' },
      { icon: '🍎', badge: 'FIX', title: 'iOS Navbar Polish', desc: 'Restored correct iOS vertical positioning and removed unwanted empty space without affecting other platforms.' },
      { icon: '🗑️', badge: 'FIX', title: 'Account Deletion', desc: 'Delete Account now properly cleans up all linked backend records and completes successfully.' },
      { icon: '🐞', badge: 'FIX', title: 'General Bug Fixes', desc: 'Various stability, layout, and interaction fixes across the app.' },
    ],
  },

  {
    version: 'V31',
    date: 'August 23, 2026',
    highlight:
      'A faster, smoother update focused on the new Schedule experience, Clone Platforms, and download reliability.',
    items: [
      { icon: '📺', badge: 'NEW', title: 'Embed Player BETA V2.5', desc: 'Brand-new token-based embed player with automatic link generation, a dedicated liquid-glass interface, and fallback source switching.' },
      { icon: '📅', badge: 'NEW', title: 'Schedule Tab', desc: 'A dedicated, timezone-aware Schedule page with weekly countdowns and a cleaner release calendar interface.' },
      { icon: '🌐', badge: 'NEW', title: 'Timezone Support', desc: 'Pick your timezone so release days, airing times, and live countdowns match your local clock.' },
      { icon: '🔗', badge: 'NEW', title: 'Clone Platforms', desc: 'New admin-managed clone embeds with a smoother, ad-unlockable viewing experience across mobile and desktop.' },
      { icon: '⏯️', badge: 'IMPROVED', title: 'Resume Downloads', desc: 'Interrupted downloads now remember progress and send a background notification when they finish.' },
      { icon: '🎬', badge: 'IMPROVED', title: 'Player Stability', desc: 'Faster load times, smaller loading spinner, and more reliable fallback switching on the watch page.' },
      { icon: '🏠', badge: 'IMPROVED', title: 'Home Polish', desc: 'Refreshed dark-purple home theme, fixed Trending banner artwork, and improved card legibility.' },
      { icon: '🔧', badge: 'FIX', title: 'Navigation Fixes', desc: 'Resolved search redirect issues and stabilized the iOS navbar during token checks.' },
      { icon: '🐞', badge: 'FIX', title: 'General Bug Fixes', desc: 'Various stability, layout, and interaction fixes across the app.' },
    ],
  },
  {
    version: 'V 30.1',
    date: 'August 7, 2026',
    highlight:
      'A brand new page joins the app, plus important bug fixes for batch downloads and playback.',
    items: [
      { icon: '🆕', badge: 'NEW', title: 'New Page Added', desc: 'A brand new page is now live in the app with a fresh liquid-glass layout.' },
      { icon: '⬇️', badge: 'FIX', title: 'Batch Download Fixed', desc: 'Selected episodes no longer cancel themselves after showing the estimated time — downloads now retry and complete.' },
      { icon: '🚀', badge: 'IMPROVED', title: 'Faster Batch Downloads', desc: 'More parallel connections and bigger chunks push downloads closer to your full line speed.' },
      { icon: '🧩', badge: 'FIX', title: 'Save Reliability', desc: 'Episodes save straight to your Downloads folder as real .mp4 files with clearer failure messages.' },
      { icon: '🐞', badge: 'FIX', title: 'General Bug Fixes', desc: 'Various stability and interface fixes across the app.' },
    ],
  },
  {
    version: 'V 30',
    date: 'August 1, 2026',
    highlight:
      'A smoother, faster update with focused improvements, key fixes, and a refreshed embed-player experience.',
    items: [
      { icon: '⚡', badge: 'IMPROVED', title: 'Faster Navigation', desc: 'Page transitions, tab switches, and scroll rows feel noticeably snappier on every device.' },
      { icon: '🪶', badge: 'IMPROVED', title: 'Smoother Scrolling', desc: 'Home carousels, episode grids, and long lists glide with buttery, frame-perfect motion.' },
      { icon: '✨', badge: 'IMPROVED', title: 'Liquid-Glass Polish', desc: 'Deeper transparency, softer blurs, and refined highlights across the entire interface.' },
      { icon: '🎬', badge: 'IMPROVED', title: 'Player Reliability', desc: 'Better source fallback, faster startup, and clearer error handling inside the video player.' },
      { icon: '🔧', badge: 'FIX', title: 'Embed Player Fixes', desc: 'Use Embed Player now routes through the correct fallback and skips blocked sources.' },
      { icon: '🔧', badge: 'FIX', title: 'Upload Stability', desc: 'Resolved stuck progress and retry issues for large video uploads.' },
      { icon: '🧪', badge: 'IMPROVED', title: 'Use Embed Player BETA 2.1', desc: 'Use embed player is still in BETA — currently running BETA 2.1 with ongoing improvements.' },
    ],
  },
];


export const BADGE_LABELS: Record<BadgeKind, string> = {
  NEW: 'NEW',
  IMPROVED: 'IMPROVED',
  FIX: 'FIXED',
};

export const BADGE_STYLES: Record<BadgeKind, string> = {
  NEW: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  IMPROVED: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  FIX: 'bg-violet-500/20 text-violet-200 border-violet-400/40',
};

export const BADGE_ICON_RINGS: Record<BadgeKind, string> = {
  NEW: 'from-emerald-500/25 to-emerald-600/15 border-emerald-500/20 shadow-emerald-900/20',
  IMPROVED: 'from-sky-500/25 to-sky-600/15 border-sky-500/20 shadow-sky-900/20',
  FIX: 'from-violet-500/25 to-purple-600/15 border-violet-400/25 shadow-purple-900/30',
};

export const BADGE_DOT: Record<BadgeKind, string> = {
  NEW: 'bg-emerald-400',
  IMPROVED: 'bg-sky-400',
  FIX: 'bg-violet-300',
};
