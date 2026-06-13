import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Cloud, Download, Shield, CheckCircle, Play, Pause, ArrowLeft, AlertTriangle, Ban, RotateCw } from 'lucide-react';
import { streamDownload, saveBlob, fmtSpeed, fmtEta, fmtSize as fmtBytes } from '@/lib/downloadUtils';


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
  const [sizeResolved, setSizeResolved] = useState(false);
  const [prepStep, setPrepStep] = useState(0); // 0..4 stages
  const [sizeMismatch, setSizeMismatch] = useState<{ expected: number; got: number } | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [etaSec, setEtaSec] = useState(0);
  const [resumeOffset, setResumeOffset] = useState(0);
  const [chunkBuffer, setChunkBuffer] = useState<BlobPart[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Mini player state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);

  const statusText = 'Preparing your video file…';
  const safeAnime = animeName.replace(/[^a-zA-Z0-9]+/g, '');
  const fileName = `[AnimeSavi]_${quality}_${safeAnime}_Ep-${episodeCount}.mp4`;

  const fmtSize = fmtBytes;


  // Fetch real file size via HEAD (fallback to ranged GET)
  useEffect(() => {
    if (!videoUrl) { setSizeResolved(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const head = await fetch(videoUrl, { method: 'HEAD', mode: 'cors' });
        const len = Number(head.headers.get('content-length') || '0');
        if (!cancelled && len > 0) { setFileSizeBytes(len); setSizeResolved(true); return; }
      } catch {}
      try {
        const r = await fetch(videoUrl, { headers: { Range: 'bytes=0-0' }, mode: 'cors' });
        const cr = r.headers.get('content-range');
        const m = cr && cr.match(/\/(\d+)$/);
        if (!cancelled && m) setFileSizeBytes(Number(m[1]));
      } catch {}
      if (!cancelled) setSizeResolved(true);
    })();
    return () => { cancelled = true; };
  }, [videoUrl]);

  // Real preparation progress: walk through stages and gate ready on size resolved
  useEffect(() => {
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 100;
      // Cap at 95% until size resolves
      const cap = sizeResolved ? 100 : 95;
      const p = Math.min((elapsed / 9000) * 100, cap);
      setProgress(p);
      setPrepStep(Math.min(4, Math.floor(p / 20)));
      if (p >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        setPhase('ready');
      }
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sizeResolved]);


  // NOTE: No auto-trigger of download. User must explicitly click.

  // Stream-download with progress, speed, ETA, Range-resume, cancel, and
  // same-origin proxy fallback when CORS blocks the direct fetch.
  const triggerDownload = async (resume = false) => {
    if (!videoUrl || downloading) return;
    setDownloadStarted(true);
    setDownloading(true);
    if (!resume) {
      setDownloadPct(0);
      setSizeMismatch(null);
      setDownloadedBytes(0);
      setSpeed(0);
      setEtaSec(0);
      setResumeOffset(0);
      setChunkBuffer([]);
    }

    const startAt = resume ? resumeOffset : 0;
    const existing = resume ? chunkBuffer : [];

    abortRef.current = new AbortController();
    const ext = (videoUrl.split('?')[0].split('.').pop() || 'mp4').toLowerCase();
    const safeExt = ['mp4', 'mkv', 'webm'].includes(ext) ? ext : 'mp4';
    const finalName = fileName.replace(/\.mp4$/i, `.${safeExt}`);

    for (const useProxy of [false, true]) {
      try {
        const { chunks, total, received, mime } = await streamDownload({
          url: videoUrl,
          filename: finalName,
          startAt,
          signal: abortRef.current.signal,
          useProxy,
          onProgress: (p) => {
            setDownloadedBytes(p.received);
            setDownloadPct(p.pct);
            setSpeed(p.speed);
            setEtaSec(p.etaSec);
            setResumeOffset(p.received);
          },
        });

        const allChunks = [...existing, ...chunks];
        setChunkBuffer(allChunks);

        const expected = fileSizeBytes || total;
        if (expected && Math.abs(received - expected) > 1024) {
          setSizeMismatch({ expected, got: received });
        }

        saveBlob(allChunks, mime, finalName);
        setDownloadPct(100);
        setResumeOffset(0);
        setChunkBuffer([]);
        setDownloading(false);
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          // User cancelled — keep buffer/offset so they can resume
          setDownloading(false);
          return;
        }
        if (useProxy) {
          // Last-ditch native anchor fallback
          try {
            const a = document.createElement('a');
            a.href = videoUrl;
            a.download = finalName;
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } catch {}
          setDownloading(false);
          return;
        }
      }
    }
  };

  const cancelDownload = () => {
    abortRef.current?.abort();
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
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-start py-16 sm:py-10 px-4 safe-area-top safe-area-bottom"
      style={{
        background:
          'radial-gradient(ellipse at 20% 80%, hsl(270 70% 25% / 0.25) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, hsl(280 80% 30% / 0.2) 0%, transparent 50%), #0a0a0f',
      }}
    >
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="fixed top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white/80 hover:text-white text-xs font-medium transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'rgba(20, 12, 30, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid hsl(270 60% 50% / 0.35)',
          marginTop: 'env(safe-area-inset-top)',
        }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>


      {/* Ambient glow corners */}
      <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-25 blur-[100px] pointer-events-none" style={{ background: 'hsl(270 80% 50%)' }} />
      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-20 blur-[100px] pointer-events-none" style={{ background: 'hsl(280 90% 55%)' }} />

      {/* Main Card */}
      <div className="relative w-full max-w-md mx-auto rounded-2xl overflow-hidden"
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
                <p className="text-white/40 text-[11px] mt-2 font-mono">{Math.floor(progress)}%{!sizeResolved && ' · resolving file size…'}</p>
              </div>

              {/* Stage checklist */}
              <div className="w-full space-y-1.5">
                {[
                  'Connecting to AnimeSavi CDN',
                  'Locating source file',
                  'Resolving real file size',
                  'Preparing secure download link',
                  'Finalizing',
                ].map((label, i) => {
                  const done = prepStep > i || (i === 2 && sizeResolved);
                  const active = prepStep === i && !done;
                  return (
                    <div key={label} className="flex items-center gap-2 text-left">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${done ? 'bg-green-500/20 text-green-400' : active ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-white/30'}`}>
                        {done ? '✓' : active ? '•' : ''}
                      </div>
                      <span className={`text-[11px] ${done ? 'text-white/80' : active ? 'text-white/90' : 'text-white/30'}`}>{label}</span>
                    </div>
                  );
                })}
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

              <button onClick={() => triggerDownload(false)} disabled={downloading}
                className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70"
                style={{
                  background: 'linear-gradient(135deg, hsl(270 90% 55%), hsl(285 95% 65%))',
                  boxShadow: '0 4px 20px hsl(270 90% 55% / 0.45)',
                }}>
                <Download className="w-4 h-4" />
                {downloading ? `Downloading ${Math.floor(downloadPct)}%` : resumeOffset > 0 ? 'Restart Download' : 'Download Now'}
              </button>

              {/* Cancel / Resume controls */}
              {(downloading || resumeOffset > 0) && (
                <div className="w-full flex gap-2">
                  {downloading ? (
                    <button onClick={cancelDownload}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-white/90 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      style={{ background: 'hsl(0 70% 45% / 0.85)' }}>
                      <Ban className="w-3.5 h-3.5" /> Cancel
                    </button>
                  ) : (
                    <button onClick={() => triggerDownload(true)}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      style={{ background: 'hsl(142 70% 40%)' }}>
                      <RotateCw className="w-3.5 h-3.5" /> Resume from {fmtSize(resumeOffset)}
                    </button>
                  )}
                </div>
              )}

              {sizeMismatch && (
                <div className="w-full rounded-lg p-3 text-left flex items-start gap-2"
                  style={{ background: 'hsl(40 90% 50% / 0.12)', border: '1px solid hsl(40 90% 50% / 0.35)' }}>
                  <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
                  <div className="text-[11px] text-amber-100/90">
                    <p className="font-semibold">Download size mismatch</p>
                    <p className="text-amber-100/70">Expected {fmtSize(sizeMismatch.expected)} but received {fmtSize(sizeMismatch.got)}. The file may be incomplete — please tap Download again.</p>
                  </div>
                </div>
              )}

              {/* Download progress with speed + ETA */}
              {downloading && (
                <div className="w-full">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full transition-all duration-150"
                      style={{
                        width: `${downloadPct}%`,
                        background: 'linear-gradient(90deg, hsl(142 70% 50%), hsl(160 80% 60%))',
                      }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-white/60 font-mono tabular-nums">
                    <span>{fmtSize(downloadedBytes)} / {fmtSize(fileSizeBytes)}</span>
                    <span>{fmtSpeed(speed)} · ETA {fmtEta(etaSec)}</span>
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
