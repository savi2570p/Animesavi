import { useEffect, useMemo, useRef, useState, lazy, Suspense, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ShieldCheck, Zap, Home, Search, Shield, PlayCircle, Lock } from 'lucide-react';
import {
  issueUnlockToken,
  verifyUnlockToken,
  hasActiveUnlock,
} from '@/lib/cloneUnlock';

const AnimeSlugRedirect = lazy(() => import('./AnimeSlugRedirect'));

interface ClonePlatformRow {
  id: string;
  name: string;
  slug: string;
  target_url: string;
  logo_url: string | null;
  sandbox_enabled: boolean;
  is_active: boolean;
}

const AD_WATCH_SECONDS = 15;


/* ---------------------------------------------------------------- Boot overlay */
function BootOverlay({ siteName }: { siteName: string }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setPhase(1), 2000);
    return () => window.clearTimeout(t);
  }, []);

  const copy = phase === 0
    ? { title: 'Verifying Human…', sub: 'Checking your session securely', pct: 45, Icon: ShieldCheck }
    : { title: `Enabling ${siteName} Ad Blocker…`, sub: 'Loading a clean, ad-free experience', pct: 95, Icon: Zap };

  const { Icon } = copy;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center px-6 clone-boot-backdrop"
      role="status"
      aria-live="polite"
    >
      <div className="clone-glass relative w-full max-w-sm rounded-3xl p-7 text-center animate-scale-in">
        <div className="clone-orb clone-orb-a" aria-hidden />
        <div className="clone-orb clone-orb-b" aria-hidden />
        <div className="relative">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-2xl shadow-[0_16px_50px_-16px_rgba(168,85,247,0.85)]">
            <Icon className="h-8 w-8 text-[hsl(275_90%_78%)]" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{copy.title}</h2>
          <p className="mt-1.5 text-xs text-muted-foreground">{copy.sub}</p>

          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[hsl(268_90%_62%)] to-[hsl(292_90%_70%)] transition-[width] duration-[1400ms] ease-out"
              style={{ width: `${copy.pct}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground tabular-nums">
            {copy.pct}%
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Unlock popup */
function UnlockPopup({
  onClose,
  onUnlocked,
}: {
  onClose: () => void;
  onUnlocked: (token: string) => void;
}) {
  const [watching, setWatching] = useState(false);
  const [left, setLeft] = useState(AD_WATCH_SECONDS);
  const dialogRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!watching) return;
    const id = window.setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          window.clearInterval(id);
          onUnlocked(issueUnlockToken());
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [watching, onUnlocked]);

  // Focus the primary action on open, restore focus on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    startRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  // Focus trap + Escape to close.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center px-6 clone-boot-backdrop"
      onKeyDown={onKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Watch a short ad to unlock this page"
        className="clone-glass relative w-full max-w-sm rounded-3xl p-7 text-center animate-scale-in"
      >

        <div className="clone-orb clone-orb-a" aria-hidden />
        <div className="relative">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-2xl">
            <PlayCircle className="h-7 w-7 text-[hsl(275_90%_78%)]" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Watch a short ad</h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Unlocks this page for the next 6 hours.
          </p>

          {watching ? (
            <div className="mt-6">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[hsl(268_90%_62%)] to-[hsl(292_90%_70%)] transition-[width] duration-1000 ease-linear"
                  style={{ width: `${((AD_WATCH_SECONDS - left) / AD_WATCH_SECONDS) * 100}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground tabular-nums">{left}s remaining…</p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              <button
                ref={startRef}
                onClick={() => setWatching(true)}
                className="clone-cta w-full rounded-xl px-4 py-2.5 text-sm font-semibold"
              >
                Start ad
              </button>

              <button
                onClick={onClose}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-muted-foreground backdrop-blur-xl transition hover:text-foreground"
              >
                Not now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- Page */
export default function ClonePlatform() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<ClonePlatformRow | null>(null);
  const [locked, setLocked] = useState(false);
  const [unlocked, setUnlocked] = useState(hasActiveUnlock);
  const [showUnlockPopup, setShowUnlockPopup] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBooting(true);

    (async () => {
      const [{ data: row }, { data: setting }] = await Promise.all([
        supabase
          .from('clone_platforms')
          .select('id, name, slug, target_url, logo_url, sandbox_enabled, is_active')
          .eq('slug', slug ?? '')
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'clone_platforms_locked')
          .maybeSingle(),
      ]);

      if (cancelled) return;
      setPlatform((row as ClonePlatformRow | null) ?? null);
      setLocked(setting?.value === true);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (loading || !platform) return;
    const t = window.setTimeout(() => setBooting(false), 4000);
    return () => window.clearTimeout(t);
  }, [loading, platform]);

  const isLocked = locked && !unlocked;

  /* --- postMessage unlock handshake -------------------------------------
     The ad frame (or any child) can request an unlock by posting
     { type: 'clone-unlock', token }. pointerEvents only re-enable once the
     token verifies on this page. We also broadcast the confirmation back. */
  const frameRef = useRef<HTMLIFrameElement>(null);

  const applyUnlock = useCallback((token: string) => {
    if (!verifyUnlockToken(token)) return false;
    setUnlocked(true);
    setShowUnlockPopup(false);
    frameRef.current?.contentWindow?.postMessage(
      { type: 'clone-unlock-ack', ok: true },
      '*'
    );
    return true;
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; token?: string } | null;
      if (!data || data.type !== 'clone-unlock' || typeof data.token !== 'string') return;
      applyUnlock(data.token);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [applyUnlock]);

  /* --- Frame load watchdog ---------------------------------------------
     iOS/Android Safari + Chrome never fire the IntersectionObserver reliably
     for a full-screen iframe inside a `position: fixed` flex shell, which left
     the frame unmounted -> black screen. The frame is the whole page, so it is
     always mounted eagerly now. A watchdog surfaces a readable fallback when
     the remote site refuses to be framed (X-Frame-Options / CSP). */
  const frameHostRef = useRef<HTMLDivElement>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [frameBlocked, setFrameBlocked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!platform?.target_url) return;
    setFrameLoaded(false);
    setFrameBlocked(false);
    const t = window.setTimeout(() => {
      setFrameBlocked((prev) => prev || !frameLoadedRef.current);
    }, 12000);
    return () => window.clearTimeout(t);
  }, [platform?.target_url, reloadKey]);

  const frameLoadedRef = useRef(false);
  useEffect(() => {
    frameLoadedRef.current = frameLoaded;
  }, [frameLoaded]);

  /* --- Navigation lock ---------------------------------------------------
     Belt-and-braces on top of the sandbox: neutralise any window.open() and
     any anchor that tries to escape the app while this page is mounted. */
  useEffect(() => {
    const originalOpen = window.open;
    window.open = function blockedOpen() {
      return null;
    } as typeof window.open;

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      const isExternal = /^https?:\/\//i.test(href) && !href.startsWith(window.location.origin);
      if (isExternal || anchor.target === '_blank') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('click', onClick, true);
    return () => {
      window.open = originalOpen;
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  // Sandbox: allow the embedded site to render and run, but strip popups,
  // top-level navigation and downloads so ad scripts can never hijack the tab.
  // Intentionally EXCLUDED: allow-popups, allow-popups-to-escape-sandbox,
  // allow-top-navigation, allow-top-navigation-by-user-activation.
  const sandboxProps = useMemo(
    () =>
      platform?.sandbox_enabled
        ? { sandbox: 'allow-scripts allow-same-origin allow-forms allow-presentation' }
        : {},
    [platform?.sandbox_enabled]
  );



  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(275_90%_70%)] border-t-transparent" />
      </div>
    );
  }

  // Not a clone platform slug — fall back to the anime slug resolver.
  if (!platform) {
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(275_90%_70%)] border-t-transparent" />
          </div>
        }
      >
        <AnimeSlugRedirect />
      </Suspense>
    );
  }

  if (!platform.target_url) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <div className="clone-glass rounded-3xl px-8 py-10">
          <Lock className="mx-auto mb-4 h-8 w-8 text-[hsl(275_90%_78%)]" />
          <h1 className="text-lg font-semibold">No URL configured</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {platform.name} has no target URL set yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[hsl(272_45%_6%)] clone-shell">
      {/* Top watermark bar */}
      <div
        className="clone-bar flex shrink-0 items-center justify-between gap-2 px-2.5 sm:px-3"
        style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top))', paddingBottom: '0.375rem' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {platform.logo_url ? (
            <img
              src={platform.logo_url}
              alt={`${platform.name} logo`}
              className="h-5 w-5 shrink-0 rounded-md object-cover"
              loading="lazy"
            />
          ) : null}
          <span className="shrink-0 text-xs font-bold tracking-tight">
            Anime<span className="text-[hsl(275_90%_72%)]">Savi</span>
          </span>
          <span className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {platform.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => navigate('/')}
            aria-label="Go to home"
            className="clone-icon-btn flex h-9 w-9 items-center justify-center sm:h-8 sm:w-8"
          >
            <Home className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate('/browse')}
            aria-label="Search anime"
            className="clone-icon-btn flex h-9 w-9 items-center justify-center sm:h-8 sm:w-8"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Frame */}
      <div ref={frameHostRef} className="relative min-h-0 flex-1 overflow-hidden bg-[hsl(272_45%_6%)]">
        <iframe
          ref={frameRef}
          key={`${platform.id}-${reloadKey}`}
          src={platform.target_url}
          title={`${platform.name} — ad-blocked view on AnimeSavi`}
          className="absolute inset-0 border-0"
          style={{
            width: '100%',
            height: '100%',
            pointerEvents: isLocked ? 'none' : 'auto',
            background: 'hsl(272 45% 6%)',
          }}
          referrerPolicy="no-referrer"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          onLoad={() => {
            setFrameLoaded(true);
            setFrameBlocked(false);
          }}
          {...sandboxProps}
        />

        {!frameLoaded && !frameBlocked && !booting && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[hsl(275_90%_70%)] border-t-transparent" />
          </div>
        )}

        {frameBlocked && (
          <div className="absolute inset-0 z-30 flex items-center justify-center px-6">
            <div className="clone-glass w-full max-w-sm rounded-3xl px-6 py-8 text-center">
              <Shield className="mx-auto mb-3 h-7 w-7 text-[hsl(275_90%_78%)]" />
              <h2 className="text-sm font-semibold">This site refused to load</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {platform.name} blocks embedding from other sites. Try again, or open it from
                your browser.
              </p>
              <button
                onClick={() => {
                  setFrameLoaded(false);
                  setFrameBlocked(false);
                  setReloadKey((k) => k + 1);
                }}
                className="clone-cta mt-5 rounded-2xl px-5 py-2.5 text-xs font-semibold"
              >
                Try again
              </button>
            </div>
          </div>
        )}


        {isLocked && !booting && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 px-6 backdrop-blur-[2px]">
            <button
              onClick={() => setShowUnlockPopup(true)}
              className="clone-cta rounded-2xl px-6 py-3 text-sm font-semibold"
            >
              Watch Ads to Unlock
            </button>
          </div>
        )}

        {booting && <BootOverlay siteName={platform.name} />}

        {showUnlockPopup && (
          <UnlockPopup
            onClose={() => setShowUnlockPopup(false)}
            onUnlocked={(token) => applyUnlock(token)}
          />
        )}
      </div>


      {/* Bottom strip */}
      <div
        className="clone-bar flex shrink-0 items-center justify-center gap-1.5 px-3"
        style={{ paddingTop: '0.375rem', paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        <Shield className="h-3 w-3 shrink-0 text-[hsl(275_90%_72%)]" />
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground">
          Powered by AnimeSavi Ad Blocker
        </span>
      </div>
    </div>
  );
}
