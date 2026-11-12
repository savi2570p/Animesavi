import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type Hls from 'hls.js';
import {
  Download, Maximize, Minimize, Pause, Play, RefreshCw, Settings, Volume2, VolumeX,
} from 'lucide-react';
import {
  EmbedBrand, EmbedBtn, EmbedCenterPlay, EmbedKeyHint, EmbedLoading, EmbedMenu, EmbedMenuItem, EmbedMenuLabel,
  EmbedSeek, EmbedStatus, EmbedTime,
} from '@/components/embed/EmbedChrome';
import { useEmbedResume } from '@/hooks/useEmbedResume';
import { useEmbedHotkeys } from '@/hooks/useEmbedHotkeys';
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
  const rawToken = params.token ?? params.slug ?? '';
  // Guard: never call the resolver with an unresolved route placeholder
  // (e.g. a literal ":token" from a crawler/prefetch hitting the pattern URL).
  const token = /^[A-Za-z0-9_-]{4,64}$/.test(rawToken) ? rawToken : '';

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
    if (!token) {
      setResolution({ status: 'NOT_FOUND', reason: 'Invalid embed link.', sources: [] } as unknown as EmbedResolution);
      setLoading(false);
      return;
    }
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

  // Token links map to one episode, so the token is a stable resume key.
  useEmbedResume(videoRef, token ? `token:${token}` : null, activeSource?.url);

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

  const keyHint = useEmbedHotkeys(videoRef, {
    togglePlay,
    toggleFullscreen: () => void toggleFullscreen(),
    setSpeed: setSpeed,
    onEscape: () => setShowSettings(false),
    onActivity: () => setShowControls(true),
  });

  /* --------------------------------------------------------------- states */
  if (loading && !resolution) {
    return <EmbedStatus tone="loading" />;
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
      <EmbedStatus
        tone={status === 'PROCESSING' ? 'loading' : 'error'}
        title={messages[status] ?? messages.FAILED}
        message={resolution?.reason}
        progress={status === 'PROCESSING' && typeof resolution?.progress === 'number' ? resolution.progress : undefined}
      >
        <button type="button" onClick={() => void load()} className="ep3-ghost">
          <RefreshCw /> Retry
        </button>
      </EmbedStatus>
    );
  }

  /* --------------------------------------------------------------- player */
  return (
    <div
      ref={shellRef}
      className="ep3 ep3-root"
      onMouseMove={() => setShowControls(true)}
      onTouchStart={() => setShowControls(true)}
    >
      <video
        ref={videoRef}
        className="ep3-video"
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

      {buffering && !playbackError && <EmbedLoading />}

      {playbackError && (
        <EmbedStatus tone="error" variant="overlay" title={playbackError}>
          <button type="button" onClick={() => { setPlaybackError(null); void load(); }} className="ep3-cta">
            <RefreshCw /> Retry
          </button>
          {activeSource && (
            <a href={activeSource.url} target="_blank" rel="noreferrer" className="ep3-ghost">
              Open directly
            </a>
          )}
          {sources.length > 1 && (
            <button
              type="button"
              onClick={() => { setPlaybackError(null); setSourceIndex((i) => (i + 1) % sources.length); }}
              className="ep3-ghost"
            >
              Switch source
            </button>
          )}
        </EmbedStatus>
      )}

      <div className="ep3-layer is-pass" data-visible={showControls ? 'true' : 'false'}>
        <div className="ep3-top">
          <div className="ep3-top-info">
            <EmbedBrand compact />
            <span className="ep3-divider" aria-hidden />
            <div className="ep3-top-text">
              <p className="ep3-title">{displayTitle}</p>
              {activeSource?.label && sources.length > 1 && <p className="ep3-sub">{activeSource.label}</p>}
            </div>
          </div>
        </div>

        <EmbedKeyHint hint={keyHint} />
        {!isPlaying && !buffering && !playbackError && <EmbedCenterPlay onClick={togglePlay} />}

        <div className="ep3-bottom">
          <EmbedSeek value={Math.min(currentTime, duration || 0)} max={duration || 0} step={0.1} onChange={seekTo} />
          <div className="ep3-bar">
            <div className="ep3-group">
              <EmbedBtn label={isPlaying ? 'Pause' : 'Play'} primary onClick={togglePlay}>
                {isPlaying ? <Pause /> : <Play />}
              </EmbedBtn>
              <EmbedBtn
                label={isMuted ? 'Unmute' : 'Mute'}
                onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }}
              >
                {isMuted ? <VolumeX /> : <Volume2 />}
              </EmbedBtn>
              <EmbedTime current={currentTime} duration={duration} />
            </div>
            <div className="ep3-group">
              <div className="ep3-anchor">
                <EmbedBtn label="Settings" active={showSettings} onClick={() => setShowSettings((v) => !v)}>
                  <Settings />
                </EmbedBtn>
                {showSettings && (
                  <EmbedMenu label="Settings">
                    <EmbedMenuLabel>Speed</EmbedMenuLabel>
                    <div className="ep3-menu-chips">
                      {SPEEDS.map((s) => (
                        <button key={s} type="button" data-active={speed === s ? 'true' : undefined} onClick={() => applySpeed(s)}>
                          {s}x
                        </button>
                      ))}
                    </div>
                    {levels.length > 0 && (
                      <>
                        <EmbedMenuLabel>Quality</EmbedMenuLabel>
                        <EmbedMenuItem active={currentLevel === -1} onClick={() => applyLevel(-1)}>Auto</EmbedMenuItem>
                        {levels.map((l) => (
                          <EmbedMenuItem key={l.id} active={currentLevel === l.id} onClick={() => applyLevel(l.id)}>
                            {l.label}
                          </EmbedMenuItem>
                        ))}
                      </>
                    )}
                    {audioTracks.length > 1 && (
                      <>
                        <EmbedMenuLabel>Audio</EmbedMenuLabel>
                        {audioTracks.map((t) => (
                          <EmbedMenuItem key={t.id} active={currentAudio === t.id} onClick={() => applyAudio(t.id)}>
                            {t.label}
                          </EmbedMenuItem>
                        ))}
                      </>
                    )}
                    {sources.length > 1 && (
                      <>
                        <EmbedMenuLabel>Source</EmbedMenuLabel>
                        {sources.map((s, i) => (
                          <EmbedMenuItem key={s.url} active={sourceIndex === i} onClick={() => setSourceIndex(i)}>
                            {s.label}
                          </EmbedMenuItem>
                        ))}
                      </>
                    )}
                  </EmbedMenu>
                )}
              </div>
              {activeSource?.type === 'mp4' && (
                <a href={activeSource.url} download aria-label="Download" title="Download" className="ep3-btn">
                  <Download />
                </a>
              )}
              <EmbedBtn label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={() => void toggleFullscreen()}>
                {isFullscreen ? <Minimize /> : <Maximize />}
              </EmbedBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
