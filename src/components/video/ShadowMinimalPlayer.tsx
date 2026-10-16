import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Maximize, Loader2, List, Captions } from 'lucide-react';
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
  /** Optional subtitle file (VTT or SRT). Shows a CC button when set. */
  captionsUrl?: string | null;
  /** Used if the direct video can't play in this browser. */
  fallbackEmbedUrl?: string | null;
}

/** Index of the Hindi audio track, or -1 when there isn't one. */
function pickHindi(tracks: Array<{ label: string; lang: string }>): number {
  return tracks.findIndex((t) => /^(hi|hin)(-|$)/i.test(t.lang) || /hindi|हिन्दी|हिंदी/i.test(t.label));
}

/** Enable the Hindi track on browsers exposing native audioTracks (Safari/iOS). */
function applyNativeHindi(video: HTMLVideoElement) {
  const list = (video as any).audioTracks;
  if (!list || list.length < 2) return;
  const arr = Array.from({ length: list.length }, (_, i) => list[i]);
  const idx = pickHindi(arr.map((t: any) => ({ label: t.label || '', lang: t.language || '' })));
  if (idx < 0 || arr[idx].enabled) return;
  arr.forEach((t: any, i: number) => { t.enabled = i === idx; });
  // iOS needs a tiny seek to apply the switch
  try { video.currentTime = video.currentTime + 0.001; } catch { /* ignore */ }
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
  captionsUrl,
  fallbackEmbedUrl,
}: ShadowMinimalPlayerProps) {
  const [ccSrc, setCcSrc] = useState<string | null>(null);
  const [ccOn, setCcOn] = useState(true);
  useEffect(() => {
    if (!captionsUrl) { setCcSrc(null); return; }
    let url: string | null = null;
    let cancelled = false;
    fetch(captionsUrl).then((r) => (r.ok ? r.text() : Promise.reject(r.status))).then((txt) => {
      if (cancelled) return;
      let vtt = txt.replace(/^\uFEFF/, '').replace(/\r/g, '');
      if (!vtt.trimStart().startsWith('WEBVTT')) {
        vtt = 'WEBVTT\n\n' + vtt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
      }
      url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
      setCcSrc(url);
    }).catch(() => setCcSrc(null));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [captionsUrl]);
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !ccSrc) return;
    const apply = () => { for (const t of Array.from(v.textTracks)) t.mode = ccOn ? 'showing' : 'hidden'; };
    apply();
    const id = window.setTimeout(apply, 300);
    return () => window.clearTimeout(id);
  }, [ccOn, ccSrc]);
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
          hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
            const idx = pickHindi((data.audioTracks || []).map((t: any) => ({ label: t.name || '', lang: t.lang || '' })));
            if (idx >= 0 && hls) hls.audioTrack = idx;
          });
          hls.on(Hls.Events.ERROR, (_e, d: any) => { if (d?.fatal) setFailed(true); });
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
    if (v.paused) v.play().catch((err) => { if (err?.name === 'NotSupportedError') setFailed(true); });
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

  const episodePanel = hasEpisodes && showEps ? (
    <div className="absolute right-2 bottom-12 z-30 w-52 sm:w-60 max-h-[75%] flex flex-col rounded-xl border border-white/10 bg-black/85 backdrop-blur-xl overflow-hidden shadow-2xl">
      {epSeasons.length > 1 && (
        <div className="flex items-center gap-1 px-2 pt-2 pb-1.5 overflow-x-auto">
          {epSeasons.map((sn) => (
            <button
              key={sn}
              onClick={() => setEpsSeason(sn)}
              data-active={sn === epsSeason}
              className="shrink-0 px-2 py-1 rounded-md text-[10px] font-semibold text-white/60 hover:text-white data-[active=true]:bg-white data-[active=true]:text-black transition-colors"
            >
              S{sn}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-y-auto p-2 grid grid-cols-5 gap-1.5">
        {panelEpisodes.map((e) => (
          <button
            key={e.key}
            onClick={() => { onSelectEpisode?.(e.key); setShowEps(false); }}
            data-active={!!e.active}
            className="py-1.5 rounded-md text-[11px] font-semibold bg-white/5 text-white/70 border border-white/10 hover:text-white data-[active=true]:bg-white data-[active=true]:text-black data-[active=true]:border-white transition-colors"
          >
            {e.number}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  const useEmbed = (!videoUrl && embedUrl) || (failed && fallbackEmbedUrl);
  const activeEmbed = (!videoUrl && embedUrl) ? embedUrl : fallbackEmbedUrl;
  if (useEmbed && activeEmbed) {
    return (
      <div className="relative w-full aspect-video bg-black">
        <iframe
          src={activeEmbed}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          title="Video player"
        />
        {hasEpisodes && (
          <button
            onClick={toggleEps}
            aria-label="Episodes"
            className="absolute top-2 right-2 z-30 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/60 border border-white/15 text-[10px] text-white/85 hover:text-white backdrop-blur-md"
          >
            <List className="h-3 w-3" />
            Episodes
          </button>
        )}
        {episodePanel}
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
      className="player-shell relative w-full aspect-video bg-black select-none overflow-hidden"
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
    >
      <video
        ref={videoRef}
        poster={poster}
        className="absolute inset-0 w-full h-full object-contain"
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        onClick={togglePlay}
        onPlay={() => { setIsPlaying(true); pokeControls(); }}
        onPause={() => { setIsPlaying(false); setControlsVisible(true); }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); applyNativeHindi(e.currentTarget); }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onWaiting={() => setBuffering(true)}
        onPlaying={(e) => { setBuffering(false); applyNativeHindi(e.currentTarget); }}
        onCanPlay={() => setBuffering(false)}
        onError={() => setFailed(true)}
      >
        {ccSrc && <track kind="subtitles" src={ccSrc} srcLang="en" label="CC" default />}
      </video>

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
          <p className="text-sm text-white/70">This source can't play here.</p>
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
          <div className="embed-pill flex items-center gap-1">
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
          </div>
          <div className="flex-1" />
          <div className="embed-pill flex items-center gap-1">
          {ccSrc && (
            <button
              onClick={() => setCcOn((v) => !v)}
              aria-label="Subtitles"
              aria-pressed={ccOn}
              className={`p-1 transition-colors ${ccOn ? 'text-white' : 'text-white/45 hover:text-white'}`}
            >
              <Captions className="h-3.5 w-3.5" />
            </button>
          )}
          {hasEpisodes && (
            <button
              onClick={toggleEps}
              aria-label="Episodes"
              aria-expanded={showEps}
              className={`p-1 transition-colors ${showEps ? 'text-white' : 'text-white/85 hover:text-white'}`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={toggleFullscreen} aria-label="Fullscreen" className="p-1 text-white">
            <Maximize className="h-3.5 w-3.5" />
          </button>
          </div>
        </div>
      </div>
      {episodePanel}
    </div>
  );
}
