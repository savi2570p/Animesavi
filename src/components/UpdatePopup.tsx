import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePopupQueue } from '@/contexts/PopupQueueContext';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

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

const APP_VERSION = 'v21';

const VERSION_GROUPS: VersionGroup[] = [
  {
    version: 'v21',
    date: 'Latest',
    highlight: 'Cinematic Netflix-style redesign, smarter Telegram toast, and buttery-smooth playback across every device.',
    items: [
      { icon: '🎬', badge: 'NEW', title: 'Cinematic Hero Banner', desc: 'Auto-rotating featured slides with Ken Burns zoom-pan, 7s timing, and slim progress bars.' },
      { icon: '✨', badge: 'IMPROVED', title: 'Netflix-Style UI Polish', desc: 'Red accent section headers, hover scale with red shadows, and edge-fade row masks site-wide.' },
      { icon: '🌟', badge: 'NEW', title: 'Featured Anime Refresh', desc: 'Witch Hat Atelier and Grand Blue Dreaming now headline the hero rotation with curated view counts.' },
      { icon: '📺', badge: 'IMPROVED', title: 'Continue Watching', desc: 'Faster loading, deduplicated entries, and a tighter row layout for quicker resume.' },
      { icon: '🔥', badge: 'IMPROVED', title: 'Discovery Rows', desc: 'Recommended, Most Popular, Latest Series/Episodes/Movies, Coming Soon, and Recently Completed all refreshed.' },
      { icon: '📅', badge: 'IMPROVED', title: 'Release Calendar', desc: 'Cleaner row layout with fixed date column for at-a-glance weekly browsing.' },
      { icon: '💬', badge: 'NEW', title: 'Language-Aware Telegram Toast', desc: 'Toast text now adapts to your subtitle/audio language with browser fallback (8 languages).' },
      { icon: '📱', badge: 'FIX', title: 'Safe-Area Toast Offsets', desc: 'Telegram toast respects iOS notches and Android nav bars — never overlaps player controls.' },
      { icon: '🛡️', badge: 'FIX', title: 'Playback Safeguard', desc: 'Telegram toast can no longer pause or block video playback when shown or dismissed.' },
      { icon: '⚡', badge: 'IMPROVED', title: 'Smoother Everywhere', desc: 'Tuned animations, lazy loading, and scroll performance for desktop, iOS, and Android.' },
    ],
  },
  {
    version: 'v20',
    date: 'Previous',
    highlight: 'Smoother uploads, richer metadata, and a polished player experience.',
    items: [
      { icon: '📅', badge: 'IMPROVED', title: 'Upcoming Refresh', desc: 'Coming Soon panels surface richer anime details with improved mobile presentation.' },
      { icon: '🎞️', badge: 'IMPROVED', title: 'Player Polish', desc: 'Smoother fullscreen shortcuts, color customization, and premium controls.' },
      { icon: '📱', badge: 'FIX', title: 'Mobile Popup Fix', desc: "Opening What's New from the hamburger now closes the menu first so the popup is fully visible." },
    ],
  },
];

const BADGE_STYLES: Record<BadgeKind, string> = {
  NEW: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  IMPROVED: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  FIX: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

export function UpdatePopup() {
  const { activePopup, dismissPopup, isManualWhatsNew } = usePopupQueue();
  const navigate = useNavigate();
  const [step, setStep] = useState<UpdateStep>('alert');
  const [progress, setProgress] = useState(0);
  const [versionIndex, setVersionIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const isActive = activePopup === 'whatsNew';

  useEffect(() => {
    if (isActive) {
      setStep(isManualWhatsNew ? 'complete' : 'alert');
      setProgress(0);
      setVersionIndex(0);
    }
  }, [isActive, isManualWhatsNew]);

  useEffect(() => {
    if (step !== 'downloading') return;
    setProgress(0);
    const duration = 10000;
    const tickMs = 80;
    const increment = 100 / (duration / tickMs);
    let current = 0;

    intervalRef.current = setInterval(() => {
      current += increment + Math.random() * 0.3;
      if (current >= 100) {
        current = 100;
        if (intervalRef.current) clearInterval(intervalRef.current);
        setProgress(100);
        setTimeout(() => setStep('installing'), 400);
      } else {
        setProgress(current);
      }
    }, tickMs);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [step]);

  useEffect(() => {
    if (step !== 'installing') return;
    const timer = setTimeout(() => setStep('complete'), 5000);
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
          <h2 className="text-xl font-bold text-white">Update Available</h2>
          <p className="text-sm text-zinc-400">New features and improvements are ready to install.</p>
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

  /* ── STEP 2: Downloading ── */
  if (step === 'downloading') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-lg">
        <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-red-600/30 bg-gradient-to-b from-zinc-900/95 to-black/95 shadow-2xl shadow-red-900/20 p-8 text-center space-y-5 animate-in zoom-in-95 duration-300">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-600/15 flex items-center justify-center animate-pulse">
            <span className="text-3xl">⬇️</span>
          </div>
          <h2 className="text-xl font-bold text-white">Downloading Update…</h2>
          <p className="text-sm text-zinc-500">Please wait, this will only take a moment.</p>
          <div className="space-y-2 pt-2">
            <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-100 ease-linear shadow-[0_0_12px_rgba(220,38,38,0.5)]" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-lg font-mono font-bold text-red-400">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── STEP 3: Installing ── */
  if (step === 'installing') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-lg">
        <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-red-600/30 bg-gradient-to-b from-zinc-900/95 to-black/95 shadow-2xl shadow-red-900/20 p-8 text-center space-y-5 animate-in zoom-in-95 duration-300">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-600/15 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-white">Installing Updates</h2>
          <p className="text-sm text-zinc-500">Almost done, setting up new features…</p>
          <div className="flex justify-center gap-1.5 pt-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── STEP 4: Complete / What's New (with version groups + swipe) ── */
  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/90 p-3 backdrop-blur-lg animate-in fade-in duration-300 sm:items-center sm:p-4">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-red-600/30 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black/95 shadow-2xl shadow-red-900/20 animate-in zoom-in-95 duration-300">
        <div className="border-b border-white/5 px-5 py-4 sm:px-8 sm:py-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-600/15">
            <span className="text-3xl">✅</span>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              {isManualWhatsNew ? "What's New" : 'Updated to latest version'}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">{currentGroup.highlight}</p>
            <span className="mt-3 inline-block rounded bg-red-600/20 px-2 py-0.5 text-[10px] font-mono text-red-400">{APP_VERSION}</span>
          </div>

          {/* Version pager */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={goPrev}
              disabled={versionIndex === 0}
              className="rounded-full border border-white/10 bg-white/5 p-1.5 text-white/70 transition hover:bg-white/10 disabled:opacity-30"
              aria-label="Previous version"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5">
              {VERSION_GROUPS.map((g, i) => (
                <button
                  key={g.version}
                  onClick={() => setVersionIndex(i)}
                  className={`rounded-full transition-all ${i === versionIndex ? 'h-1.5 w-6 bg-red-500' : 'h-1.5 w-1.5 bg-white/20'}`}
                  aria-label={`Go to ${g.version}`}
                />
              ))}
            </div>
            <button
              onClick={goNext}
              disabled={versionIndex === VERSION_GROUPS.length - 1}
              className="rounded-full border border-white/10 bg-white/5 p-1.5 text-white/70 transition hover:bg-white/10 disabled:opacity-30"
              aria-label="Next version"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Swipeable card */}
        <div
          className="space-y-2 px-5 py-4 text-left sm:max-h-[44vh] sm:px-8 sm:py-6 overflow-y-auto"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-mono font-bold uppercase text-red-300">{currentGroup.version}</span>
            <span className="text-[10px] uppercase tracking-wider text-white/40">{currentGroup.date}</span>
          </div>
          {currentGroup.items.map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-3 animate-in fade-in slide-in-from-right-2 duration-300">
              <span className="shrink-0 text-base">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h4 className="text-sm font-semibold leading-tight text-white">{item.title}</h4>
                  <span className={`shrink-0 rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${BADGE_STYLES[item.badge]}`}>{item.badge}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{item.desc}</p>
              </div>
            </div>
          ))}
          <p className="pt-2 text-center text-[10px] text-white/30 sm:hidden">← Swipe to browse versions →</p>
        </div>

        <div className="px-5 pb-5 sm:px-8 sm:pb-8">
          <button
            onClick={handleGo}
            className="w-full rounded-xl bg-gradient-to-r from-red-700 to-red-500 py-3 font-semibold text-white shadow-lg shadow-red-900/30 transition-all hover:from-red-600 hover:to-red-400"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
