import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Maximize, Loader2, List } from 'lucide-react';
import { isHlsUrl, detectDeviceKind } from '@/lib/streamSource';
import { getHLSConfig } from '@/lib/videoUtils';

/**
 * Shadow link v2 minimal player — ONLY: timeline, play/pause, ±10s skip,
 * fullscreen. No branding, no settings menus, no extra overlays.
 */

interface ShadowMinimalPlayerProps {
  videoUrl: string | null;
  embedUrl?: string | null;
  poster?: string;
  /** Shown top-left only while controls are visible */
  overlayTitle?: string;
  overlaySeason?: number;
  overlayEpisode?: number;
  /** In-player episode picker (rendered inside the player, never outside). */
  episodes?: Array<{ key: string; number: number; seasonNumber?: number; active?: boolean }>;
  onSelectEpisode?: (key: string) => void;
}

function formatTime(t: number): string {
  if (!Number.isFinite(t) || t < 0) return '0:00';
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export function ShadowMinimalPlayer({
  videoUrl,
  embedUrl,
  poster,
  overlayTitle,
  overlaySeason,
  overlayEpisode,
  episodes,
  onSelectEpisode,
}: ShadowMinimalPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showEps, setShowEps] = useState(false);

  const hasEpisodes = !!episodes && episodes.length > 1 && !!onSelectEpisode;
  const epSeasons = Array.from(new Set((episodes || []).map((e) => e.seasonNumber ?? 1))).sort((a, b) => a - b);
  const activeSeason = episodes?.find((e) => e.active)?.seasonNumber ?? epSeasons[0] ?? 1;
  const [epsSeason, setEpsSeason] = useState<number>(activeSeason);
  const panelEpisodes = (episodes || []).filter((e) => (e.seasonNumber ?? 1) === epsSeason);

  const toggleEps = useCallback(() => {
    setShowEps((v) => {
      if (!v) setEpsSeason(activeSeason);
      return !v;
    });
    pokeControls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeason]);

  // ── Source wiring (HLS via hls.js where needed, native otherwise) ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    setFailed(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    let hls: import('hls.js').default | null = null;
    let cancelled = false;

    const attach = async () => {
      if (isHlsUrl(videoUrl) && !video.canPlayType('application/vnd.apple.mpegurl')) {
        const { default: Hls } = await import('hls.js');
        if (cancelled) return;
        if (Hls.isSupported()) {
          hls = new Hls(getHLSConfig() as any);
          hls.loadSource(videoUrl);
          hls.attachMedia(video);
          return;
        }
      }
      video.src = videoUrl;
      video.load();
    };
    attach();

    return () => {
      cancelled = true;
      if (hls) hls.destroy();
    };
  }, [videoUrl]);

  // ── Auto-hide controls while playing ──
  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 2600);
  }, []);

  useEffect(() => () => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => setFailed(true));
    else v.pause();
    pokeControls();
  }, [pokeControls]);

  const skip = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, v.currentTime + delta), v.duration || Infinity);
    pokeControls();
  }, [pokeControls]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
      if (detectDeviceKind() === 'ios' && v?.webkitEnterFullscreen) {
        v.webkitEnterFullscreen();
      } else {
        el.requestFullscreen?.().catch(() => {});
      }
    }
    pokeControls();
  }, [pokeControls]);

  const onSeek = useCallback((value: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = value;
    setCurrentTime(value);
  }, []);

  if (!videoUrl && embedUrl) {
    return (
      <div className="relative w-full aspect-video bg-black">
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          title="Video player"
        />
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className="w-full aspect-video bg-black grid place-items-center">
        <p className="text-sm text-white/50">No source available on this server.</p>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const showOverlay = Boolean(overlayTitle) && overlaySeason != null && overlayEpisode != null;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black select-none overflow-hidden"
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
    >
      <video
        ref={videoRef}
        poster={poster}
        className="absolute inset-0 w-full h-full object-contain"
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onPlay={() => { setIsPlaying(true); pokeControls(); }}
        onPause={() => { setIsPlaying(false); setControlsVisible(true); }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onError={() => setFailed(true)}
      />

      {/* Title + S/E — top-left, follows control visibility */}
      {showOverlay && (
        <div
          className={`absolute top-0 inset-x-0 z-20 px-3 pt-3 pb-6 bg-gradient-to-b from-black/70 to-transparent pointer-events-none transition-opacity duration-200 ${
            controlsVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <p className="text-[11px] sm:text-xs font-semibold text-white truncate">{overlayTitle}</p>
          <p className="text-[10px] text-white/60">S{overlaySeason} · E{overlayEpisode}</p>
        </div>
      )}

      {/* Center buffering spinner */}
      {buffering && !failed && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <Loader2 className="h-6 w-6 animate-spin text-white/70" />
        </div>
      )}

      {/* Failure state */}
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-black/80">
          <p className="text-sm text-white/70">This source can't play here — try another server.</p>
        </div>
      )}

      {/* Center tap play button when paused */}
      {!isPlaying && !buffering && !failed && (
        <button
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 grid place-items-center"
        >
          <span className="h-12 w-12 rounded-full bg-black/60 border border-white/20 grid place-items-center">
            <Play className="h-5 w-5 text-white ml-0.5" fill="currentColor" />
          </span>
        </button>
      )}

      {/* Control bar: timeline + play/pause + ±10s + fullscreen only */}
      <div
        className={`absolute inset-x-0 bottom-0 px-2.5 pb-1.5 pt-6 bg-gradient-to-t from-black/85 to-transparent transition-opacity duration-200 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Seek"
          className="shadow-timeline w-full"
          style={{
            background: `linear-gradient(to right, #fff ${progress}%, rgba(255,255,255,0.25) ${progress}%)`,
          }}
        />

        <div className="mt-0.5 flex items-center gap-2">
          <button onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} className="p-1 text-white">
            {isPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
          </button>
          <button onClick={() => skip(-10)} aria-label="Back 10 seconds" className="p-1 text-white/85">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => skip(10)} aria-label="Forward 10 seconds" className="p-1 text-white/85">
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-white/70 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="flex-1" />
          <button onClick={toggleFullscreen} aria-label="Fullscreen" className="p-1 text-white">
            <Maximize className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
