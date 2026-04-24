import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePopupQueue } from '@/contexts/PopupQueueContext';
import { Loader2, ChevronLeft, ChevronRight, Sparkles, X, ArrowRight } from 'lucide-react';

type UpdateStep = 'alert' | 'downloading' | 'installing' | 'complete';
type BadgeKind = 'NEW' | 'IMPROVED' | 'FIX';

interface ChangelogItem {
  icon: string;
  title: string;
  desc: string;
  badge: BadgeKind;
}

interface VersionGroup {
  version: string;
  date: string;
  highlight: string;
  items: ChangelogItem[];
}

const APP_VERSION = 'v22';

const VERSION_GROUPS: VersionGroup[] = [
  {
    version: 'v22',
    date: 'Latest',
    highlight: 'Cinematic detail pages, smoother season switching, and a 3-second auto-loop hero with direction-aware transitions.',
    items: [
      { icon: '🎬', badge: 'IMPROVED', title: 'Hero Banner Auto-Loop', desc: 'New 3-second loop with cinematic blur, scale, and direction-aware slide animations on every change.' },
      { icon: '✨', badge: 'NEW', title: 'Redesigned More Info Page', desc: 'Glow-haloed poster, gradient title, glassy meta chips, and a refined CTA row with primary glow shadow.' },
      { icon: '💀', badge: 'NEW', title: 'Realistic Skeleton Loaders', desc: 'Detail page skeletons now mirror the actual layout — hero, poster, chips, description, buttons, and episode grid.' },
      { icon: '🌊', badge: 'IMPROVED', title: 'Smooth Section Stagger', desc: 'Each "More Info" section fades and slides in sequentially for a buttery, premium feel.' },
      { icon: '📺', badge: 'NEW', title: 'Season Switch Skeletons', desc: 'Switching seasons now shows a staggered episode skeleton grid before fading in the new episodes.' },
      { icon: '🎯', badge: 'IMPROVED', title: 'Crossfade Transitions', desc: 'Skeleton-to-content swap uses a 500ms crossfade so the page never flashes empty.' },
      { icon: '⏯️', badge: 'FIX', title: 'Player Pause Cleanup', desc: 'Pausing no longer shows a redundant center play icon. Finished episodes now show a "Rewatch" control.' },
      { icon: '📰', badge: 'IMPROVED', title: 'What\'s New Popup', desc: 'Tighter glass card with pulsing live indicator, dot-based version pager, and color-coded change tags.' },
    ],
  },
  {
    version: 'v21',
    date: 'Previous',
    highlight: 'Cinematic Netflix-style redesign, smarter Telegram toast, and buttery-smooth playback across every device.',
    items: [
      { icon: '🎬', badge: 'NEW', title: 'Cinematic Hero Banner', desc: 'Auto-rotating featured slides with Ken Burns zoom-pan, 7s timing, and slim progress bars.' },
      { icon: '✨', badge: 'IMPROVED', title: 'Netflix-Style UI Polish', desc: 'Red accent section headers, hover scale with red shadows, and edge-fade row masks site-wide.' },
      { icon: '🌟', badge: 'NEW', title: 'Featured Anime Refresh', desc: 'Witch Hat Atelier and Grand Blue Dreaming now headline the hero rotation with curated view counts.' },
      { icon: '📺', badge: 'IMPROVED', title: 'Continue Watching', desc: 'Faster loading, deduplicated entries, and a tighter row layout for quicker resume.' },
      { icon: '🔥', badge: 'IMPROVED', title: 'Discovery Rows', desc: 'Recommended, Most Popular, Latest Series/Episodes/Movies, Coming Soon, and Recently Completed all refreshed.' },
      { icon: '💬', badge: 'NEW', title: 'Language-Aware Telegram Toast', desc: 'Toast text now adapts to your subtitle/audio language with browser fallback (8 languages).' },
    ],
  },
  {
    version: 'v20',
    date: 'Older',
    highlight: 'Smoother uploads, richer metadata, and a polished player experience.',
    items: [
      { icon: '📅', badge: 'IMPROVED', title: 'Upcoming Refresh', desc: 'Coming Soon panels surface richer anime details with improved mobile presentation.' },
      { icon: '🎞️', badge: 'IMPROVED', title: 'Player Polish', desc: 'Smoother fullscreen shortcuts, color customization, and premium controls.' },
      { icon: '📱', badge: 'FIX', title: 'Mobile Popup Fix', desc: "Opening What's New from the hamburger now closes the menu first so the popup is fully visible." },
    ],
  },
];

const BADGE_STYLES: Record<BadgeKind, string> = {
  NEW: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  IMPROVED: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  FIX: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

const BADGE_DOT: Record<BadgeKind, string> = {
  NEW: 'bg-emerald-400',
  IMPROVED: 'bg-sky-400',
  FIX: 'bg-amber-400',
};

const DOWNLOAD_COMPLETED_KEY = `update_downloaded_${APP_VERSION}`;

export function UpdatePopup() {
  const { activePopup, dismissPopup, isManualWhatsNew } = usePopupQueue();
  const navigate = useNavigate();
  const [step, setStep] = useState<UpdateStep>('alert');
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [speedMbps, setSpeedMbps] = useState(0);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const [versionIndex, setVersionIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const TOTAL_MB = 42;

  const isActive = activePopup === 'whatsNew';

  useEffect(() => {
    if (isActive) {
      // If the user already completed the download for this version,
      // skip straight to the "What's New / GO" complete view.
      const alreadyDownloaded = localStorage.getItem(DOWNLOAD_COMPLETED_KEY) === 'true';
      setStep(alreadyDownloaded ? 'complete' : 'alert');
      setProgress(0);
      setVersionIndex(0);
    }
  }, [isActive, isManualWhatsNew]);

  useEffect(() => {
    if (step !== 'downloading') return;
    setProgress(0);
    setDisplayProgress(0);
    setSpeedMbps(0);
    setSpeedHistory([]);

    const tickMs = 200;
    let current = 0;
    // Variable-speed simulation: 3 phases (ramp-up, steady, slow-finish)
    intervalRef.current = setInterval(() => {
      // Phase-based speed (Mbps): start slow, peak in middle, slow at end
      let baseSpeed: number;
      if (current < 15) baseSpeed = 2 + current * 0.4;            // ramp up 2 → 8
      else if (current < 75) baseSpeed = 8 + Math.sin(current / 10) * 2.5; // steady 5.5 – 10.5
      else baseSpeed = Math.max(1.2, 9 - (current - 75) * 0.25);   // wind-down

      // Network jitter
      const jitter = (Math.random() - 0.5) * 1.8;
      const liveSpeed = Math.max(0.4, baseSpeed + jitter);

      // % progress per tick: speed (MB/s) * dt / total
      const mbThisTick = (liveSpeed / 8) * (tickMs / 1000); // Mbps→MB/s ÷8
      const pctThisTick = (mbThisTick / TOTAL_MB) * 100;
      current = Math.min(100, current + pctThisTick);

      setSpeedMbps(liveSpeed);
      setSpeedHistory((prev) => {
        const next = [...prev, liveSpeed];
        return next.length > 24 ? next.slice(-24) : next;
      });
      setProgress(current);

      if (current >= 100) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTimeout(() => setStep('installing'), 600);
      }
    }, tickMs);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [step]);

  // Smooth eased counter — interpolates displayProgress toward progress every frame
  useEffect(() => {
    if (step !== 'downloading') {
      setDisplayProgress(progress);
      return;
    }
    const animate = () => {
      setDisplayProgress((prev) => {
        const diff = progress - prev;
        if (Math.abs(diff) < 0.05) return progress;
        return prev + diff * 0.18; // easing factor
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [progress, step]);

  useEffect(() => {
    if (step !== 'installing') return;
    const timer = setTimeout(() => {
      // Mark this version as downloaded so future manual opens skip the flow.
      try { localStorage.setItem(DOWNLOAD_COMPLETED_KEY, 'true'); } catch { /* ignore */ }
      setStep('complete');
    }, 5000);
    return () => clearTimeout(timer);
  }, [step]);

  const handleDownload = useCallback(() => setStep('downloading'), []);
  const handleGo = useCallback(() => { dismissPopup(); navigate('/'); }, [dismissPopup, navigate]);

  const goPrev = () => setVersionIndex((i) => Math.max(0, i - 1));
  const goNext = () => setVersionIndex((i) => Math.min(VERSION_GROUPS.length - 1, i + 1));

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -50) goNext();
    else if (dx > 50) goPrev();
    touchStartX.current = null;
  };

  if (!isActive) return null;

  const currentGroup = VERSION_GROUPS[versionIndex];

  /* ── STEP 1: Update Alert ── */
  if (step === 'alert') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-lg animate-in fade-in duration-300">
        <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-red-600/30 bg-gradient-to-b from-zinc-900/95 to-black/95 shadow-2xl shadow-red-900/20 p-8 text-center space-y-5 animate-in zoom-in-95 duration-300">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-600/15 flex items-center justify-center">
            <span className="text-3xl">🔥</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Update Available • Download Ready
          </div>
          <h2 className="text-xl font-bold text-white">New Version Ready to Install</h2>
          <p className="text-sm text-zinc-400">Tap Download to install the latest features and improvements.</p>
          <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-red-600/20 text-red-400">{APP_VERSION}</span>

          <div className="space-y-1.5 text-left max-h-[30vh] overflow-y-auto pr-1">
            {VERSION_GROUPS[0].items.map((item) => (
              <div key={item.title} className="flex items-center gap-2.5 p-2 bg-white/5 rounded-md">
                <span className="text-sm shrink-0">{item.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-semibold text-white leading-tight truncate">{item.title}</h4>
                    <span className={`shrink-0 rounded border px-1 py-px text-[8px] font-bold uppercase tracking-wider ${BADGE_STYLES[item.badge]}`}>{item.badge}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleDownload}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 transition-all shadow-lg shadow-red-900/30"
          >
            Download
          </button>
        </div>
      </div>
    );
  }

  /* ── STEP 2: Downloading — cinematic progress ── */
  if (step === 'downloading') {
    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (displayProgress / 100) * circumference;
    const downloadedMb = (displayProgress / 100) * TOTAL_MB;
    const remainingMb = Math.max(0, TOTAL_MB - downloadedMb);
    // ETA in seconds based on current speed (Mbps → MB/s ÷8)
    const mbPerSec = Math.max(0.1, speedMbps / 8);
    const etaSec = displayProgress >= 100 ? 0 : Math.ceil(remainingMb / mbPerSec);
    const etaLabel = etaSec >= 60 ? `${Math.floor(etaSec / 60)}m ${etaSec % 60}s` : `${etaSec}s`;

    // Sparkline points for speed history (24 samples)
    const maxSpeed = Math.max(12, ...speedHistory);
    const sparkW = 100;
    const sparkH = 24;
    const sparkPoints = speedHistory.length > 1
      ? speedHistory.map((s, i) => {
          const x = (i / (speedHistory.length - 1)) * sparkW;
          const y = sparkH - (s / maxSpeed) * sparkH;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ')
      : '';

    // Phase label
    const phaseLabel = displayProgress >= 100
      ? 'Verifying'
      : displayProgress < 15 ? 'Connecting'
      : displayProgress < 75 ? 'Downloading'
      : 'Finalizing';

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
        <div className="relative w-full max-w-sm mx-4 overflow-hidden rounded-2xl border border-red-600/30 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black/98 shadow-2xl shadow-red-900/40 p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
          {/* Decorative glows */}
          <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-red-600/20 blur-3xl animate-pulse" />
          <div className="pointer-events-none absolute -bottom-24 -left-20 h-52 w-52 rounded-full bg-red-500/15 blur-3xl" />

          {/* Header pill */}
          <div className="relative inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-400" />
            </span>
            Downloading {APP_VERSION}
          </div>

          {/* Circular progress */}
          <div className="relative mx-auto h-36 w-36">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
              <circle
                cx="64" cy="64" r={radius}
                stroke="url(#dlGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ filter: 'drop-shadow(0 0 8px rgba(220,38,38,0.6))' }}
              />
              <defs>
                <linearGradient id="dlGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold font-mono bg-gradient-to-br from-white to-red-300 bg-clip-text text-transparent tabular-nums">
                {displayProgress.toFixed(1)}<span className="text-lg text-red-400">%</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">{phaseLabel}</span>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">Downloading Update</h2>
            <p className="text-xs text-zinc-500">Securing the latest features and improvements…</p>
          </div>

          {/* Linear progress bar with shine */}
          <div className="relative h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-600 via-red-500 to-orange-400 shadow-[0_0_12px_rgba(220,38,38,0.6)]"
              style={{ width: `${displayProgress}%` }}
            />
            <div
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shine"
              style={{ left: `${Math.max(0, displayProgress - 33)}%` }}
            />
          </div>

          {/* Live metrics: speed + sparkline + ETA */}
          <div className="grid grid-cols-3 gap-2 text-left">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2">
              <div className="text-[8px] uppercase tracking-[0.15em] text-zinc-500 font-semibold">Speed</div>
              <div className="text-[13px] font-bold font-mono text-white tabular-nums leading-tight">
                {speedMbps.toFixed(1)}
                <span className="text-[9px] text-zinc-500 ml-0.5">Mbps</span>
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2">
              <div className="text-[8px] uppercase tracking-[0.15em] text-zinc-500 font-semibold">Size</div>
              <div className="text-[13px] font-bold font-mono text-white tabular-nums leading-tight">
                {downloadedMb.toFixed(1)}
                <span className="text-[9px] text-zinc-500 ml-0.5">/{TOTAL_MB}MB</span>
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2">
              <div className="text-[8px] uppercase tracking-[0.15em] text-zinc-500 font-semibold">ETA</div>
              <div className="text-[13px] font-bold font-mono text-red-300 tabular-nums leading-tight">
                {etaLabel}
              </div>
            </div>
          </div>

          {/* Speed sparkline */}
          <div className="relative h-7 rounded-md border border-white/5 bg-black/40 overflow-hidden px-1.5">
            {sparkPoints ? (
              <svg viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none" className="h-full w-full">
                <defs>
                  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon
                  points={`0,${sparkH} ${sparkPoints} ${sparkW},${sparkH}`}
                  fill="url(#sparkFill)"
                />
                <polyline
                  points={sparkPoints}
                  fill="none"
                  stroke="#f87171"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 0 3px rgba(248,113,113,0.6))' }}
                />
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-[9px] uppercase tracking-wider text-zinc-600">
                Measuring network…
              </div>
            )}
          </div>
        </div>
      </div>

    );
  }

  /* ── STEP 3: Installing — multi-stage cinematic ── */
  if (step === 'installing') {
    const stages = [
      { icon: '🔓', label: 'Unpacking files' },
      { icon: '⚙️', label: 'Configuring system' },
      { icon: '✨', label: 'Optimizing assets' },
      { icon: '🚀', label: 'Finalizing install' },
    ];
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
        <div className="relative w-full max-w-sm mx-4 overflow-hidden rounded-2xl border border-red-600/30 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black/98 shadow-2xl shadow-red-900/40 p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
          {/* Decorative glows */}
          <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-red-600/20 blur-3xl animate-pulse" />
          <div className="pointer-events-none absolute -bottom-24 -left-20 h-52 w-52 rounded-full bg-red-500/15 blur-3xl" />

          {/* Header pill */}
          <div className="relative inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Installing {APP_VERSION}
          </div>

          {/* Animated install icon */}
          <div className="relative mx-auto h-24 w-24">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-500/30 to-orange-500/20 blur-xl animate-pulse" />
            <div className="absolute inset-2 rounded-full border-2 border-red-500/40 border-t-red-500 animate-spin" style={{ animationDuration: '1.4s' }} />
            <div className="absolute inset-5 rounded-full border-2 border-amber-500/30 border-b-amber-400 animate-spin" style={{ animationDuration: '1.8s', animationDirection: 'reverse' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl">⚙️</span>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Installing Updates</h2>
            <p className="text-xs text-zinc-500">Setting up new features and polishing the experience…</p>
          </div>

          {/* Stage list — staggered */}
          <div className="space-y-1.5 text-left">
            {stages.map((stage, i) => (
              <div
                key={stage.label}
                className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${i * 350}ms`, animationDuration: '500ms', animationFillMode: 'both' }}
              >
                <span className="text-base shrink-0">{stage.icon}</span>
                <span className="flex-1 text-[11px] font-semibold text-white/90">{stage.label}</span>
                <Loader2 className="h-3 w-3 text-red-400 animate-spin shrink-0" />
              </div>
            ))}
          </div>

          {/* Bouncing dots */}
          <div className="flex justify-center gap-1.5 pt-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── STEP 4: Complete / What's New — compact cinematic redesign ── */
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/85 p-3 backdrop-blur-xl animate-in fade-in duration-300 sm:items-center sm:p-4"
      onClick={dismissPopup}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-600/25 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black/98 shadow-2xl shadow-red-900/30 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
      >
        {/* Decorative glows */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-red-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-red-500/10 blur-3xl" />

        {/* Close */}
        <button
          onClick={dismissPopup}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/60 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Header — compact */}
        <div className="relative px-5 pt-5 pb-3 text-center">
          <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-600/30 to-red-500/10 ring-1 ring-red-500/30">
            <Sparkles className="h-5 w-5 text-red-400" />
          </div>
          <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
            <span className="relative flex h-1 w-1">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1 w-1 rounded-full bg-emerald-400" />
            </span>
            {isManualWhatsNew ? "What's New" : 'You are up to date'}
          </div>
          <h2 className="text-base font-bold text-white sm:text-lg">
            {isManualWhatsNew ? 'Latest Drops & Polish' : 'Updated to latest version'}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-[11px] leading-snug text-zinc-400">
            {currentGroup.highlight}
          </p>
          <span className="mt-2 inline-block rounded-md border border-red-500/30 bg-red-600/15 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-red-300">
            {APP_VERSION}
          </span>
        </div>

        {/* Version pager — slim */}
        <div className="relative flex items-center justify-center gap-2 border-y border-white/5 bg-black/30 px-5 py-2">
          <button
            onClick={goPrev}
            disabled={versionIndex === 0}
            className="rounded-md border border-white/10 bg-white/5 p-1 text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-25"
            aria-label="Previous version"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <div className="flex items-center gap-1.5">
            {VERSION_GROUPS.map((g, i) => (
              <button
                key={g.version}
                onClick={() => setVersionIndex(i)}
                className={`h-1 rounded-full transition-all ${
                  i === versionIndex ? 'w-5 bg-red-500' : 'w-1 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Go to ${g.version}`}
              />
            ))}
          </div>
          <button
            onClick={goNext}
            disabled={versionIndex === VERSION_GROUPS.length - 1}
            className="rounded-md border border-white/10 bg-white/5 p-1 text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-25"
            aria-label="Next version"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
          <div className="ml-2 flex items-center gap-1.5">
            <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-red-300">
              {currentGroup.version}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-white/40">{currentGroup.date}</span>
          </div>
        </div>

        {/* Items — compact rows, scroll-locked height */}
        <div
          className="relative max-h-[42vh] space-y-1.5 overflow-y-auto px-4 py-3 sm:max-h-[40vh]"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {currentGroup.items.map((item, idx) => (
            <div
              key={item.title}
              className="group flex items-start gap-2.5 rounded-lg border border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-2.5 transition-all hover:border-red-500/20 hover:from-red-500/5 animate-in fade-in slide-in-from-right-2 duration-300"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-sm">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h4 className="text-[12px] font-semibold leading-tight text-white">{item.title}</h4>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded border px-1 py-px text-[8px] font-bold uppercase tracking-wider ${BADGE_STYLES[item.badge]}`}
                  >
                    <span className={`h-1 w-1 rounded-full ${BADGE_DOT[item.badge]}`} />
                    {item.badge}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{item.desc}</p>
              </div>
            </div>
          ))}
          <p className="pt-1 text-center text-[9px] text-white/25 sm:hidden">← Swipe to browse versions →</p>
        </div>

        {/* CTA */}
        <div className="relative border-t border-white/5 bg-black/40 px-4 py-3">
          <button
            onClick={handleGo}
            className="group flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-700 via-red-600 to-red-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition-all hover:from-red-600 hover:to-red-400 hover:shadow-red-700/50"
          >
            Explore Now
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
