import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePopupQueue } from '@/contexts/PopupQueueContext';
import { Loader2, ChevronLeft, ChevronRight, Sparkles, X, ArrowRight, Check } from 'lucide-react';

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

const APP_VERSION = 'V 27';

// Fixed download size for V 27
const RANDOM_DOWNLOAD_MB = 24.0;

const VERSION_GROUPS: VersionGroup[] = [
  {
    version: 'V 27',
    date: 'Latest',
    highlight: 'Flox Anime India + launch, faster uploads, smarter share menu, persistent unmute, and embed playback fixes.',
    items: [
      { icon: '🇮🇳', badge: 'NEW', title: 'Flox Anime India + Tab', desc: 'Brand new Flox Anime India + section on the home page with official Hindi Dubbed streaming rights and a dedicated detail + watch experience.' },
      { icon: '🎬', badge: 'NEW', title: 'Dedicated Flox Watch Page', desc: 'Episodes now open in a full-screen player page with poster, title, season & episode info, and the new "Flox +" server badge.' },
      { icon: '⚡', badge: 'IMPROVED', title: '10-Second Flox Uploads', desc: 'Reworked Flox upload flow — create new anime or add episodes to existing ones in seconds, with poster only required on first creation.' },
      { icon: '🛠️', badge: 'NEW', title: 'Edit, Delete & Add Episodes', desc: 'Manage uploaded Flox anime — edit poster & banner, delete entries, and add more episodes anytime from the top-right Upload menu.' },
      { icon: '🔗', badge: 'IMPROVED', title: 'Cleaner Share Menu', desc: 'Removed "Copy Embed Link" and "Copy iFrame Code" from Share Episode. "Copy Shadow Link" is now restricted to authorized admin accounts only.' },
      { icon: '🔊', badge: 'FIX', title: 'Unmute Stays Unmuted', desc: 'Tapping unmute now remembers your choice across every episode and anime for 24 hours before resetting.' },
      { icon: '🖥️', badge: 'FIX', title: 'Full-Screen Player Fixed', desc: 'Android & PC now use the in-app player controls in full-screen, while iOS keeps its native full-screen experience.' },
      { icon: '▶️', badge: 'FIX', title: 'Embed Playback Restored', desc: 'Removed sandbox & blocking iframe attributes so the Flox embed player loads and plays anime instantly without the "sandbox not allowed" popup.' },
      { icon: '🎉', badge: 'NEW', title: 'Streaming Rights Announcement', desc: 'A celebratory popup welcomes users on /flox announcing our official streaming rights from Flox Anime India.' },
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

  /* ── STEP 1: Update Alert ── */
  if (step === 'alert') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-lg animate-in fade-in duration-300 p-2 sm:p-4">
        <div className="relative w-full max-w-[88vw] xs:max-w-[82vw] sm:max-w-sm rounded-2xl border border-purple-600/30 bg-gradient-to-b from-zinc-900/95 to-black/95 shadow-2xl shadow-purple-900/20 p-3 sm:p-8 text-center space-y-2.5 sm:space-y-5 animate-in zoom-in-95 duration-300 max-h-[82dvh] sm:max-h-[88dvh] overflow-y-auto">
          <div className="mx-auto w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-purple-600/15 flex items-center justify-center">
            <span className="text-xl sm:text-3xl">🔥</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Update Available
          </div>
          <h2 className="text-sm sm:text-xl font-bold text-white">New Version Ready to Install</h2>
          <p className="text-[11px] sm:text-sm text-zinc-400 leading-snug px-1">Tap Download to install the latest features and improvements.</p>
          <span className="inline-block text-[9px] sm:text-[10px] font-mono px-2 py-0.5 rounded bg-purple-600/20 text-purple-400">{APP_VERSION}</span>

          <div className="space-y-1 sm:space-y-1.5 text-left max-h-[22vh] sm:max-h-[30vh] overflow-y-auto pr-1">
            {VERSION_GROUPS[0].items.map((item) => (
              <div key={item.title} className="flex items-center gap-2 p-1.5 sm:p-2 bg-white/5 rounded-md">
                <span className="text-xs shrink-0">{item.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-[10px] sm:text-xs font-semibold text-white leading-tight truncate">{item.title}</h4>
                    <span className={`shrink-0 rounded border px-1 py-px text-[7px] sm:text-[8px] font-bold uppercase tracking-wider ${BADGE_STYLES[item.badge]}`}>{item.badge}</span>
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-zinc-500 leading-tight line-clamp-2">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleDownload}
            className="w-full py-2 sm:py-3 rounded-xl text-xs sm:text-base font-semibold text-white bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 transition-all shadow-lg shadow-purple-900/30"
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
        <div className="relative w-full max-w-sm mx-4 overflow-hidden rounded-2xl border border-purple-600/30 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black/98 shadow-2xl shadow-purple-900/40 p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
          {/* Decorative glows */}
          <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-purple-600/20 blur-3xl animate-pulse" />
          <div className="pointer-events-none absolute -bottom-24 -left-20 h-52 w-52 rounded-full bg-purple-500/15 blur-3xl" />

          {/* Header pill */}
          <div className="relative inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-400" />
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
                style={{ filter: 'drop-shadow(0 0 8px rgba(168,85,247,0.6))' }}
              />
              <defs>
                <linearGradient id="dlGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold font-mono bg-gradient-to-br from-white to-purple-300 bg-clip-text text-transparent tabular-nums">
                {displayProgress.toFixed(1)}<span className="text-lg text-purple-400">%</span>
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
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-600 via-purple-500 to-orange-400 shadow-[0_0_12px_rgba(168,85,247,0.6)]"
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
                {downloadedMb.toFixed(2)}
                <span className="text-[9px] text-zinc-500 ml-0.5">/{TOTAL_MB.toFixed(2)}MB</span>
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2">
              <div className="text-[8px] uppercase tracking-[0.15em] text-zinc-500 font-semibold">ETA</div>
              <div className="text-[13px] font-bold font-mono text-purple-300 tabular-nums leading-tight">
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
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
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
                  style={{ filter: 'drop-shadow(0 0 3px rgba(192,132,252,0.6))' }}
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
        <div className="relative w-full max-w-sm mx-4 overflow-hidden rounded-2xl border border-purple-600/30 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black/98 shadow-2xl shadow-purple-900/40 p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">

          {/* Header pill */}
          <div className="relative inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Installing {APP_VERSION}
          </div>

          {/* Animated install icon */}
          <div className="relative mx-auto h-24 w-24">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/30 to-orange-500/20 blur-xl animate-pulse" />
            <div className="absolute inset-2 rounded-full border-2 border-purple-500/40 border-t-purple-500 animate-spin" style={{ animationDuration: '1.4s' }} />
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
                <Loader2 className="h-3 w-3 text-purple-400 animate-spin shrink-0" />
              </div>
            ))}
          </div>

          {/* Bouncing dots */}
          <div className="flex justify-center gap-1.5 pt-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── STEP 3.5: Entering — first-time post-update transition ── */
  if (step === 'entering') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-300"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="relative w-full max-w-[19rem] rounded-2xl border border-purple-600/30 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black/98 shadow-2xl shadow-purple-900/40 px-5 py-6 animate-in zoom-in-95 duration-300 overflow-hidden">
          {/* Subtle glows inside card */}
          <div className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full bg-purple-600/20 blur-3xl animate-pulse" />
          <div className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-violet-500/15 blur-3xl" />

          <div className="relative z-10 flex flex-col items-center gap-4 text-center">
            {/* Concentric rings — compact */}
            <div className="relative h-20 w-20">
              <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
              <div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-400 border-r-purple-500"
                style={{ animation: 'spin 1.4s linear infinite' }}
              />
              <div
                className="absolute inset-2 rounded-full border-2 border-transparent border-b-violet-300 border-l-violet-400"
                style={{ animation: 'spin 2s linear infinite reverse' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-600 shadow-[0_0_24px_rgba(168,85,247,0.7)] flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white drop-shadow" />
                </div>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.2em] text-purple-200">
                <span className="relative flex h-1 w-1">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex h-1 w-1 rounded-full bg-purple-400" />
                </span>
                {APP_VERSION} • Ready
              </div>
              <h2 className="bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-base font-bold text-transparent">
                Entering the latest version
              </h2>
              <p className="text-[10px] text-zinc-400 transition-all duration-300 min-h-[1.25rem]">
                {enterStage === 0 && 'Synced — your library is up to date.'}
                {enterStage === 1 && 'Booting UI — preparing the new experience.'}
                {enterStage === 2 && 'Routing Home — taking you to the latest.'}
              </p>
            </div>

            {/* Indeterminate progress bar */}
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/5">
              <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_12px_rgba(168,85,247,0.8)] animate-[shine_1.4s_ease-in-out_infinite]" />
            </div>

            {/* Stage chips */}
            <div className="flex flex-wrap items-center justify-center gap-1 text-[8px] font-semibold uppercase tracking-wider">
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
                        ? 'border-purple-500/40 bg-purple-500/15 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
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
      </div>
    );
  }

  /* ── STEP 4: Complete / What's New — compact cinematic redesign ── */
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-3 backdrop-blur-xl animate-in fade-in duration-300 sm:p-4"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
      onClick={dismissPopup}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col overflow-hidden border border-purple-600/25 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black/98 shadow-2xl shadow-purple-900/30 animate-in zoom-in-95 duration-300"
        style={{ width: 'min(92vw, 420px)', maxHeight: 'min(82dvh, 640px)', borderRadius: '26px' }}
      >

        {/* Decorative glows */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-purple-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />

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
          <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600/30 to-purple-500/10 ring-1 ring-purple-500/30">
            <Sparkles className="h-5 w-5 text-purple-400" />
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
          <span className="mt-2 inline-block rounded-md border border-purple-500/30 bg-purple-600/15 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-purple-300">
            {APP_VERSION}
          </span>
        </div>

        {/* Single-version mode — pager hidden */}

        {/* Items — compact rows, scroll-locked height */}
        <div
          className="relative flex-1 min-h-0 space-y-1.5 overflow-y-auto px-4 py-3"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {currentGroup.items.map((item, idx) => (
            <div
              key={item.title}
              className="group flex items-start gap-2.5 rounded-lg border border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-2.5 transition-all hover:border-purple-500/20 hover:from-purple-500/5 animate-in fade-in slide-in-from-right-2 duration-300"
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
        <div className="relative shrink-0 border-t border-white/5 bg-black/40 px-4 py-2.5">
          <button
            onClick={handleGo}
            className="group mx-auto flex w-auto min-w-[140px] max-w-[220px] items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-purple-700 via-purple-600 to-purple-500 px-5 py-2 text-[13px] font-semibold text-white shadow-lg shadow-purple-900/40 transition-all hover:from-purple-600 hover:to-purple-400 hover:shadow-purple-700/50"
          >
            Explore Now
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
