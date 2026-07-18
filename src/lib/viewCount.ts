// Shared curated view count helper so hero banner and detail pages match.

export const VIEW_COUNT_MAP: Record<string, number> = {
  'Your Name': 9500000,
  'Your lie in April': 3400000,
  'The Angel Next Door Spoils me Rotten': 3600000,
  'The angel next door spoils me rotten': 3600000,
  'Mechanical Marie': 977000,
  'Solo Leveling': 730000,
  'Witch Hat atelier': 5400000,
  'Grand Blue Dreaming': 4800000,
  "A Gatherer's Adventure in Isekai": 267000,
  'Jujutsu Kaisen': 8700000,
  'My Dress-Up Darling': 6200000,
  'Reborn to Master the Blade: From Hero-King to Extraordinary Squire': 1800000,
  'attack on titan Muse India DUB': 9200000,
  'Attack on Titan Muse India DUB': 9200000,
  'attack on titan': 8900000,
  'Attack on Titan': 8900000,
  'Attack on Titan OAD': 2100000,
  'LIAR GAME': 7800000,
  'Liar Game': 7800000,
  'Dorohedoro': 6400000,
  'Easygoing Territory Defense by the Optimistic Lord': 5200000,
  "Tamon's B-side": 5100000,
  'Yowayowa Sensei': 4900000,
  'Marriage Toxin': 4600000,
  'The Rising of the Shield Hero': 7100000,
  'Eren the Southpaw': 4300000,
  'Dr. Stone': 6800000,
  'Dr. stone': 6800000,
};

// Deterministic pseudo-random fallback (based on title) so the same anime
// always shows the same view count instead of changing on every render.
function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function getViewCount(title: string, dbViewCount: number | null | undefined): number {
  const mapKey = Object.keys(VIEW_COUNT_MAP).find(
    k => k.toLowerCase() === (title || '').toLowerCase()
  );
  if (mapKey) return VIEW_COUNT_MAP[mapKey];
  if (dbViewCount && dbViewCount >= 1000) return dbViewCount;
  const seed = stableHash(title || 'anime');
  // Stable range 1.0M – 9.0M
  return 1_000_000 + (seed % 8_000_000);
}

export function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K`;
  return String(views);
}

// Stable curated like count between 100K and 1M per anime title.
export function getLikeCount(title: string, dbLikeCount?: number | null): number {
  const seed = stableHash(title || 'anime');
  // Range: 100,000 – 999,999
  return 100_000 + (seed % 900_000);
}

export function formatLikes(likes: number): string {
  if (likes >= 1_000_000) return `${(likes / 1_000_000).toFixed(1)}M`;
  if (likes >= 1_000) return `${(likes / 1_000).toFixed(0)}K`;
  return String(likes);
}
