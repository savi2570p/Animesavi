import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePopupQueue } from '@/contexts/PopupQueueContext';
import { Loader2, Sparkles, X, ArrowRight, Check } from 'lucide-react';

type UpdateStep = 'alert' | 'downloading' | 'installing' | 'complete' | 'entering';
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

const APP_VERSION = 'V 28.1';

// Fixed download size for V 28.1 patch
const RANDOM_DOWNLOAD_MB = 50;

const VERSION_GROUPS: VersionGroup[] = [
  {
    version: 'V 28.1',
    date: 'June 27, 2026',
    highlight: 'This patch fixes the Continue Watching "Done" action, uses real watch-time data for stats, and keeps the Continue Watching list accurate when episodes finish or new ones drop.',
    items: [
      { icon: '✅', badge: 'FIX', title: '"Done" Button Works Again', desc: 'Tapping Done in Continue Watching now instantly marks the episode complete and refreshes the row instead of showing "Failed to mark as complete".' },
      { icon: '📺', badge: 'FIX', title: 'Continue Watching Auto-Updates', desc: 'When the last released episode is marked complete, the anime is removed from Continue Watching. When a new episode drops, it reappears on the newest episode.' },
      { icon: '⏱️', badge: 'FIX', title: 'Real Watch Hours in History', desc: 'Watch history and user stats now use the actual saved playback position and duration instead of fake 24-minute estimates.' },
      { icon: '📈', badge: 'FIX', title: 'Stats No Longer Show 0 Hours', desc: 'The "hours watched" counter now reads the real saved progress from every episode, so the total is accurate.' },
      { icon: '🔄', badge: 'FIX', title: 'Smarter Continue Watching Engine', desc: 'Progress, completion, and new-episode detection now flow through a single backend routine so the list stays in sync across the site.' },
    ],
  },
];

const BADGE_LABELS: Record<BadgeKind, string> = {
  NEW: 'NEW',
  IMPROVED: 'IMPROVED',
  FIX: 'FIXED',
};

const BADGE_STYLES: Record<BadgeKind, string> = {
  NEW: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  IMPROVED: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  FIX: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
};

const BADGE_ICON_RINGS: Record<BadgeKind, string> = {
  NEW: 'from-emerald-500/25 to-emerald-600/15 border-emerald-500/20 shadow-emerald-900/20',
  IMPROVED: 'from-sky-500/25 to-sky-600/15 border-sky-500/20 shadow-sky-900/20',
  FIX: 'from-orange-500/25 to-rose-600/15 border-orange-500/20 shadow-orange-900/20',
};

const BADGE_DOT: Record<BadgeKind, string> = {
  NEW: 'bg-emerald-400',
  IMPROVED: 'bg-sky-400',
  FIX: 'bg-orange-400',
};

const DOWNLOAD_COMPLETED_KEY = `update_downloaded_${APP_VERSION}`;
const ENTERING_SHOWN_KEY = `update_entering_shown_${APP_VERSION}`;

export function UpdatePopup() {
  const { activePopup, dismissPopup, isManualWhatsNew } = usePopupQueue();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<UpdateStep>('alert');
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [speedMbps, setSpeedMbps] = useState(0);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const [versionIndex, setVersionIndex] = useState(0);
  const [enterStage, setEnterStage] = useState(0); // 0=Synced, 1=Booting UI, 2=Routing Home
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  // Snapshot the route when "Explore Now" is clicked so we only auto-navigate
  // home if the user is still on that same route 3.5s later (avoids hijacking
  // navigation if they manually move to /auth, /anime/:id, /watch, etc.).
  const enteringFromPathRef = useRef<string | null>(null);

  const TOTAL_MB = RANDOM_DOWNLOAD_MB;

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

    const tickMs = 90; // faster tick → quicker visible progress
    let current = 0;
    // Higher base speeds → download completes in ~1.5-2s instead of ~6s.
    intervalRef.current = setInterval(() => {
      let baseSpeed: number;
      if (current < 15) baseSpeed = 12 + current * 1.0;           // ramp 12 → 27 Mbps
      else if (current < 75) baseSpeed = 28 + Math.sin(current / 10) * 4; // steady 24-32
      else baseSpeed = Math.max(8, 26 - (current - 75) * 0.4);    // wind-down 26 → 16

      const jitter = (Math.random() - 0.5) * 3.5;
      const liveSpeed = Math.max(4, baseSpeed + jitter);

      const mbThisTick = (liveSpeed / 8) * (tickMs / 1000);
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
        setTimeout(() => setStep('installing'), 350);
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
    }, 1800);
    return () => clearTimeout(timer);
  }, [step]);

  const handleDownload = useCallback(() => setStep('downloading'), []);
  const handleGo = useCallback(() => {
    // Show the cinematic "Entering the latest version" loader exactly once,
    // the first time the user taps "Explore Now" after the v24 update.
    // Manual What's New opens (after the flag is set) skip straight to the app.
    let alreadyEntered = false;
    try { alreadyEntered = localStorage.getItem(ENTERING_SHOWN_KEY) === 'true'; } catch { /* ignore */ }
    if (alreadyEntered) {
      dismissPopup();
      navigate('/');
      return;
    }
    try { localStorage.setItem(ENTERING_SHOWN_KEY, 'true'); } catch { /* ignore */ }
    enteringFromPathRef.current = location.pathname;
    setEnterStage(0);
    setStep('entering');
  }, [dismissPopup, navigate, location.pathname]);

  // Entering step: ~3.5s cinematic transition into the latest version.
  // Cycles stage text Synced → Booting UI → Routing Home, then routes home —
  // BUT only if the user hasn't manually navigated elsewhere in the meantime.
  useEffect(() => {
    if (step !== 'entering') return;
    setEnterStage(0);
    const stage1 = setTimeout(() => setEnterStage(1), 1100);
    const stage2 = setTimeout(() => setEnterStage(2), 2300);
    const finish = setTimeout(() => {
      const startedFrom = enteringFromPathRef.current;
      dismissPopup();
      // Only redirect home if the user is STILL on the same page they pressed
      // "Explore Now" from. If they navigated anywhere else mid-transition
      // (e.g. /auth, /anime/:id, /watch/...), leave them exactly where they are.
      if (startedFrom !== null && location.pathname === startedFrom && location.pathname !== '/') {
        navigate('/');
      } else if (startedFrom === '/') {
        // Already on home — no-op navigate is fine, just refreshes scroll state.
        navigate('/');
      }
      enteringFromPathRef.current = null;
    }, 3500);
    return () => {
      clearTimeout(stage1);
      clearTimeout(stage2);
      clearTimeout(finish);
    };
  }, [step, dismissPopup, navigate, location.pathname]);

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

  const glassCard = (
    children: React.ReactNode,
    { onClick, className = '' }: { onClick?: (e: React.MouseEvent) => void; className?: string } = {}
  ) => (
    <div
      onClick={onClick}
      className={`relative w-full max-w-[360px] mx-auto overflow-hidden bg-white/[0.04] backdrop-blur-2xl border border-white/15 rounded-[42px] shadow-[0_48px_100px_-20px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] ${className}`}
    >
      {/* Outer ambient glow */}
      <div className="absolute -inset-1 bg-gradient-to-b from-white/10 to-transparent rounded-[44px] blur-xl opacity-20 pointer-events-none" />
      {/* Glass reflection sheen */}
      <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-white/[0.05] via-transparent to-transparent rotate-12 pointer-events-none" />
      {/* Top hairline highlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="relative z-10">{children}</div>
    </div>
  );

  const ChangelogList = ({ items, compact = false }: { items: ChangelogItem[]; compact?: boolean }) => (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {items.map((item, idx) => (
        <div
          key={item.title}
          className="flex items-start gap-3 sm:gap-4 animate-in fade-in slide-in-from-right-3 duration-300"
          style={{ animationDelay: `${idx * 40}ms` }}
        >
          <div
            className={`flex-shrink-0 flex items-center justify-center rounded-2xl bg-gradient-to-br ${BADGE_ICON_RINGS[item.badge]} border shadow-lg text-base ${
              compact ? 'w-9 h-9' : 'w-10 h-10 sm:w-11 sm:h-11'
            }`}
          >
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h4 className={`font-semibold leading-tight text-white ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
                {item.title}
              </h4>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${BADGE_STYLES[item.badge]}`}
              >
                <span className={`h-1 w-1 rounded-full ${BADGE_DOT[item.badge]}`} />
                {BADGE_LABELS[item.badge]}
              </span>
            </div>
            <p className={`leading-snug text-zinc-500 ${compact ? 'text-[10px] mt-0.5' : 'text-[11px] sm:text-[12px] mt-1'}`}>
              {item.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );

  const GlassButton = ({
    onClick,
    children,
    variant = 'primary',
  }: {
    onClick: () => void;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary';
  }) => {
    if (variant === 'secondary') {
      return (
        <button
          onClick={onClick}
          className="group relative w-full active:scale-[0.97] transition-all"
        >
          <div className="absolute -inset-px bg-gradient-to-r from-white/20 to-white/5 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition duration-500" />
          <div className="relative flex items-center justify-center w-full h-12 bg-white/[0.06] group-hover:bg-white/[0.10] border border-white/15 rounded-2xl text-white font-semibold text-sm transition-all">
            {children}
          </div>
        </button>
      );
    }
    return (
      <button
        onClick={onClick}
        className="group relative w-full active:scale-[0.97] transition-all"
      >
        <div className="absolute -inset-px bg-gradient-to-r from-rose-600 to-fuchsia-600 rounded-2xl blur-md opacity-25 group-hover:opacity-60 transition duration-500" />
        <div className="relative flex items-center justify-center w-full h-12 bg-white/[0.08] group-hover:bg-white/[0.12] border border-white/20 backdrop-blur-md rounded-2xl text-white font-bold text-sm tracking-wide transition-all">
          {children}
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </div>
      </button>
    );
  };

  const VersionPill = ({ label = APP_VERSION }: { label?: string }) => (
    <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 text-[10px] font-bold tracking-widest uppercase">
      <span className="relative flex h-2 w-2 mr-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      {label}
    </div>
  );

  const Header = ({
    title,
    subtitle,
    pillLabel = APP_VERSION,
    showSparkles = false,
  }: {
    title: string;
    subtitle: string;
    pillLabel?: string;
    showSparkles?: boolean;
  }) => (
    <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4 mb-6 sm:mb-8">
      {showSparkles && (
        <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-fuchsia-600/20 border border-white/10 shadow-lg shadow-rose-900/20">
          <Sparkles className="h-5 w-5 text-rose-300" />
        </div>
      )}
      <VersionPill label={pillLabel} />
      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-popup">{title}</h2>
        <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed px-2 sm:px-4">{subtitle}</p>
      </div>
    </div>
  );

  /* ── STEP 1: Update Alert ── */
  if (step === 'alert') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300 p-3 sm:p-4">
        {glassCard(
          <div className="p-6 sm:p-8 text-center">
            <Header
              title="New Version Ready"
              subtitle="Tap Download to install the latest fixes and improvements."
              pillLabel={`Update Available • ${APP_VERSION}`}
              showSparkles
            />

            <div className="text-left mb-6 sm:mb-8">
              <ChangelogList items={VERSION_GROUPS[0].items} compact />
            </div>

            <GlassButton onClick={handleDownload}>
              Download {RANDOM_DOWNLOAD_MB} MB
            </GlassButton>
          </div>
        )}
      </div>
    );
  }

  /* ── STEP 2: Downloading — cinematic progress ── */
  if (step === 'downloading') {
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (displayProgress / 100) * circumference;
    const downloadedMb = (displayProgress / 100) * TOTAL_MB;
    const remainingMb = Math.max(0, TOTAL_MB - downloadedMb);
    const mbPerSec = Math.max(0.1, speedMbps / 8);
    const etaSec = displayProgress >= 100 ? 0 : Math.ceil(remainingMb / mbPerSec);
    const etaLabel = etaSec >= 60 ? `${Math.floor(etaSec / 60)}m ${etaSec % 60}s` : `${etaSec}s`;

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

    const phaseLabel = displayProgress >= 100
      ? 'Verifying'
      : displayProgress < 15 ? 'Connecting'
      : displayProgress < 75 ? 'Downloading'
      : 'Finalizing';

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300 p-3 sm:p-4">
        {glassCard(
          <div className="p-6 sm:p-8 text-center">
            <div className="flex flex-col items-center space-y-4 sm:space-y-5">
              <div className="relative inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] text-rose-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
                </span>
                Downloading {APP_VERSION}
              </div>

              <div className="relative h-32 w-32 sm:h-36 sm:w-36">
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
                    style={{ filter: 'drop-shadow(0 0 8px rgba(225,29,72,0.6))' }}
                  />
                  <defs>
                    <linearGradient id="dlGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#e11d48" />
                      <stop offset="100%" stopColor="#a21caf" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl sm:text-3xl font-bold font-mono bg-gradient-to-br from-white to-rose-300 bg-clip-text text-transparent tabular-nums">
                    {displayProgress.toFixed(1)}<span className="text-base sm:text-lg text-rose-400">%</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">{phaseLabel}</span>
                </div>
              </div>

              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-white">Downloading Update</h2>
                <p className="text-[11px] sm:text-xs text-zinc-500">Securing the latest fixes and improvements…</p>
              </div>

              <div className="relative h-1.5 w-full rounded-full bg-zinc-800/80 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-rose-600 via-rose-500 to-fuchsia-500 shadow-[0_0_12px_rgba(225,29,72,0.6)]"
                  style={{ width: `${displayProgress}%` }}
                />
                <div
                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                  style={{ left: `${Math.max(0, displayProgress - 33)}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 w-full text-left">
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2">
                  <div className="text-[8px] uppercase tracking-[0.15em] text-zinc-500 font-semibold">Speed</div>
                  <div className="text-[12px] sm:text-[13px] font-bold font-mono text-white tabular-nums leading-tight">
                    {speedMbps.toFixed(1)}<span className="text-[9px] text-zinc-500 ml-0.5">Mbps</span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2">
                  <div className="text-[8px] uppercase tracking-[0.15em] text-zinc-500 font-semibold">Size</div>
                  <div className="text-[12px] sm:text-[13px] font-bold font-mono text-white tabular-nums leading-tight">
                    {downloadedMb.toFixed(1)}<span className="text-[9px] text-zinc-500 ml-0.5">/{TOTAL_MB.toFixed(0)}MB</span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2">
                  <div className="text-[8px] uppercase tracking-[0.15em] text-zinc-500 font-semibold">ETA</div>
                  <div className="text-[12px] sm:text-[13px] font-bold font-mono text-rose-300 tabular-nums leading-tight">
                    {etaLabel}
                  </div>
                </div>
              </div>

              <div className="relative h-7 w-full rounded-xl border border-white/5 bg-black/40 overflow-hidden px-1.5">
                {sparkPoints ? (
                  <svg viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none" className="h-full w-full">
                    <defs>
                      <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e11d48" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#e11d48" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon
                      points={`0,${sparkH} ${sparkPoints} ${sparkW},${sparkH}`}
                      fill="url(#sparkFill)"
                    />
                    <polyline
                      points={sparkPoints}
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ filter: 'drop-shadow(0 0 3px rgba(244,63,94,0.6))' }}
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
        )}
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
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300 p-3 sm:p-4">
        {glassCard(
          <div className="p-6 sm:p-8 text-center">
            <div className="relative inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300 mb-5 sm:mb-6">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Installing {APP_VERSION}
            </div>

            <div className="relative mx-auto h-20 w-20 sm:h-24 sm:w-24 mb-5 sm:mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-rose-500/30 to-fuchsia-500/20 blur-xl animate-pulse" />
              <div className="absolute inset-2 rounded-full border-2 border-rose-500/40 border-t-rose-500 animate-spin" style={{ animationDuration: '1.4s' }} />
              <div className="absolute inset-5 rounded-full border-2 border-amber-500/30 border-b-amber-400 animate-spin" style={{ animationDuration: '1.8s', animationDirection: 'reverse' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl sm:text-3xl">⚙️</span>
              </div>
            </div>

            <div className="space-y-1 mb-5 sm:mb-6">
              <h2 className="text-base sm:text-lg font-bold text-white">Installing Updates</h2>
              <p className="text-[11px] sm:text-xs text-zinc-500">Setting up fixes and polishing the experience…</p>
            </div>

            <div className="space-y-1.5 text-left">
              {stages.map((stage, i) => (
                <div
                  key={stage.label}
                  className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${i * 350}ms`, animationDuration: '500ms', animationFillMode: 'both' }}
                >
                  <span className="text-base shrink-0">{stage.icon}</span>
                  <span className="flex-1 text-[11px] font-semibold text-white/90">{stage.label}</span>
                  <Loader2 className="h-3 w-3 text-rose-400 animate-spin shrink-0" />
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-1.5 pt-5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── STEP 3.5: Entering — first-time post-update transition ── */
  if (step === 'entering') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl p-3 sm:p-4 animate-in fade-in duration-300">
        {glassCard(
          <div className="p-6 sm:p-8 text-center">
            <div className="relative z-10 flex flex-col items-center gap-4 text-center">
              <div className="relative h-16 w-16 sm:h-20 sm:w-20">
                <div className="absolute inset-0 rounded-full border-2 border-rose-500/20" />
                <div
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-rose-400 border-r-rose-500"
                  style={{ animation: 'spin 1.4s linear infinite' }}
                />
                <div
                  className="absolute inset-2 rounded-full border-2 border-transparent border-b-fuchsia-300 border-l-fuchsia-400"
                  style={{ animation: 'spin 2s linear infinite reverse' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-rose-500 via-fuchsia-500 to-purple-600 shadow-[0_0_24px_rgba(225,29,72,0.7)] flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white drop-shadow" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.2em] text-rose-200">
                  <span className="relative flex h-1 w-1">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-1 w-1 rounded-full bg-rose-400" />
                  </span>
                  {APP_VERSION} • Ready
                </div>
                <h2 className="bg-gradient-to-r from-white via-rose-200 to-white bg-clip-text text-base sm:text-lg font-bold text-transparent">
                  Entering the latest version
                </h2>
                <p className="text-[10px] sm:text-[11px] text-zinc-400 transition-all duration-300 min-h-[1.25rem]">
                  {enterStage === 0 && 'Synced — your library is up to date.'}
                  {enterStage === 1 && 'Booting UI — preparing the new experience.'}
                  {enterStage === 2 && 'Routing Home — taking you to the latest.'}
                </p>
              </div>

              <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/5">
                <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-rose-400 to-transparent shadow-[0_0_12px_rgba(225,29,72,0.8)] animate-[shimmer_1.4s_ease-in-out_infinite]" />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider">
                {(['Synced', 'Booting UI', 'Routing Home'] as const).map((label, i) => {
                  const done = enterStage > i;
                  const active = enterStage === i;
                  return (
                    <span
                      key={label}
                      className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 transition-all duration-300 ${
                        done
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : active
                          ? 'border-rose-500/40 bg-rose-500/15 text-rose-200 shadow-[0_0_10px_rgba(225,29,72,0.4)]'
                          : 'border-white/10 bg-white/5 text-zinc-500'
                      }`}
                    >
                      {done ? (
                        <Check className="h-2 w-2" />
                      ) : active ? (
                        <Loader2 className="h-2 w-2 animate-spin" />
                      ) : (
                        <span className="h-1 w-1 rounded-full bg-current opacity-60" />
                      )}
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── STEP 4: Complete / What's New — soft glass pill redesign ── */
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl p-3 sm:p-4 animate-in fade-in duration-300"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
      onClick={dismissPopup}
    >
      {glassCard(
        <div className="p-6 sm:p-8 text-center">
          {/* Close */}
          <button
            onClick={dismissPopup}
            aria-label="Close"
            className="absolute right-4 top-4 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/60 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <Header
            title={isManualWhatsNew ? "What's New" : 'You are up to date'}
            subtitle={isManualWhatsNew ? 'Latest fixes and polish for your experience.' : currentGroup.highlight}
            pillLabel={isManualWhatsNew ? APP_VERSION : `${APP_VERSION} • ${currentGroup.date}`}
            showSparkles
          />

          <div className="text-left mb-6 sm:mb-8">
            <ChangelogList items={currentGroup.items} />
          </div>

          <GlassButton onClick={handleGo}>
            Explore Now
          </GlassButton>
        </div>
      )}
    </div>
  );
}
