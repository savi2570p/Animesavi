import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePopupQueue } from '@/contexts/PopupQueueContext';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, X, ArrowRight, Check, FileText, Download } from 'lucide-react';
import {
  APP_VERSION,
  RELEASE_DATE,
  DOWNLOAD_SIZE_MB,
  VERSION_GROUPS,
  BADGE_LABELS,
  BADGE_STYLES,
  BADGE_ICON_RINGS,
  BADGE_DOT,
  type ChangelogItem,
} from '@/data/releaseNotes';

type UpdateStep = 'alert' | 'downloading' | 'installing' | 'complete' | 'entering';

const RANDOM_DOWNLOAD_MB = DOWNLOAD_SIZE_MB;

const DOWNLOAD_COMPLETED_KEY = `update_downloaded_${APP_VERSION}`;


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

  // Screen-reader announcements: throttled to 10% milestones so assistive tech
  // isn't flooded by the per-frame percentage updates.
  const [srAnnouncement, setSrAnnouncement] = useState('');
  const lastMilestoneRef = useRef(-1);

  useEffect(() => {
    if (step !== 'downloading') {
      lastMilestoneRef.current = -1;
      setSrAnnouncement('');
      return;
    }
    const pct = Math.floor(progress);
    const milestone = Math.floor(pct / 10) * 10;
    if (milestone === lastMilestoneRef.current) return;
    lastMilestoneRef.current = milestone;

    const downloadedMbNow = (progress / 100) * TOTAL_MB;
    const remainingMbNow = Math.max(0, TOTAL_MB - downloadedMbNow);
    const mbPerSecNow = Math.max(0.1, speedMbps / 8);
    const etaSecNow = pct >= 100 ? 0 : Math.ceil(remainingMbNow / mbPerSecNow);
    const etaSpoken =
      etaSecNow <= 0
        ? 'finishing up'
        : etaSecNow >= 60
        ? `about ${Math.floor(etaSecNow / 60)} minute${Math.floor(etaSecNow / 60) > 1 ? 's' : ''} ${etaSecNow % 60} seconds remaining`
        : `about ${etaSecNow} seconds remaining`;

    setSrAnnouncement(
      pct >= 100
        ? `Download complete. ${TOTAL_MB} megabytes downloaded. Verifying update.`
        : `Downloading update: ${milestone} percent, ${downloadedMbNow.toFixed(1)} of ${TOTAL_MB} megabytes, ${etaSpoken}.`
    );
  }, [progress, step, speedMbps, TOTAL_MB]);


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
  const openReleaseNotes = useCallback(() => {
    dismissPopup();
    navigate('/release-notes');
  }, [dismissPopup, navigate]);
  const handleGo = useCallback(() => {
    // Only play the cinematic "Entering the latest version" loader when the
    // user has downloaded this version. Manual What's New views just close.
    const hasDownloadedLatestVersion = localStorage.getItem(DOWNLOAD_COMPLETED_KEY) === 'true';
    const shouldPlayEnteringLoader = justDownloadedRef.current || (!isManualWhatsNew && hasDownloadedLatestVersion);

    if (!shouldPlayEnteringLoader) {
      dismissPopup();
      return;
    }
    justDownloadedRef.current = false;
    enteringFromPathRef.current = location.pathname;
    setEnterStage(0);
    setStep('entering');
  }, [dismissPopup, isManualWhatsNew, location.pathname]);

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
  const isComplete = step === 'complete';
  const working = step === 'downloading' || step === 'installing' || step === 'entering';
  const title = step === 'alert' ? 'A fresh update' : step === 'downloading' ? 'Updating AnimeSavi' : step === 'installing' ? 'Finishing up' : step === 'entering' ? 'Ready to watch' : "What's New";
  const shownProgress = step === 'downloading' ? Math.round(displayProgress) : step === 'entering' ? Math.round(((enterStage + 1) / 3) * 100) : 100;

  return (
    <div className="utility-overlay-v6 fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={isComplete ? dismissPopup : undefined}>
      <div role="dialog" aria-modal="true" aria-labelledby="update-title" aria-describedby="update-description" className="utility-glass-v6 update-v6 w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <header className="utility-header-v6 p-5 sm:p-6 border-b border-border">
          <div className="flex items-center justify-between gap-3 mb-4"><span className="utility-icon-v6 h-10 w-10 rounded-lg grid place-items-center"><Sparkles className="h-5 w-5 text-primary" /></span><div className="flex items-center gap-2"><span className="text-xs font-semibold text-primary">{APP_VERSION}</span>{isComplete && <Button variant="ghost" size="icon" aria-label="Close What's New" onClick={dismissPopup} className="h-8 w-8"><X className="h-4 w-4" /></Button>}</div></div>
          <h2 id="update-title" className="text-2xl font-bold">{title}</h2>
          <p id="update-description" className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">{working ? 'Getting everything ready for you.' : currentGroup.highlight}</p>
          <div className="flex items-center justify-between gap-3 mt-4 text-xs text-muted-foreground"><span>{currentGroup.date}</span><span className="flex items-center gap-1.5"><Download className="h-3.5 w-3.5" />{TOTAL_MB}MB</span></div>
        </header>
        {working ? <div className="p-6 space-y-5">
          <div className="flex items-center justify-between"><span className="flex gap-2 items-center text-sm"><Loader2 className="h-4 w-4 text-primary animate-spin" />{step === 'installing' ? 'Installing updates' : step === 'entering' ? ['Synced', 'Preparing', 'Opening catalogue'][enterStage] : 'Downloading update'}</span><span className="text-sm tabular-nums font-semibold">{shownProgress}%</span></div>
          <div className="utility-progress-v6" role="progressbar" aria-label="Update progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shownProgress}><span style={{width: `${shownProgress}%`}} /></div>
          <p role="status" className="sr-only">{srAnnouncement}</p>
        </div> : <div className="update-v6-list px-5 sm:px-6" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {currentGroup.items.map(item => <div key={item.title} className="flex items-start gap-3 py-3.5 border-b border-border/60 last:border-0"><span className={`release-icon-v6 release-${item.badge.toLowerCase()} shrink-0 h-8 w-8 rounded-md grid place-items-center text-base`}>{item.icon}</span><div className="min-w-0"><div className="flex items-center flex-wrap gap-2"><h3 className="text-xs sm:text-sm font-semibold">{item.title}</h3><span className={`release-label-v6 release-${item.badge.toLowerCase()}`}>{BADGE_LABELS[item.badge]}</span></div><p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p></div></div>)}
        </div>}
        <footer className="p-4 sm:p-5 border-t border-border flex flex-col gap-2">
          {!working && <Button onClick={isComplete ? handleGo : handleDownload} className="w-full">{isComplete ? 'Explore now' : 'Download update'}<ArrowRight className="h-4 w-4" /></Button>}
          <Button variant="ghost" size="sm" onClick={openReleaseNotes}><FileText className="h-3.5 w-3.5" />Full release notes<ArrowRight className="h-3.5 w-3.5" /></Button>
        </footer>
      </div>
    </div>
  );
}
