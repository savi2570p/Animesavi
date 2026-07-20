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

// Browsers reliably play these containers natively.
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
 * Ultra-minimal flat player for Flox Anime India + content.
 * Controls: -10s · Play/Pause · +10s · Timeline · Fullscreen
 * No download, no quality menu, no audio menu, no share.
 */
export function FloxPlayer({ sourceType, sourceUrl, poster, title }: FloxPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Format detection — files uploaded from mobile file managers are often
  // MKV/AVI/etc which browsers cannot play natively. Detect up-front so we
  // can either warn or route to the iframe fallback instead of showing a
  // black screen.
  const fileExt = useMemo(() => (sourceType === 'file' ? extOf(sourceUrl) : ''), [sourceType, sourceUrl]);
  const sourceMime = useMemo(() => MIME_MAP[fileExt] || 'video/mp4', [fileExt]);
  const isNativeContainer = sourceType !== 'file' || !fileExt || NATIVE_EXTS.has(fileExt);

  // Fullscreen sync
  useEffect(() => {
    const sync = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  // Block long-press context on the container (mobile)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const block = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', block);
    return () => el.removeEventListener('contextmenu', block);
  }, []);

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
  };

  const toggleFs = async () => {
    const el = containerRef.current;
    const v = videoRef.current;
    if (!el) return;
    // iOS Safari: use native fullscreen on the video element (no custom controls)
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
        className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden select-none player-shell"
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

  // Unsupported container (mkv/avi/ts/wmv/…): don't blank-screen the user.
  // Show a clean fallback with a direct-open link. The upstream file was
  // uploaded via file-manager but browsers can't decode it inline.
  if (!isNativeContainer || videoError) {
    return (
      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden select-none flex items-center justify-center player-shell"
      >
        <div className="text-center px-6 py-8 max-w-md space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/15 border border-amber-400/40 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-amber-300" />
          </div>
          <h3 className="text-white text-base font-semibold">
            {videoError ? 'This video failed to load in the player' : 'Format not supported by browser'}
          </h3>
          <p className="text-white/70 text-xs leading-relaxed">
            {fileExt
              ? `The uploaded file (.${fileExt}) can't play natively in the browser. Open it directly or re-upload as MP4/WebM for inline playback.`
              : 'The uploaded file could not be decoded. Try opening it directly or re-upload as MP4/WebM.'}
          </p>
          <a
            href={secureUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-medium transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open video
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden select-none group"
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={poster}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onError={() => setVideoError('playback_failed')}
        onClick={togglePlay}
      >
        <source src={secureUrl} type={sourceMime} />
        {/* Also provide the URL without type so browsers can sniff */}
        <source src={secureUrl} />
      </video>

      {/* Flat controls bar */}
      <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-black/60 backdrop-blur-sm flex items-center gap-3">
        <button
          aria-label="Back 10 seconds"
          onClick={() => skip(-10)}
          className="text-white/90 hover:text-white"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <button
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={togglePlay}
          className="text-white"
        >
          {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </button>
        <button
          aria-label="Forward 10 seconds"
          onClick={() => skip(10)}
          className="text-white/90 hover:text-white"
        >
          <RotateCw className="h-5 w-5" />
        </button>

        <div className="flex-1 flex items-center gap-2">
          <span className="text-[11px] tabular-nums text-white/80 w-10">{fmt(time)}</span>
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
            className={cn(
              'flex-1 appearance-none h-[2px] bg-white/20 rounded-full',
              '[&::-webkit-slider-thumb]:appearance-none',
              '[&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3',
              '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
            )}
            style={{
              background: `linear-gradient(to right, hsl(0 85% 55%) ${(time / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(time / (duration || 1)) * 100}%)`,
            }}
          />
          <span className="text-[11px] tabular-nums text-white/80 w-10 text-right">{fmt(duration)}</span>
        </div>

        <button
          aria-label="Fullscreen"
          onClick={toggleFs}
          className="text-white/90 hover:text-white"
        >
          {isFs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
