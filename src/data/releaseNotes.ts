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

export const APP_VERSION = 'V31';
export const RELEASE_DATE = 'August 23, 2026';
export const DOWNLOAD_SIZE_MB = 30;

export const BETA_NOTE =
  'Use Embed Player is now running BETA V2.5 — a rebuilt token-based embed system with faster resolution, direct source fallback, and a dedicated liquid-glass player.';

export const VERSION_GROUPS: VersionGroup[] = [
  {
    version: 'V31',
    date: RELEASE_DATE,
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
