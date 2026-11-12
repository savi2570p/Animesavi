import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Download, Shield, Check, Play, Pause, ArrowLeft, AlertTriangle, Ban, RotateCw, FileVideo } from 'lucide-react';
import logo from '@/assets/logo.png';
import { streamDownload, saveBlob, fmtSpeed, fmtEta, fmtSize as fmtBytes } from '@/lib/downloadUtils';
import { readDownloadSize } from '@/lib/downloadMetadata';


export default function ShadowArise() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const quality = searchParams.get('quality') || '1080p';
  const animeName = searchParams.get('anime') || 'Unknown';
  const episodeCount = searchParams.get('ep') || '01';
  const videoUrl = searchParams.get('url') || '';
  const audioIndex = searchParams.get('audio');
  const audioLang = searchParams.get('audioLang') || '';

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
  const safeLang = audioLang ? `_${audioLang.toUpperCase()}` : '';
  const fileName = `[AnimeSavi]_${quality}_${safeAnime}_Ep-${episodeCount}${safeLang}.mp4`;

  const fmtSize = fmtBytes;


  // Fetch real file size via HEAD (fallback to ranged GET)
  useEffect(() => {
    if (!videoUrl) { setSizeResolved(true); return; }
    const controller = new AbortController();
    setSizeResolved(false);
    readDownloadSize(videoUrl, controller.signal).then((size) => {
      if (controller.signal.aborted) return;
      setFileSizeBytes(size);
      setSizeResolved(true);
    });
    return () => controller.abort();
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

  const stages = [
    'Connecting to AnimeSavi CDN',
    'Locating source file',
    'Resolving real file size',
    'Preparing secure download link',
    'Finalizing',
  ];
  const ringPct = phase === 'ready' ? (downloading ? downloadPct : 100) : progress;
  const RING = 2 * Math.PI * 44;

  return (
    <div className="sa-v2 safe-area-top safe-area-bottom">
      <header className="sa-v2-top">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="sa-v2-back">
          <ArrowLeft className="w-4 h-4" aria-hidden />
          <span>Back</span>
        </button>
        <div className="sa-v2-brand">
          <img src={logo} alt="" width={28} height={28} />
          <span>AnimeSavi<b>+</b></span>
        </div>
        <span className="w-[68px]" aria-hidden />
      </header>

      <main className="sa-v2-card">
        <div className="sa-v2-hero">
          <div className={`sa-v2-ring ${phase === 'ready' && !downloading ? 'is-done' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(ringPct)} aria-label={phase === 'ready' ? 'Download progress' : 'Preparation progress'}>
            <svg viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r="44" className="sa-v2-ring-track" />
              <circle cx="50" cy="50" r="44" className="sa-v2-ring-bar" strokeDasharray={RING} strokeDashoffset={RING - (ringPct / 100) * RING} />
            </svg>
            <div className="sa-v2-ring-center">
              {phase === 'ready' && !downloading ? (
                <Check className="w-8 h-8" aria-hidden />
              ) : (
                <span className="sa-v2-pct">{Math.floor(ringPct)}<small>%</small></span>
              )}
            </div>
          </div>

          {phase === 'processing' ? (
            <div className="text-center">
              <p className="sa-v2-eyebrow">Step {Math.min(prepStep + 1, 5)} of 5</p>
              <h1 className="sa-v2-title">{statusText}</h1>
              <p className="sa-v2-sub">
                Your secure link is being prepared. About {Math.max(0, Math.ceil((100 - progress) / 10))}s left
                {!sizeResolved && ' · resolving file size…'}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="sa-v2-eyebrow">Ready to save</p>
              <h1 className="sa-v2-title">
                {downloading ? `Downloading… ${Math.floor(downloadPct)}%` : 'Your file is ready'}
              </h1>
              <p className="sa-v2-sub">
                {downloading
                  ? `${fmtSize(downloadedBytes)} of ${fmtSize(fileSizeBytes)} · ${fmtSpeed(speed)} · ETA ${fmtEta(etaSec)}`
                  : downloadStarted
                    ? 'Download started. Tap again to download another copy.'
                    : 'Tap the button below to start your download.'}
              </p>
            </div>
          )}
        </div>

        {phase === 'processing' ? (
          <ol className="sa-v2-steps" aria-label="Preparation steps">
            {stages.map((label, i) => {
              const done = prepStep > i || (i === 2 && sizeResolved);
              const active = prepStep === i && !done;
              return (
                <li key={label} className={`sa-v2-step ${done ? 'is-done' : active ? 'is-active' : ''}`}>
                  <span className="sa-v2-dot" aria-hidden>{done ? <Check className="w-3 h-3" /> : i + 1}</span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="sa-v2-actions">
            <button type="button" onClick={() => triggerDownload(false)} disabled={downloading} className="sa-v2-primary">
              <Download className="w-4 h-4" aria-hidden />
              {downloading ? `Downloading ${Math.floor(downloadPct)}%` : resumeOffset > 0 ? 'Restart Download' : 'Download Now'}
            </button>

            {downloading && (
              <div className="sa-v2-bar" aria-hidden><span style={{ width: `${downloadPct}%` }} /></div>
            )}

            {(downloading || resumeOffset > 0) && (
              downloading ? (
                <button type="button" onClick={cancelDownload} className="sa-v2-secondary is-danger">
                  <Ban className="w-3.5 h-3.5" aria-hidden /> Cancel
                </button>
              ) : (
                <button type="button" onClick={() => triggerDownload(true)} className="sa-v2-secondary">
                  <RotateCw className="w-3.5 h-3.5" aria-hidden /> Resume from {fmtSize(resumeOffset)}
                </button>
              )
            )}

            {sizeMismatch && (
              <div className="sa-v2-warn" role="alert">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">Download size mismatch</p>
                  <p>Expected {fmtSize(sizeMismatch.expected)} but received {fmtSize(sizeMismatch.got)}. The file may be incomplete — please tap Download again.</p>
                </div>
              </div>
            )}

            {videoUrl && (
              <div className="sa-v2-preview">
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
                  onLoadedMetadata={(e) => {
                    setDur(e.currentTarget.duration || 0);
                    // Enable only the audio language the user picked for download
                    const tracks = (e.currentTarget as any).audioTracks;
                    if (tracks && tracks.length > 1 && audioIndex !== null) {
                      const idx = Math.min(Number(audioIndex), tracks.length - 1);
                      for (let i = 0; i < tracks.length; i++) tracks[i].enabled = i === idx;
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  onDoubleClick={(e) => e.preventDefault()}
                />
                <div className="sa-v2-controls">
                  <button type="button" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} className="sa-v2-play">
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={dur ? (curTime / dur) * 100 : 0}
                    onChange={onSeek}
                    aria-label="Preview position"
                    className="sa-v2-range"
                  />
                  <span className="sa-v2-time">{fmt(curTime)} / {fmt(dur)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="sa-v2-file">
          <span className="sa-v2-file-icon" aria-hidden><FileVideo className="w-4 h-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="sa-v2-file-label">File name</p>
            <p className="sa-v2-file-name">{fileName}</p>
            <div className="sa-v2-file-meta">
              <span className="sa-v2-badge">{quality}</span>
              <span>x264 WEB-DL</span>
              {audioLang && <span>{audioLang.toUpperCase()} audio</span>}
              <span className="ml-auto font-mono tabular-nums">{fmtSize(fileSizeBytes)}</span>
            </div>
          </div>
        </div>

        <p className="sa-v2-foot"><Shield className="w-3 h-3" aria-hidden /> Protected by AnimeSavi Cloud</p>
      </main>
    </div>
  );
}
