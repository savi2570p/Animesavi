import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Cloud, Download, Shield, CheckCircle, Play, Pause, ArrowLeft, AlertTriangle } from 'lucide-react';

export default function ShadowArise() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const quality = searchParams.get('quality') || '1080p';
  const animeName = searchParams.get('anime') || 'Unknown';
  const episodeCount = searchParams.get('ep') || '01';
  const videoUrl = searchParams.get('url') || '';

  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'processing' | 'ready'>('processing');
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadPct, setDownloadPct] = useState(0);
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Mini player state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);

  const statusText = quality === '720p' ? 'Converting to HD…' : 'Preparing Raw Video…';
  const safeAnime = animeName.replace(/[^a-zA-Z0-9]+/g, '');
  const fileName = `[AnimeSavi]_${quality}_${safeAnime}_Ep-${episodeCount}.mp4`;

  const fmtSize = (b: number | null) => {
    if (!b || b <= 0) return '—';
    if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
    if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
    return `${(b / 1024).toFixed(0)} KB`;
  };

  // Fetch real file size via HEAD (fallback to ranged GET)
  useEffect(() => {
    if (!videoUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const head = await fetch(videoUrl, { method: 'HEAD', mode: 'cors' });
        const len = Number(head.headers.get('content-length') || '0');
        if (!cancelled && len > 0) { setFileSizeBytes(len); return; }
      } catch {}
      try {
        const r = await fetch(videoUrl, { headers: { Range: 'bytes=0-0' }, mode: 'cors' });
        const cr = r.headers.get('content-range'); // bytes 0-0/12345
        const m = cr && cr.match(/\/(\d+)$/);
        if (!cancelled && m) setFileSizeBytes(Number(m[1]));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [videoUrl]);

  // Processing simulation (10s) — completes when both timer done AND size resolved (best-effort)
  useEffect(() => {
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 100;
      const p = Math.min((elapsed / 10000) * 100, 100);
      setProgress(p);
      if (p >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        setPhase('ready');
      }
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);


  // NOTE: No auto-trigger of download. User must explicitly click.

  // Force a real file download via blob (so the OS treats it as a download,
  // not a navigation to the default video player). Falls back to anchor for
  // huge files / range-restricted CDNs.
  const triggerDownload = async () => {
    if (!videoUrl || downloading) return;
    setDownloadStarted(true);
    setDownloading(true);
    setDownloadPct(0);

    try {
      const res = await fetch(videoUrl, { mode: 'cors', credentials: 'omit' });
      if (!res.ok || !res.body) throw new Error('fetch failed');

      const total = Number(res.headers.get('content-length') || '0');
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total > 0) setDownloadPct(Math.min(99, (received / total) * 100));
        }
      }

      const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadPct(100);
    } catch {
      // Fallback when CORS blocks fetch: use a hidden iframe to trigger
      // the download without navigating the current tab. This prevents
      // the OS default video player (Windows Media / QuickTime) from opening.
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = videoUrl;
        document.body.appendChild(iframe);
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch {}
        }, 60000);
      } catch {
        // Last resort: anchor with download attribute (no new tab).
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = fileName;
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } finally {
      setDownloading(false);
    }
  };

  // Mini player handlers
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v || !dur) return;
    const t = (Number(e.target.value) / 100) * dur;
    v.currentTime = t;
    setCurTime(t);
  };

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto py-6"
      style={{
        background:
          'radial-gradient(ellipse at 20% 80%, hsl(270 70% 25% / 0.25) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, hsl(280 80% 30% / 0.2) 0%, transparent 50%), #0a0a0f',
      }}>

      {/* Ambient glow corners */}
      <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-25 blur-[100px] pointer-events-none" style={{ background: 'hsl(270 80% 50%)' }} />
      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-20 blur-[100px] pointer-events-none" style={{ background: 'hsl(280 90% 55%)' }} />

      {/* Main Card */}
      <div className="relative w-[90vw] max-w-md mx-4 rounded-2xl overflow-hidden my-auto"
        style={{
          background: 'rgba(15, 8, 25, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid hsl(270 60% 50% / 0.3)',
          boxShadow: '0 0 40px hsl(270 80% 50% / 0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>

        <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-5">
          {/* Logo */}
          <h1 className="text-xl sm:text-2xl font-black tracking-wider"
            style={{ color: '#fff', textShadow: '0 0 20px hsl(270 90% 55% / 0.5)' }}>
            ANIME <span style={{ color: 'hsl(270 90% 65%)' }}>SAVI</span>
          </h1>

          {/* Icon */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: phase === 'ready' ? 'hsl(142 70% 45% / 0.15)' : 'hsl(270 80% 55% / 0.12)',
                boxShadow: phase === 'ready' ? '0 0 30px hsl(142 70% 45% / 0.25)' : '0 0 30px hsl(270 80% 55% / 0.25)',
              }}>
              {phase === 'ready' ? (
                <CheckCircle className="w-8 h-8 text-green-400" />
              ) : (
                <Cloud className="w-8 h-8 animate-pulse" style={{ color: 'hsl(270 90% 65%)' }} />
              )}
            </div>
          </div>

          {/* Status */}
          {phase === 'processing' ? (
            <>
              <div>
                <p className="text-white font-semibold text-base">{statusText}</p>
                <p className="text-white/50 text-xs mt-1">
                  Your high-speed secure link is being prepared. Please wait {Math.ceil((100 - progress) / 10)}s.
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all duration-100 ease-linear"
                    style={{
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, hsl(270 90% 60%), hsl(285 95% 70%))',
                      boxShadow: '0 0 12px hsl(270 90% 55% / 0.6)',
                    }} />
                </div>
                <p className="text-white/40 text-[11px] mt-2 font-mono">{Math.floor(progress)}%</p>
              </div>

              {/* File info */}
              <div className="w-full rounded-lg p-3 text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">File Name</p>
                <p className="text-white/70 text-xs font-mono break-all">{fileName}</p>
                <div className="flex gap-3 mt-2 items-center flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: 'hsl(270 80% 55% / 0.2)', color: 'hsl(270 90% 75%)' }}>{quality}</span>
                  <span className="text-[10px] text-white/40">x264 WEB-DL</span>
                  <span className="text-[10px] text-white/60 ml-auto font-mono">{fmtSize(fileSizeBytes)}</span>
                </div>
              </div>

            </>
          ) : (
            <>
              <div>
                <p className="text-green-400 font-bold text-lg">Ready</p>
                <p className="text-white/50 text-xs mt-1">
                  {downloading
                    ? `Downloading… ${Math.floor(downloadPct)}%`
                    : downloadStarted
                      ? 'Download started. Tap to download again.'
                      : 'Tap below to start your download.'}
                </p>
              </div>

              <button onClick={triggerDownload} disabled={downloading}
                className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70"
                style={{
                  background: 'linear-gradient(135deg, hsl(270 90% 55%), hsl(285 95% 65%))',
                  boxShadow: '0 4px 20px hsl(270 90% 55% / 0.45)',
                }}>
                <Download className="w-4 h-4" />
                {downloading ? `Downloading ${Math.floor(downloadPct)}%` : 'Download Now'}
              </button>

              {/* Download progress (only while downloading) */}
              {downloading && (
                <div className="w-full">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full transition-all duration-150"
                      style={{
                        width: `${downloadPct}%`,
                        background: 'linear-gradient(90deg, hsl(142 70% 50%), hsl(160 80% 60%))',
                      }} />
                  </div>
                </div>
              )}

              {/* Custom mini video player — play/pause + timeline only (no fullscreen) */}
              {videoUrl && (
                <div className="w-full rounded-xl overflow-hidden"
                  style={{ background: '#000', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    playsInline
                    preload="metadata"
                    controlsList="nodownload nofullscreen noremoteplayback"
                    disablePictureInPicture
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => setCurTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
                    onContextMenu={(e) => e.preventDefault()}
                    onDoubleClick={(e) => e.preventDefault()}
                    style={{ width: '100%', display: 'block', maxHeight: 220, background: '#000', pointerEvents: 'none' }}
                  />

                  {/* Custom controls bar */}
                  <div className="flex items-center gap-3 px-3 py-2"
                    style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <button onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform active:scale-90"
                      style={{ background: 'hsl(270 80% 55%)' }}>
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.1}
                      value={dur ? (curTime / dur) * 100 : 0}
                      onChange={onSeek}
                      className="flex-1 accent-purple-500"
                      style={{ height: 4 }}
                    />

                    <span className="text-[10px] text-white/70 font-mono tabular-nums whitespace-nowrap">
                      {fmt(curTime)} / {fmt(dur)}
                    </span>
                  </div>
                </div>
              )}

              <div className="w-full rounded-lg p-3 text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white/30 text-[10px] uppercase tracking-wider">File</p>
                  <p className="text-white/60 text-[10px] font-mono">{fmtSize(fileSizeBytes)}</p>
                </div>
                <p className="text-white/70 text-xs font-mono break-all">{fileName}</p>
              </div>

            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-4 flex items-center justify-center gap-1.5">
          <Shield className="w-3 h-3 text-white/20" />
          <p className="text-white/20 text-[10px] tracking-wider">PROTECTED BY ANIMESAVI CLOUD</p>
        </div>
      </div>
    </div>
  );
}
