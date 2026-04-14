import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePopupQueue } from '@/contexts/PopupQueueContext';
import { Loader2 } from 'lucide-react';

type UpdateStep = 'alert' | 'downloading' | 'installing' | 'complete';

export function UpdatePopup() {
  const { activePopup, dismissPopup, isManualWhatsNew } = usePopupQueue();
  const navigate = useNavigate();
  const [step, setStep] = useState<UpdateStep>('alert');
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = activePopup === 'whatsNew';

  useEffect(() => {
    if (isActive) {
      setStep(isManualWhatsNew ? 'complete' : 'alert');
      setProgress(0);
    }
  }, [isActive, isManualWhatsNew]);

  // Progress bar animation — 10 seconds
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

  // Installing step — 5 seconds then complete
  useEffect(() => {
    if (step !== 'installing') return;
    const timer = setTimeout(() => setStep('complete'), 5000);
    return () => clearTimeout(timer);
  }, [step]);

  const handleDownload = useCallback(() => setStep('downloading'), []);

  const handleGo = useCallback(() => {
    dismissPopup();
    navigate('/');
  }, [dismissPopup, navigate]);

  if (!isActive) return null;

  const changelogItems = [
    { icon: '📡', title: 'Smart Casting', desc: 'AirPlay & Chromecast support for seamless TV playback' },
    { icon: '🎞️', title: 'X-PLUS Server', desc: 'Flat cinema controls with a cleaner fullscreen player' },
    { icon: '📝', title: 'CC & E-Sub Fix', desc: 'Uploaded subtitles now toggle properly, even with multi-audio' },
    { icon: '🔁', title: 'Server Retry', desc: 'Tap the same server again to reload without leaving the page' },
    { icon: '📦', title: 'Detailed Progress', desc: 'Pending Upload, Crunchy & MuseIN now explain what is being prepared' },
    { icon: '🍎', title: 'Smaller iOS Controls', desc: 'Playback controls are more compact on iPhone & iPad' },
    { icon: '✨', title: 'No Auto Switching', desc: 'Your selected server stays selected until you change it' },
    { icon: '📊', title: 'Enhanced Reports', desc: '9 category chips with automatic device metadata' },
  ];

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

          <div className="space-y-1.5 text-left max-h-[30vh] overflow-y-auto pr-1">
            {changelogItems.map((item) => (
              <div key={item.title} className="flex items-center gap-2.5 p-2 bg-white/5 rounded-md">
                <span className="text-sm shrink-0">{item.icon}</span>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-white leading-tight">{item.title}</h4>
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

          {/* Download progress appears here after clicking */}
        </div>
      </div>
    );
  }

  /* ── STEP 2: Downloading (inline under button, NOT fullscreen) ── */
  if (step === 'downloading') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-lg">
        <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-red-600/30 bg-gradient-to-b from-zinc-900/95 to-black/95 shadow-2xl shadow-red-900/20 p-8 text-center space-y-5 animate-in zoom-in-95 duration-300">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-600/15 flex items-center justify-center animate-pulse">
            <span className="text-3xl">⬇️</span>
          </div>

          <h2 className="text-xl font-bold text-white">Downloading Update…</h2>
          <p className="text-sm text-zinc-500">Please wait, this will only take a moment.</p>

          {/* Progress bar under text, not fullscreen */}
          <div className="space-y-2 pt-2">
            <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-100 ease-linear shadow-[0_0_12px_rgba(220,38,38,0.5)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-lg font-mono font-bold text-red-400">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── STEP 3: Installing Updates (spinner for 5 sec) ── */
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

  /* ── STEP 4: Complete / What's New ── */
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-lg animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-red-600/30 bg-gradient-to-b from-zinc-900/95 to-black/95 shadow-2xl shadow-red-900/20 p-8 text-center space-y-5 animate-in zoom-in-95 duration-300">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-600/15 flex items-center justify-center">
          <span className="text-3xl">✅</span>
        </div>

        <h2 className="text-xl font-bold text-white">
          {isManualWhatsNew ? "What's New" : 'Updated to latest version'}
        </h2>
        <p className="text-sm text-zinc-400">
          {isManualWhatsNew ? 'Here are the latest features and improvements.' : 'Your app is now fully up to date.'}
        </p>

        <div className="space-y-1.5 text-left max-h-[30vh] overflow-y-auto pr-1">
          {changelogItems.map((item) => (
            <div key={item.title} className="flex items-center gap-2.5 p-2 bg-white/5 rounded-md">
              <span className="text-sm shrink-0">{item.icon}</span>
              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-white leading-tight">{item.title}</h4>
                <p className="text-[10px] text-zinc-500 leading-tight">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleGo}
          className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 transition-all shadow-lg shadow-red-900/30"
        >
          GO
        </button>
      </div>
    </div>
  );
}
