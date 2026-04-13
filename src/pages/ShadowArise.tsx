import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Cloud, Download, Shield, CheckCircle } from 'lucide-react';

export default function ShadowArise() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const quality = searchParams.get('quality') || '1080p';
  const animeName = searchParams.get('anime') || 'Unknown';
  const episodeCount = searchParams.get('ep') || '01';
  const videoUrl = searchParams.get('url') || '';

  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'processing' | 'ready'>('processing');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const statusText = quality === '720p' ? 'Converting to HD...' : 'Preparing Raw Video...';
  const fileName = `[Shadow-Toons]_${quality}_${animeName.replace(/\s+/g, '')}\_Ep-${episodeCount}.mp4`;

  useEffect(() => {
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 100;
      const p = Math.min((elapsed / 10000) * 100, 100);
      setProgress(p);
      if (p >= 100) {
        clearInterval(timerRef.current!);
        setPhase('ready');
      }
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (phase === 'ready' && videoUrl) {
      // Auto-trigger download
      triggerDownload();
    }
  }, [phase]);

  const triggerDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = fileName;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 20% 80%, rgba(139,0,0,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139,0,0,0.1) 0%, transparent 50%), #0a0a0a' }}>

      {/* Ambient glow corners */}
      <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-20 blur-[100px]" style={{ background: '#8b0000' }} />
      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-15 blur-[100px]" style={{ background: '#8b0000' }} />

      {/* Main Card */}
      <div className="relative w-[90vw] max-w-md mx-4 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(20, 5, 5, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(200, 30, 30, 0.3)',
          boxShadow: '0 0 40px rgba(139, 0, 0, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>

        <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-5">
          {/* Logo */}
          <h1 className="text-xl sm:text-2xl font-black tracking-wider"
            style={{ color: '#fff', textShadow: '0 0 20px rgba(229,9,20,0.4)' }}>
            SHADOW <span style={{ color: '#e50914' }}>TOONS</span>
          </h1>

          {/* Icon */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: phase === 'ready' ? 'rgba(34,197,94,0.15)' : 'rgba(229,9,20,0.1)',
                boxShadow: phase === 'ready' ? '0 0 30px rgba(34,197,94,0.2)' : '0 0 30px rgba(229,9,20,0.2)',
              }}>
              {phase === 'ready' ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <Cloud className="w-8 h-8 animate-pulse" style={{ color: '#e50914' }} />
              )}
            </div>
          </div>

          {/* Status */}
          {phase === 'processing' ? (
            <>
              <div>
                <p className="text-white font-semibold text-base">{statusText}</p>
                <p className="text-white/50 text-xs mt-1">
                  Your high-speed secure link is ready. Please wait {Math.ceil((100 - progress) / 10)}s for file preparation.
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div className="h-full rounded-full transition-all duration-100 ease-linear"
                    style={{
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #e50914, #ff4444)',
                      boxShadow: '0 0 12px rgba(229,9,20,0.5)',
                    }} />
                </div>
                <p className="text-white/40 text-[11px] mt-2 font-mono">{Math.floor(progress)}%</p>
              </div>

              {/* File info */}
              <div className="w-full rounded-lg p-3 text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">File Name</p>
                <p className="text-white/70 text-xs font-mono break-all">{fileName}</p>
                <div className="flex gap-3 mt-2">
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: 'rgba(229,9,20,0.2)', color: '#e50914' }}>{quality}</span>
                  <span className="text-[10px] text-white/40">x264 WEB-DL</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-green-400 font-bold text-lg">Link Generated!</p>
                <p className="text-white/50 text-xs mt-1">Your download should start automatically.</p>
              </div>

              <button onClick={triggerDownload}
                className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #e50914, #b20710)',
                  boxShadow: '0 4px 20px rgba(229,9,20,0.4)',
                }}>
                <Download className="w-4 h-4" />
                Download Now
              </button>

              <div className="w-full rounded-lg p-3 text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">File</p>
                <p className="text-white/70 text-xs font-mono break-all">{fileName}</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-4 flex items-center justify-center gap-1.5">
          <Shield className="w-3 h-3 text-white/20" />
          <p className="text-white/20 text-[10px] tracking-wider">PROTECTED BY SHADOW TOONS CLOUD</p>
        </div>
      </div>
    </div>
  );
}
