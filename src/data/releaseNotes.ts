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

export const APP_VERSION = 'V 30';
export const RELEASE_DATE = 'August 1, 2026';
export const DOWNLOAD_SIZE_MB = 20;

export const BETA_NOTE =
  'Use Embed Player is still in BETA — currently running BETA 2.1. Playback sources, fallbacks, and mobile compatibility are actively being improved.';

export const VERSION_GROUPS: VersionGroup[] = [
  {
    version: 'V 30',
    date: RELEASE_DATE,
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
