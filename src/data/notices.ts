import { VERSION_GROUPS } from '@/data/releaseNotes';

export interface SiteNotice {
  id: string;
  date: string;
  category: 'Security' | 'Service update' | 'Release';
  title: string;
  summary: string;
  details: string[];
}

export const SITE_NOTICES: SiteNotice[] = [
  {
    id: 'security-fixes-2026-11-28',
    date: '2026-11-28',
    category: 'Security',
    title: 'Security fixes & stronger account protection',
    summary: 'We completed a security review and strengthened account, admin and service protections.',
    details: [
      'Admin tools and sensitive actions now check account permissions on the server.',
      'Password changes require your current password, with compromised-password screening enabled.',
      'PIN verification is server-backed. Three incorrect PIN attempts lock PIN entry for one hour.',
      'Sensitive requests have abuse limits, and unsafe external requests have been restricted.',
      'Known dependency vulnerabilities were patched, and browser content protections were strengthened.',
      'Private credentials remain on the server. The public catalogue API intentionally remains open.',
      'No website can guarantee complete protection. Use a unique password and keep your account details private.',
    ],
  },
  {
    id: 'downloads-removed-2026-11-19',
    date: '2026-11-19',
    category: 'Service update',
    title: 'Downloads have been removed',
    summary: 'Due to some restrictions, downloading and offline saving are no longer available on AnimeSavi+. Streaming is not affected.',
    details: [
      'The Download (Save Offline) button, Downloads menu page and SUB (4K+) download option have been removed.',
      'Online streaming, Favorites, Watchlist, Continue Watching, DUB and SUB servers, subtitles and Watch Party remain available.',
      'Episodes saved earlier stay on your device until you delete them or clear browser storage.',
    ],
  },
  ...VERSION_GROUPS.map((release): SiteNotice => ({
    id: `release-${release.version}`,
    date: new Date(release.date).toISOString().slice(0, 10),
    category: 'Release',
    title: `AnimeSavi+ ${release.version}`,
    summary: release.highlight,
    details: release.items.map((item) => `${item.title}: ${item.desc}`),
  })),
];

export function sortNotices(notices: readonly SiteNotice[], order: 'newest' | 'oldest'): SiteNotice[] {
  return [...notices].sort((a, b) => order === 'newest'
    ? b.date.localeCompare(a.date)
    : a.date.localeCompare(b.date));
}