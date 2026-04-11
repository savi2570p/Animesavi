import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePopupQueue } from '@/contexts/PopupQueueContext';

type UpdateStep = 'alert' | 'downloading' | 'complete';

export function UpdatePopup() {
  const { activePopup, dismissPopup } = usePopupQueue();
  const navigate = useNavigate();
  const [step, setStep] = useState<UpdateStep>('alert');
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = activePopup === 'whatsNew';

  // Reset step when popup opens
  useEffect(() => {
    if (isActive) {
      setStep('alert');
      setProgress(0);
    }
  }, [isActive]);

  // Progress bar animation — 10 seconds total
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
        setTimeout(() => setStep('complete'), 400);
      } else {
        setProgress(current);
      }
    }, tickMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [step]);

  const handleDownload = useCallback(() => setStep('downloading'), []);

  const handleGo = useCallback(() => {
    dismissPopup();
    navigate('/');
  }, [dismissPopup, navigate]);

  if (!isActive) return null;

  /* -------- STEP 1: Update Alert -------- */
  if (step === 'alert') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-lg animate-in fade-in duration-300">
        <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-zinc-900/95 to-black/95 shadow-2xl shadow-cyan-900/20 p-8 text-center space-y-5 animate-in zoom-in-95 duration-300">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-cyan-500/15 flex items-center justify-center">
            <span className="text-3xl">🔥</span>
          </div>

          <h2 className="text-xl font-bold text-white">Update Available</h2>
          <p className="text-sm text-zinc-400">New features and improvements are ready to install.</p>

          {/* Changes list */}
          <div className="space-y-1.5 text-left max-h-[30vh] overflow-y-auto pr-1">
            {[
              { icon: '📡', title: 'Smart Casting', desc: 'AirPlay & Chromecast support for seamless TV playback' },
              { icon: '🎞️', title: 'X-PLUS Server', desc: 'Flat cinema controls with a cleaner fullscreen player' },
              { icon: '📝', title: 'CC & E-Sub Fix', desc: 'Uploaded subtitles now toggle properly, even with multi-audio' },
              { icon: '🔁', title: 'Server Retry', desc: 'Tap the same server again to reload without leaving the page' },
              { icon: '📦', title: 'Detailed Progress', desc: 'Pending Upload, Crunchy & MuseIN now explain what is being prepared' },
              { icon: '🍎', title: 'Smaller iOS Controls', desc: 'Playback controls are more compact on iPhone & iPad' },
              { icon: '✨', title: 'No Auto Switching', desc: 'Your selected server stays selected until you change it' },
              { icon: '📊', title: 'Enhanced Reports', desc: '9 category chips with automatic device metadata' },
            ].map((item) => (
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
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-900/30"
          >
            Download
          </button>
        </div>
      </div>
    );
  }

  /* -------- STEP 2: Downloading -------- */
  if (step === 'downloading') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-xl">
        <div className="w-full max-w-md mx-4 text-center space-y-8">
          {/* Glow pulse */}
          <div className="mx-auto w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center animate-pulse">
            <span className="text-4xl">⬇️</span>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-1">Downloading Update…</h2>
            <p className="text-sm text-zinc-500">Please wait, this will only take a moment.</p>
          </div>

          {/* Progress bar */}
          <div className="space-y-3">
            <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-100 ease-linear shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-lg font-mono font-bold text-cyan-400">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    );
  }

  /* -------- STEP 3: Complete -------- */
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-lg animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-green-500/30 bg-gradient-to-b from-zinc-900/95 to-black/95 shadow-2xl shadow-green-900/20 p-8 text-center space-y-5 animate-in zoom-in-95 duration-300">
        <div className="mx-auto w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
          <span className="text-3xl">✅</span>
        </div>

        <h2 className="text-xl font-bold text-white">Updated to latest version</h2>
        <p className="text-sm text-zinc-400">Your app is now fully up to date.</p>

        <button
          onClick={handleGo}
          className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 transition-all shadow-lg shadow-green-900/30"
        >
          GO
        </button>
      </div>
    </div>
  );
}
