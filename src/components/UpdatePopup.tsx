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
  FIX: 'bg-violet-500/20 text-violet-200 border-violet-400/40',
};

const BADGE_ICON_RINGS: Record<BadgeKind, string> = {
  NEW: 'from-emerald-500/25 to-emerald-600/15 border-emerald-500/20 shadow-emerald-900/20',
  IMPROVED: 'from-sky-500/25 to-sky-600/15 border-sky-500/20 shadow-sky-900/20',
  FIX: 'from-violet-500/25 to-purple-600/15 border-violet-400/25 shadow-purple-900/30',
};

const BADGE_DOT: Record<BadgeKind, string> = {
  NEW: 'bg-emerald-400',
  IMPROVED: 'bg-sky-400',
  FIX: 'bg-violet-300',
};

const DOWNLOAD_COMPLETED_KEY = `update_downloaded_${APP_VERSION}`;

// Shared dark-purple glass overlay backdrop
const OVERLAY =
  'fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-300 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(91,33,182,0.45),rgba(20,5,40,0.65)_55%,rgba(8,2,20,0.85))] backdrop-blur-2xl';

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
  const enteringFromPathRef = useRef<string | null>(null);

  const TOTAL_MB = RANDOM_DOWNLOAD_MB;

  const isActive = activePopup === 'whatsNew';

  // Tracks whether the user went through the download flow in this session.
  // The "Entering the latest version" loader only plays after a fresh download.
  const justDownloadedRef = useRef(false);

  useEffect(() => {
    if (isActive) {
      const alreadyDownloaded = localStorage.getItem(DOWNLOAD_COMPLETED_KEY) === 'true';
      setStep(alreadyDownloaded ? 'complete' : 'alert');
      setProgress(0);
      setVersionIndex(0);
      // Reset on every fresh open so manual What's New views skip the loader.
      justDownloadedRef.current = false;
    }
  }, [isActive, isManualWhatsNew]);

  useEffect(() => {
    if (step !== 'downloading') return;
    setProgress(0);
    setDisplayProgress(0);
    setSpeedMbps(0);
    setSpeedHistory([]);

    const tickMs = 90;
    let current = 0;
    intervalRef.current = setInterval(() => {
      let baseSpeed: number;
      if (current < 15) baseSpeed = 12 + current * 1.0;
      else if (current < 75) baseSpeed = 28 + Math.sin(current / 10) * 4;
      else baseSpeed = Math.max(8, 26 - (current - 75) * 0.4);

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

  useEffect(() => {
    if (step !== 'downloading') {
      setDisplayProgress(progress);
      return;
    }
    const animate = () => {
      setDisplayProgress((prev) => {
        const diff = progress - prev;
        if (Math.abs(diff) < 0.05) return progress;
        return prev + diff * 0.18;
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [progress, step]);

  useEffect(() => {
    if (step !== 'installing') return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(DOWNLOAD_COMPLETED_KEY, 'true'); } catch { /* ignore */ }
      setStep('complete');
    }, 1800);
    return () => clearTimeout(timer);
  }, [step]);

  const handleDownload = useCallback(() => {
    justDownloadedRef.current = true;
    setStep('downloading');
  }, []);
  const handleGo = useCallback(() => {
    // Only play the cinematic "Entering the latest version" loader when the
    // user actually downloaded this session. Manual What's New views just close.
    if (!justDownloadedRef.current) {
      dismissPopup();
      return;
    }
    justDownloadedRef.current = false;
    enteringFromPathRef.current = location.pathname;
    setEnterStage(0);
    setStep('entering');
  }, [dismissPopup, location.pathname]);

  useEffect(() => {
    if (step !== 'entering') return;
    setEnterStage(0);
    const stage1 = setTimeout(() => setEnterStage(1), 1100);
    const stage2 = setTimeout(() => setEnterStage(2), 2300);
    const finish = setTimeout(() => {
      const startedFrom = enteringFromPathRef.current;
      dismissPopup();
      if (startedFrom !== null && location.pathname === startedFrom && location.pathname !== '/') {
        navigate('/');
      } else if (startedFrom === '/') {
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
      className={`relative w-full max-w-[300px] sm:max-w-[320px] mx-auto overflow-hidden bg-purple-950/25 backdrop-blur-3xl border border-violet-300/15 rounded-[36px] shadow-[0_36px_90px_-16px_rgba(76,29,149,0.7),inset_0_1px_1px_rgba(216,180,254,0.18)] font-popup ${className}`}
    >
      {/* Purple ambient glow */}
      <div className="absolute -inset-1 bg-gradient-to-b from-violet-400/15 via-purple-500/5 to-transparent rounded-[44px] blur-xl opacity-40 pointer-events-none" />
      {/* Glass reflection sheen */}
      <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-white/[0.06] via-transparent to-transparent rotate-12 pointer-events-none" />
      {/* Top hairline highlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-violet-200/40 to-transparent" />
      {/* Subtle bottom purple bloom */}
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-2/3 h-20 bg-purple-600/30 blur-3xl rounded-full pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );

  const ChangelogList = ({ items, compact = true }: { items: ChangelogItem[]; compact?: boolean }) => (
    <div className="space-y-2.5">
      {items.map((item, idx) => (
        <div
          key={item.title}
          className="flex items-start gap-2.5 sm:gap-3 animate-in fade-in slide-in-from-right-2 duration-300"
          style={{ animationDelay: `${idx * 35}ms` }}
        >
          <div
            className={`flex-shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br ${BADGE_ICON_RINGS[item.badge]} border shadow-md text-sm w-8 h-8 sm:w-9 sm:h-9`}
          >
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1">
              <h4 className="font-semibold leading-tight text-white text-[11px] sm:text-[12px]">
                {item.title}
              </h4>
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0 text-[7px] font-bold uppercase tracking-wider"
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1 py-[1px] text-[7px] font-bold uppercase tracking-wider ${BADGE_STYLES[item.badge]}`}
              >
                <span className={`h-1 w-1 rounded-full ${BADGE_DOT[item.badge]}`} />
                {BADGE_LABELS[item.badge]}
              </span>
            </div>
            <p className="text-[10px] leading-snug text-violet-200/55 mt-0.5">
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
        <div className="absolute -inset-px bg-gradient-to-r from-violet-500 via-purple-600 to-indigo-600 rounded-2xl blur-md opacity-40 group-hover:opacity-80 transition duration-500" />
        <div className="relative flex items-center justify-center w-full h-12 bg-gradient-to-r from-violet-600/40 via-purple-600/35 to-indigo-600/40 group-hover:from-violet-600/55 group-hover:to-indigo-600/55 border border-violet-300/30 backdrop-blur-md rounded-2xl text-white font-bold text-sm tracking-wide transition-all">
          {children}
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </div>
      </button>
    );
  };

  const VersionPill = ({ label = APP_VERSION }: { label?: string }) => (
    <div className="inline-flex items-center px-3 py-1 rounded-full bg-violet-500/15 border border-violet-300/30 text-violet-200 text-[10px] font-bold tracking-widest uppercase backdrop-blur">
      <span className="relative flex h-2 w-2 mr-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-300 opacity-50" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-400" />
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
        <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-purple-600/20 border border-violet-300/20 shadow-lg shadow-purple-900/40">
          <Sparkles className="h-5 w-5 text-violet-200" />
        </div>
      )}
      <VersionPill label={pillLabel} />
      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-popup">{title}</h2>
        <p className="text-violet-200/60 text-xs sm:text-sm leading-relaxed px-2 sm:px-4">{subtitle}</p>
      </div>
    </div>
  );

  /* ── STEP 1: Update Alert ── */
  if (step === 'alert') {
    return (
      <div className={OVERLAY}>
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

  /* ── STEP 2: Downloading ── */
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
      <div className={OVERLAY}>
        {glassCard(
          <div className="px-6 py-7 sm:px-7 sm:py-8 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-500/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-violet-200 mb-5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-300" />
              </span>
              Downloading {APP_VERSION}
            </div>

            <div className="relative h-28 w-28 sm:h-32 sm:w-32 mx-auto mb-5">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/35 to-purple-600/20 blur-2xl animate-pulse" />
              <svg className="relative h-full w-full -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r={radius} stroke="rgba(216,180,254,0.08)" strokeWidth="5" fill="none" />
                <circle
                  cx="64" cy="64" r={radius}
                  stroke="url(#dlGrad)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ filter: 'drop-shadow(0 0 10px rgba(139,92,246,0.7))', transition: 'stroke-dashoffset 200ms linear' }}
                />
                <defs>
                  <linearGradient id="dlGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#c4b5fd" />
                    <stop offset="60%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl sm:text-[26px] font-bold font-mono bg-gradient-to-br from-white via-violet-100 to-violet-300 bg-clip-text text-transparent tabular-nums leading-none">
                  {displayProgress.toFixed(0)}<span className="text-sm text-violet-300">%</span>
                </span>
                <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.25em] text-violet-300/60 mt-1">{phaseLabel}</span>
              </div>
            </div>

            <h2 className="bg-gradient-to-r from-white via-violet-100 to-white bg-clip-text text-base font-bold text-transparent tracking-tight">
              Downloading update
            </h2>
            <p className="text-[11px] text-violet-200/60 mt-1 leading-relaxed px-2">
              Securing the latest fixes and improvements…
            </p>

            <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-violet-300/[0.08]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 via-purple-400 to-indigo-500 shadow-[0_0_12px_rgba(139,92,246,0.7)] transition-all duration-200"
                style={{ width: `${displayProgress}%` }}
              />
              <div
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"
                style={{ left: `${Math.max(0, displayProgress - 33)}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 w-full mt-4 text-left">
              {[
                { label: 'Speed', value: speedMbps.toFixed(1), unit: 'Mbps', accent: 'text-white' },
                { label: 'Size', value: downloadedMb.toFixed(1), unit: `/${TOTAL_MB}MB`, accent: 'text-white' },
                { label: 'ETA', value: etaLabel, unit: '', accent: 'text-violet-200' },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-violet-300/15 bg-violet-500/[0.06] backdrop-blur-md px-2 py-2">
                  <div className="text-[8px] uppercase tracking-[0.18em] text-violet-300/60 font-semibold">{s.label}</div>
                  <div className={`text-[12px] font-bold font-mono tabular-nums leading-tight mt-0.5 ${s.accent}`}>
                    {s.value}{s.unit && <span className="text-[8px] text-violet-300/60 ml-0.5 font-normal">{s.unit}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-3 h-8 w-full rounded-2xl border border-violet-300/15 bg-purple-950/40 overflow-hidden px-1.5">
              {sparkPoints ? (
                <svg viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none" className="h-full w-full">
                  <defs>
                    <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={`0,${sparkH} ${sparkPoints} ${sparkW},${sparkH}`} fill="url(#sparkFill)" />
                  <polyline
                    points={sparkPoints}
                    fill="none"
                    stroke="#a78bfa"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ filter: 'drop-shadow(0 0 3px rgba(167,139,250,0.8))' }}
                  />
                </svg>
              ) : (
                <div className="flex items-center justify-center h-full text-[9px] uppercase tracking-[0.2em] text-violet-300/40">
                  Measuring network…
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── STEP 3: Installing ── */
  if (step === 'installing') {
    const stages = [
      { icon: '🔓', label: 'Unpacking files' },
      { icon: '⚙️', label: 'Configuring system' },
      { icon: '✨', label: 'Optimizing assets' },
      { icon: '🚀', label: 'Finalizing install' },
    ];
    return (
      <div className={OVERLAY}>
        {glassCard(
          <div className="p-6 sm:p-8 text-center">
            <div className="relative inline-flex items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-200 mb-5 sm:mb-6">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Installing {APP_VERSION}
            </div>

            <div className="relative mx-auto h-20 w-20 sm:h-24 sm:w-24 mb-5 sm:mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/40 to-purple-600/25 blur-xl animate-pulse" />
              <div className="absolute inset-2 rounded-full border-2 border-violet-500/40 border-t-violet-300 animate-spin" style={{ animationDuration: '1.4s' }} />
              <div className="absolute inset-5 rounded-full border-2 border-purple-500/30 border-b-purple-300 animate-spin" style={{ animationDuration: '1.8s', animationDirection: 'reverse' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl sm:text-3xl">⚙️</span>
              </div>
            </div>

            <div className="space-y-1 mb-5 sm:mb-6">
              <h2 className="text-base sm:text-lg font-bold text-white">Installing Updates</h2>
              <p className="text-[11px] sm:text-xs text-violet-200/60">Setting up fixes and polishing the experience…</p>
            </div>

            <div className="space-y-1.5 text-left">
              {stages.map((stage, i) => (
                <div
                  key={stage.label}
                  className="flex items-center gap-2.5 rounded-xl border border-violet-300/10 bg-violet-500/[0.05] px-3 py-2 animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${i * 350}ms`, animationDuration: '500ms', animationFillMode: 'both' }}
                >
                  <span className="text-base shrink-0">{stage.icon}</span>
                  <span className="flex-1 text-[11px] font-semibold text-white/90">{stage.label}</span>
                  <Loader2 className="h-3 w-3 text-violet-300 animate-spin shrink-0" />
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-1.5 pt-5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── STEP 3.5: Entering ── */
  if (step === 'entering') {
    const totalStages = 3;
    const barProgress = ((enterStage + 1) / totalStages) * 100;
    const stages = [
      { label: 'Synced', desc: 'Your library is up to date.' },
      { label: 'Booting UI', desc: 'Preparing the new experience.' },
      { label: 'Routing Home', desc: 'Taking you to the latest.' },
    ];
    return (
      <div className={OVERLAY}>
        {glassCard(
          <div className="px-6 py-7 sm:px-7 sm:py-8 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-500/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-violet-200 mb-5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-300" />
              </span>
              {APP_VERSION} • Ready
            </div>

            <div className="relative h-20 w-20 sm:h-24 sm:w-24 mx-auto mb-5">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/40 to-purple-600/30 blur-2xl animate-pulse" />
              <div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-300 border-r-violet-400"
                style={{ animation: 'spin 1.4s linear infinite' }}
              />
              <div
                className="absolute inset-2 rounded-full border-2 border-transparent border-b-purple-300 border-l-purple-400"
                style={{ animation: 'spin 2s linear infinite reverse' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 shadow-[0_0_28px_rgba(139,92,246,0.8)] flex items-center justify-center">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white drop-shadow" />
                </div>
              </div>
            </div>

            <h2 className="bg-gradient-to-r from-white via-violet-100 to-white bg-clip-text text-base sm:text-lg font-bold text-transparent tracking-tight">
              Entering the latest version
            </h2>
            <p className="text-[11px] text-violet-200/65 mt-1 leading-relaxed transition-all duration-300 min-h-[1.25rem]">
              {stages[enterStage]?.desc}
            </p>

            <div className="relative mt-5 h-1.5 w-full overflow-hidden rounded-full bg-violet-300/[0.08]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 via-purple-400 to-indigo-500 shadow-[0_0_12px_rgba(139,92,246,0.7)] transition-all duration-700 ease-out"
                style={{ width: `${barProgress}%` }}
              />
              <div
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"
                style={{ left: `${Math.max(0, barProgress - 33)}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {stages.map((s, i) => {
                const done = enterStage > i;
                const active = enterStage === i;
                return (
                  <div
                    key={s.label}
                    className={`flex items-center justify-center gap-1 rounded-2xl border px-1.5 py-1.5 text-[8.5px] font-bold uppercase tracking-wider transition-all duration-300 ${
                      done
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : active
                        ? 'border-violet-300/40 bg-violet-500/20 text-violet-100 shadow-[0_0_10px_rgba(139,92,246,0.5)]'
                        : 'border-violet-300/10 bg-violet-500/[0.04] text-violet-300/50'
                    }`}
                  >
                    {done ? (
                      <Check className="h-2.5 w-2.5" />
                    ) : active ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-current opacity-60" />
                    )}
                    <span className="truncate">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── STEP 4: Complete / What's New ── */
  return (
    <div
      className={OVERLAY}
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
      onClick={dismissPopup}
    >
      {glassCard(
        <div className="p-6 sm:p-8 text-center">
          <button
            onClick={dismissPopup}
            aria-label="Close"
            className="absolute right-4 top-4 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-violet-300/20 bg-purple-950/40 text-violet-200/70 backdrop-blur-md transition hover:bg-violet-500/20 hover:text-white"
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
