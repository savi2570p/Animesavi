import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type Hls from 'hls.js';
import {
  AlertTriangle, Download, Loader2, Maximize, Minimize, Pause, Play, RefreshCw, Settings, Volume2, VolumeX,
} from 'lucide-react';
import { resolveEmbedToken, type EmbedResolution, type EmbedSource } from '@/lib/embedTokens';

/**
 * Lightweight, standalone embed player served at /<TOKEN>.
 * Loads nothing from the main app shell — resolver + player only.
 */

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface QualityLevel { id: number; label: string }
interface AudioTrack { id: number; label: string }

export default function TokenEmbedPlayer() {
  const params = useParams();
  const token = params.token ?? params.slug ?? '';
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [resolution, setResolution] = useState<EmbedResolution | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [currentAudio, setCurrentAudio] = useState(0);

  const sources = useMemo(() => resolution?.sources ?? [], [resolution]);
  const activeSource: EmbedSource | undefined = sources[sourceIndex];

  const displayTitle = resolution?.animeTitle
    ? `${resolution.animeTitle} — E${resolution.episodeNumber ?? ''}`
    : resolution?.title ?? 'AnimeSavi';

  /* ---------------------------------------------------------------- resolve */
  const load = useCallback(async () => {
    setLoading(true);
    setPlaybackError(null);
    const data = await resolveEmbedToken(token);
    setResolution(data);
    setSourceIndex(0);
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    document.title = resolution?.title ? `${displayTitle} · AnimeSavi` : 'AnimeSavi Player';
  }, [displayTitle, resolution?.title]);

  // Poll while the video is still encoding.
  useEffect(() => {
    if (resolution?.status !== 'PROCESSING') return;
    const id = window.setInterval(() => { void load(); }, 15000);
    return () => window.clearInterval(id);
  }, [resolution?.status, load]);

  /* ----------------------------------------------------------- attach media */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSource) return;
    let disposed = false;

    setPlaybackError(null);
    setLevels([]);
    setAudioTracks([]);
    setCurrentLevel(-1);

    const nativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== '';

    const attach = async () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;

      if (activeSource.type === 'hls' && !nativeHls) {
        const mod = await import('hls.js');
        if (disposed) return;
        const HlsCtor = mod.default;
        if (!HlsCtor.isSupported()) {
          setPlaybackError('Your browser cannot play this stream.');
          return;
        }
        const hls = new HlsCtor({ enableWorker: true, lowLatencyMode: false, backBufferLength: 60 });
        hlsRef.current = hls;
        hls.loadSource(activeSource.url);
        hls.attachMedia(video);
        hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
          setLevels(hls.levels.map((l, i) => ({ id: i, label: l.height ? `${l.height}p` : `${Math.round((l.bitrate ?? 0) / 1000)}k` })));
          setAudioTracks((hls.audioTracks ?? []).map((t, i) => ({ id: i, label: t.name || t.lang || `Track ${i + 1}` })));
          setCurrentAudio(hls.audioTrack ?? 0);
        });
        hls.on(HlsCtor.Events.LEVEL_SWITCHED, (_e, d) => setCurrentLevel(hls.autoLevelEnabled ? -1 : d.level));
        hls.on(HlsCtor.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          setPlaybackError('Stream error. Try again or switch source.');
        });
      } else {
        video.src = activeSource.url;
        video.load();
      }
    };

    void attach();
    return () => {
      disposed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [activeSource]);

  /* -------------------------------------------------------- media listeners */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setCurrentTime(video.currentTime);
    const onDur = () => setDuration(video.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWait = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onVol = () => setIsMuted(video.muted);
    const onError = () => {
      // Walk every remaining source before declaring failure — a single bad or
      // CORS-restricted URL must not kill playback.
      if (sourceIndex < sources.length - 1) {
        setPlaybackError(null);
        setSourceIndex((i) => i + 1);
        return;
      }
      setPlaybackError(
        'This video could not be played here. Try another source or open it in a new tab.',
      );
    };
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('durationchange', onDur);
    video.addEventListener('loadedmetadata', onDur);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWait);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('volumechange', onVol);
    video.addEventListener('error', onError);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDur);
      video.removeEventListener('loadedmetadata', onDur);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWait);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('volumechange', onVol);
      video.removeEventListener('error', onError);
    };
  }, [sourceIndex, sources.length]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Auto-hide controls during playback.
  useEffect(() => {
    if (!isPlaying || showSettings) { setShowControls(true); return; }
    const id = window.setTimeout(() => setShowControls(false), 3000);
    return () => window.clearTimeout(id);
  }, [isPlaying, showSettings, currentTime]);

  /* ------------------------------------------------------------- controls */
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setPlaybackError('Tap play to start (autoplay blocked).'));
    else video.pause();
  };

  const toggleFullscreen = async () => {
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    const shell = shellRef.current;
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    if (shell?.requestFullscreen) { await shell.requestFullscreen().catch(() => video?.webkitEnterFullscreen?.()); }
    else video?.webkitEnterFullscreen?.(); // iOS Safari native fullscreen
  };

  const seekTo = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const applySpeed = (value: number) => {
    setSpeed(value);
    if (videoRef.current) videoRef.current.playbackRate = value;
  };

  const applyLevel = (id: number) => {
    setCurrentLevel(id);
    if (hlsRef.current) hlsRef.current.currentLevel = id;
  };

  const applyAudio = (id: number) => {
    setCurrentAudio(id);
    if (hlsRef.current) hlsRef.current.audioTrack = id;
  };

  /* --------------------------------------------------------------- states */
  const shellClass = 'fixed inset-0 bg-black text-white flex items-center justify-center';

  if (loading && !resolution) {
    return (
      <div className={shellClass}>
        <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-label="Loading video" />
      </div>
    );
  }

  const status = resolution?.status ?? 'FAILED';

  if (status !== 'READY') {
    const messages: Record<string, string> = {
      PROCESSING: 'Video is still processing.',
      FAILED: 'Video unavailable. Please try again.',
      DISABLED: 'This embed link has been disabled.',
      NOT_FOUND: 'This embed link is invalid or expired.',
    };
    return (
      <div className={`${shellClass} px-6`} style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="text-center max-w-sm">
          {status === 'PROCESSING'
            ? <Loader2 className="h-9 w-9 mx-auto mb-4 animate-spin text-white/70" />
            : <AlertTriangle className="h-9 w-9 mx-auto mb-4 text-amber-400" />}
          <p className="text-base font-semibold">{messages[status] ?? messages.FAILED}</p>
          {resolution?.reason && <p className="text-sm text-white/50 mt-1">{resolution.reason}</p>}
          {status === 'PROCESSING' && typeof resolution?.progress === 'number' && (
            <div className="mt-4 h-1 w-full rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-white/70 transition-all" style={{ width: `${resolution.progress}%` }} />
            </div>
          )}
          <button
            onClick={() => void load()}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------------- player */
  return (
    <div
      ref={shellRef}
      className="fixed inset-0 bg-black overflow-hidden select-none"
      onMouseMove={() => setShowControls(true)}
      onTouchStart={() => setShowControls(true)}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        poster={resolution?.poster ?? undefined}
        playsInline
        controls={false}
        preload="metadata"
        onClick={togglePlay}
      >
        {resolution?.captions && (
          <track kind="subtitles" src={resolution.captions} srcLang="en" label="English" default />
        )}
      </video>

      {buffering && !playbackError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-9 w-9 animate-spin text-white/80" />
        </div>
      )}

      {playbackError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center">
          <div>
            <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-amber-400" />
            <p className="text-white font-semibold">{playbackError}</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => { setPlaybackError(null); void load(); }}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
              {sources.length > 1 && (
                <button
                  onClick={() => { setPlaybackError(null); setSourceIndex((i) => (i + 1) % sources.length); }}
                  className="rounded-lg bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white"
                >
                  Switch source
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-opacity duration-200 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
      >
        <div className="bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pt-10 pb-2">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label="Seek"
            className="embed-seek w-full"
          />
          <div className="mt-1 flex items-center gap-3 text-white">
            <button onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} className="p-1">
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="p-1"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <span className="text-xs tabular-nums text-white/80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <span className="flex-1 truncate text-xs text-white/60 hidden sm:block">{displayTitle}</span>
            <div className="relative">
              <button onClick={() => setShowSettings((v) => !v)} aria-label="Settings" className="p-1">
                <Settings className="h-5 w-5" />
              </button>
              {showSettings && (
                <div className="absolute bottom-9 right-0 w-48 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/90 p-2 text-xs backdrop-blur-md">
                  <p className="px-2 py-1 font-semibold text-white/50">Speed</p>
                  <div className="flex flex-wrap gap-1 px-1 pb-2">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        onClick={() => applySpeed(s)}
                        className={`rounded-md px-2 py-1 ${speed === s ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                      >{s}x</button>
                    ))}
                  </div>
                  {levels.length > 0 && (
                    <>
                      <p className="px-2 py-1 font-semibold text-white/50">Quality</p>
                      <button
                        onClick={() => applyLevel(-1)}
                        className={`block w-full rounded-md px-2 py-1 text-left ${currentLevel === -1 ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                      >Auto</button>
                      {levels.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => applyLevel(l.id)}
                          className={`block w-full rounded-md px-2 py-1 text-left ${currentLevel === l.id ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                        >{l.label}</button>
                      ))}
                    </>
                  )}
                  {audioTracks.length > 1 && (
                    <>
                      <p className="px-2 py-1 font-semibold text-white/50">Audio</p>
                      {audioTracks.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => applyAudio(t.id)}
                          className={`block w-full rounded-md px-2 py-1 text-left ${currentAudio === t.id ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                        >{t.label}</button>
                      ))}
                    </>
                  )}
                  {sources.length > 1 && (
                    <>
                      <p className="px-2 py-1 font-semibold text-white/50">Source</p>
                      {sources.map((s, i) => (
                        <button
                          key={s.url}
                          onClick={() => setSourceIndex(i)}
                          className={`block w-full truncate rounded-md px-2 py-1 text-left ${sourceIndex === i ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                        >{s.label}</button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            {activeSource?.type === 'mp4' && (
              <a href={activeSource.url} download aria-label="Download" className="p-1 text-white">
                <Download className="h-5 w-5" />
              </a>
            )}
            <button onClick={() => void toggleFullscreen()} aria-label="Fullscreen" className="p-1">
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
