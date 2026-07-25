import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Maximize, Minimize, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSecureStreamUrl } from '@/lib/antiPiracy';

interface FloxPlayerProps {
  sourceType: 'embed' | 'file';
  sourceUrl: string;
  poster?: string;
  title?: string;
}

const NATIVE_EXTS = new Set(['mp4', 'm4v', 'webm', 'mov', 'ogg', 'ogv']);
const MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', ogg: 'video/ogg', ogv: 'video/ogg',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo',
};
function extOf(url: string): string {
  try {
    const p = new URL(url, window.location.href).pathname;
    return (p.split('.').pop() || '').toLowerCase();
  } catch {
    return (url.split('?')[0].split('.').pop() || '').toLowerCase();
  }
}

/**
 * Flox liquid-glass player — iOS aesthetic.
 * Controls: -10s · Play/Pause · +10s · Glass Timeline · Fullscreen
 */
export function FloxPlayer({ sourceType, sourceUrl, poster, title }: FloxPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);

  const fileExt = useMemo(() => (sourceType === 'file' ? extOf(sourceUrl) : ''), [sourceType, sourceUrl]);
  const sourceMime = useMemo(() => MIME_MAP[fileExt] || 'video/mp4', [fileExt]);
  const isNativeContainer = sourceType !== 'file' || !fileExt || NATIVE_EXTS.has(fileExt);

  useEffect(() => {
    const sync = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const block = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', block);
    return () => el.removeEventListener('contextmenu', block);
  }, []);

  const bumpControls = () => {
    setShowControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (playing) setShowControls(false);
    }, 2600);
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${r}`;
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const skip = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min((v.duration || 0), v.currentTime + delta));
    bumpControls();
  };

  const toggleFs = async () => {
    const el = containerRef.current;
    const v = videoRef.current;
    if (!el) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
    if (isIOS && v && (v as any).webkitEnterFullscreen) {
      try { (v as any).webkitEnterFullscreen(); } catch {}
      return;
    }
    if (!document.fullscreenElement) await el.requestFullscreen?.();
    else await document.exitFullscreen?.();
  };

  if (sourceType === 'embed') {
    return (
      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden select-none player-shell ring-1 ring-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
      >
        <iframe
          src={sourceUrl}
          title={title || 'Flox Embed'}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; accelerometer; gyroscope"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }

  const secureUrl = getSecureStreamUrl(sourceUrl);

  if (!isNativeContainer || videoError) {
    return (
      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden select-none flex items-center justify-center player-shell ring-1 ring-white/10"
      >
        <div className="flox-glass rounded-2xl text-center px-6 py-7 max-w-md space-y-3 mx-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/15 border border-amber-400/40 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-amber-300" />
          </div>
          <h3 className="text-white text-base font-semibold">
            {videoError ? 'This video failed to load in the player' : 'Format not supported by browser'}
          </h3>
          <p className="text-white/70 text-xs leading-relaxed">
            {fileExt
              ? `The uploaded file (.${fileExt}) can't play natively. Open it directly or re-upload as MP4/WebM.`
              : 'The uploaded file could not be decoded. Try opening it directly or re-upload as MP4/WebM.'}
          </p>
          <a
            href={secureUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full flox-glass-chip text-white text-xs font-medium"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open video
          </a>
        </div>
      </div>
    );
  }

  const progressPct = duration ? (time / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={bumpControls}
      onTouchStart={bumpControls}
      className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden select-none group player-shell ring-1 ring-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={poster}
        playsInline
        autoPlay
        preload="auto"
        crossOrigin="anonymous"
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onPlay={() => { setPlaying(true); bumpControls(); }}
        onPause={() => { setPlaying(false); setShowControls(true); }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          const v = e.currentTarget;
          v.play().catch(() => {
            v.muted = true;
            v.play().catch(() => {});
          });
        }}
        onError={() => setVideoError('playback_failed')}
        onClick={togglePlay}
      >
        <source src={secureUrl} type={sourceMime} />
        <source src={secureUrl} />
      </video>

      {/* Center play tap-target when paused */}
      {!playing && (
        <button
          aria-label="Play"
          onClick={togglePlay}
          className="absolute inset-0 grid place-items-center bg-black/20"
        >
          <span className="flox-glass-strong h-20 w-20 rounded-full grid place-items-center text-white shadow-2xl">
            <Play className="h-9 w-9 fill-current translate-x-0.5" />
          </span>
        </button>
      )}

      {/* Top gradient */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      />
      {title && (
        <div
          className={cn(
            'absolute top-3 left-3 right-3 flex items-center transition-opacity duration-300',
            showControls ? 'opacity-100' : 'opacity-0'
          )}
        >
          <span className="text-white/90 text-xs md:text-sm font-medium drop-shadow line-clamp-1">{title}</span>
        </div>
      )}

      {/* Bottom liquid-glass control dock */}
      <div
        className={cn(
          'absolute inset-x-3 bottom-3 transition-all duration-300',
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
        )}
      >
        <div className="flox-glass rounded-2xl px-3 py-2 flex items-center gap-2 md:gap-3">
          <button
            aria-label="Back 10 seconds"
            onClick={() => skip(-10)}
            className="h-9 w-9 grid place-items-center rounded-full text-white/90 hover:bg-white/10 transition"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <button
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={togglePlay}
            className="h-10 w-10 grid place-items-center rounded-full bg-white text-black hover:scale-105 transition shadow-lg"
          >
            {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current translate-x-[1px]" />}
          </button>
          <button
            aria-label="Forward 10 seconds"
            onClick={() => skip(10)}
            className="h-9 w-9 grid place-items-center rounded-full text-white/90 hover:bg-white/10 transition"
          >
            <RotateCw className="h-5 w-5" />
          </button>

          <div className="flex-1 flex items-center gap-2 px-1">
            <span className="text-[11px] tabular-nums text-white/80 w-10">{fmt(time)}</span>
            <div className="relative flex-1 h-6 flex items-center">
              <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/15" />
              <div
                className="absolute h-[3px] rounded-full bg-gradient-to-r from-primary to-red-400 shadow-[0_0_8px_hsl(0_85%_55%/0.6)]"
                style={{ width: `${progressPct}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={time}
                onChange={(e) => {
                  const v = videoRef.current;
                  if (v) v.currentTime = Number(e.target.value);
                }}
                aria-label="Seek"
                className={cn(
                  'relative w-full h-6 appearance-none bg-transparent cursor-pointer',
                  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
                  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
                  '[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_hsl(0_85%_55%/0.35)]',
                  '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0'
                )}
              />
            </div>
            <span className="text-[11px] tabular-nums text-white/80 w-10 text-right">{fmt(duration)}</span>
          </div>

          <button
            aria-label="Fullscreen"
            onClick={toggleFs}
            className="h-9 w-9 grid place-items-center rounded-full text-white/90 hover:bg-white/10 transition"
          >
            {isFs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
