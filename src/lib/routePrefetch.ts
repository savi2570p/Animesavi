/**
 * Route prefetcher — speeds up SPA navigations.
 *
 * On pointer-hover (desktop) or touch-start (mobile), we look up the
 * matching lazy-imported route and trigger its dynamic import early.
 * By the time the user actually clicks, the chunk is already cached
 * by the browser, so React can mount the page instantly with no
 * Suspense fallback flash.
 */

type Importer = () => Promise<unknown>;

// Map URL path patterns → lazy importer. Order matters: more specific first.
// Each importer must point to the SAME module path used in App.tsx so the
// bundler dedupes the chunk.
const ROUTE_IMPORTERS: Array<[RegExp, Importer]> = [
  [/^\/welcome$/, () => import('@/pages/Welcome')],
  [/^\/browse/, () => import('@/pages/Browse')],
  [/^\/anime\//, () => import('@/pages/AnimeDetail')],
  [/^\/watch\//, () => import('@/pages/Watch')],
  [/^\/favorites/, () => import('@/pages/Favorites')],
  [/^\/history/, () => import('@/pages/History')],
  [/^\/downloads/, () => import('@/pages/Downloads')],
  [/^\/watchlist/, () => import('@/pages/WatchList')],
  [/^\/schedule/, () => import('@/pages/Schedule')],
  [/^\/upcoming/, () => import('@/pages/UpcomingPage')],
  [/^\/latest-series/, () => import('@/pages/LatestSeriesPage')],
  [/^\/latest-episodes/, () => import('@/pages/LatestEpisodesPage')],
  [/^\/latest-movies/, () => import('@/pages/LatestMoviesPage')],
  [/^\/crunchy/, () => import('@/pages/CrunchyPage')],
  [/^\/musein/, () => import('@/pages/MuseINPage')],
  [/^\/profile/, () => import('@/pages/Profile')],
  [/^\/settings/, () => import('@/pages/Settings')],
  [/^\/stats/, () => import('@/pages/UserStats')],
  [/^\/upload\/anime\/[^/]+\/episode\//, () => import('@/pages/EpisodeEdit')],
  [/^\/upload\/anime\//, () => import('@/pages/UploadAnimeEdit')],
  [/^\/upload/, () => import('@/pages/Upload')],
  [/^\/admin/, () => import('@/pages/Admin')],
  [/^\/pending-upload/, () => import('@/pages/PendingUploadPage')],
  [/^\/shadowflix/, () => import('@/pages/ShadowFlix')],
];

const prefetched = new Set<string>();

function findImporter(path: string): Importer | null {
  for (const [re, imp] of ROUTE_IMPORTERS) {
    if (re.test(path)) return imp;
  }
  return null;
}

export function prefetchRoute(path: string) {
  if (!path || prefetched.has(path)) return;
  const importer = findImporter(path);
  if (!importer) return;
  prefetched.add(path);
  // Fire and forget — errors are non-fatal (the real navigation will surface them).
  importer().catch(() => prefetched.delete(path));
}

/**
 * Install global delegated listeners that prefetch on hover (desktop) and
 * touchstart (mobile) of any anchor tag pointing to an internal route.
 * Idempotent — safe to call multiple times.
 */
let installed = false;
export function installRoutePrefetch() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const handler = (e: Event) => {
    const target = e.target as (Element | null);
    if (!target || typeof (target as Element).closest !== 'function') return;
    const anchor = (target as Element).closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || !href.startsWith('/')) return;
    // Strip query/hash for matching
    const path = href.split('?')[0].split('#')[0];
    prefetchRoute(path);
  };


  // Use capture so we catch events even if the link stops propagation.
  // passive: true keeps the scroll thread free.
  document.addEventListener('pointerenter', handler, { capture: true, passive: true });
  document.addEventListener('touchstart', handler, { capture: true, passive: true });
  document.addEventListener('focusin', handler, { capture: true, passive: true });

  // Idle-time warm prefetch of the most-visited routes so subsequent
  // navigations mount instantly without waiting for chunk download.
  const warmRoutes = [
    '/browse',
    '/anime/_',
    '/watch/_',
    '/favorites',
    '/history',
    '/schedule',
    '/downloads',
    '/watchlist',
    '/latest-episodes',
  ];
  const warm = () => {
    warmRoutes.forEach((p, i) => {
      // Stagger to avoid bursting the network thread.
      setTimeout(() => prefetchRoute(p), i * 120);
    });
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void })
    .requestIdleCallback;
  if (typeof ric === 'function') {
    ric(warm, { timeout: 3000 });
  } else {
    setTimeout(warm, 1500);
  }
}
