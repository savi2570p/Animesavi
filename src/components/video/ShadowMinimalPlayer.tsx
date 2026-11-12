import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Maximize, List, Captions } from 'lucide-react';
import { EmbedBtn, EmbedCenterPlay, EmbedDoubleTap, EmbedEpisodeDrawer, EmbedLoading, EmbedSeek, EmbedStatus, EmbedTime } from '@/components/embed/EmbedChrome';
import { isHlsUrl, detectDeviceKind } from '@/lib/streamSource';
import { getHLSConfig } from '@/lib/videoUtils';
import { useEmbedResume } from '@/hooks/useEmbedResume';

/**
 * Shadow link v2 minimal player — ONLY: timeline, play/pause, fullscreen,
 * optional CC/episodes. Double-tap seeks ±10s. No branding, no settings menus.
 */

interface ShadowMinimalPlayerProps {
  resumeEpisodeId?: string | null;
  videoUrl: string | null;
  embedUrl?: string | null;
  poster?: string;
  /** Shown top-left only while controls are visible */
  overlayTitle?: string;
  overlaySeason?: number;
  overlayEpisode?: number;
  /** In-player episode picker (rendered inside the player, never outside). */
  episodes?: Array<{ key: string; number: number; title?: string | null; seasonNumber?: number; active?: boolean }>;
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
  resumeEpisodeId,
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
  useEmbedResume(videoRef, resumeEpisodeId, videoUrl);
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

  // Double-tap the left/right side of the video to seek ±10s (no skip buttons).
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const [tapSide, setTapSide] = useState<'left' | 'right' | null>(null);
  const onVideoTouchEnd = useCallback((e: React.TouchEvent<HTMLVideoElement>) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const last = lastTapRef.current;
    if (now - last.time < 300 && Math.abs(x - last.x) < 60) {
      e.preventDefault();
      const side = x < rect.width / 2 ? 'left' : 'right';
      skip(side === 'left' ? -10 : 10);
      setTapSide(side);
      window.setTimeout(() => setTapSide(null), 500);
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x };
    }
  }, [skip]);

  const episodePanel = hasEpisodes && showEps ? (
    <EmbedEpisodeDrawer
      heading={overlayTitle || 'Episodes'}
      subheading={`Season ${epsSeason} · ${panelEpisodes.length} episodes`}
      seasons={epSeasons}
      activeSeason={epsSeason}
      onSeasonChange={setEpsSeason}
      items={panelEpisodes.map((e) => ({ key: e.key, number: e.number, title: e.title, active: e.active }))}
      onSelect={(item) => { onSelectEpisode?.(item.key); setShowEps(false); }}
      onClose={() => setShowEps(false)}
    />
  ) : null;

  const useEmbed = (!videoUrl && embedUrl) || (failed && fallbackEmbedUrl);
  const activeEmbed = (!videoUrl && embedUrl) ? embedUrl : fallbackEmbedUrl;
  if (useEmbed && activeEmbed) {
    return (
      <div className="ep3 ep3-inline">
        <iframe
          src={activeEmbed}
          className="ep3-frame"
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          title="Video player"
        />
        {hasEpisodes && (
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 30 }}>
            <button type="button" onClick={toggleEps} aria-label="Episodes" className="ep3-chip-btn" data-active={showEps ? 'true' : undefined}>
              <List /> Episodes
            </button>
          </div>
        )}
        {episodePanel}
      </div>
    );
  }

  if (!videoUrl) {
    return <EmbedStatus tone="error" brand={false} variant="inline" title="No source available on this server." />;
  }

  const showOverlay = Boolean(overlayTitle) && overlaySeason != null && overlayEpisode != null;

  return (
    <div
      ref={containerRef}
      className="ep3 ep3-inline"
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
    >
      <video
        ref={videoRef}
        poster={poster}
        className="ep3-video"
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        onClick={togglePlay}
        onTouchEnd={onVideoTouchEnd}
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

      {buffering && !failed && <EmbedLoading />}
      {tapSide && <EmbedDoubleTap side={tapSide} />}
      {failed && (
        <EmbedStatus tone="error" brand={false} variant="overlay" title="This source can't play here." />
      )}

      <div className="ep3-layer is-pass" data-visible={controlsVisible ? 'true' : 'false'}>
        {/* Title + S/E — top-left, follows control visibility */}
        {showOverlay ? (
          <div className="ep3-top" style={{ pointerEvents: 'none' }}>
            <div className="ep3-top-text">
              <p className="ep3-title">{overlayTitle}</p>
              <p className="ep3-sub"><b>S{overlaySeason} · E{overlayEpisode}</b></p>
            </div>
          </div>
        ) : <div />}

        {!isPlaying && !buffering && !failed && <EmbedCenterPlay onClick={togglePlay} />}

        {/* Control bar: timeline + play/pause + time + CC/episodes/fullscreen */}
        <div className="ep3-bottom">
          <EmbedSeek value={currentTime} max={duration || 0} step={0.1} onChange={onSeek} />
          <div className="ep3-bar">
            <div className="ep3-group">
              <EmbedBtn label={isPlaying ? 'Pause' : 'Play'} primary onClick={togglePlay}>
                {isPlaying ? <Pause /> : <Play />}
              </EmbedBtn>
              <EmbedTime current={currentTime} duration={duration} />
            </div>
            <div className="ep3-group">
              {ccSrc && (
                <EmbedBtn label="Subtitles" active={ccOn} onClick={() => setCcOn((v) => !v)}>
                  <Captions />
                </EmbedBtn>
              )}
              {hasEpisodes && (
                <EmbedBtn label="Episodes" active={showEps} onClick={toggleEps}>
                  <List />
                </EmbedBtn>
              )}
              <EmbedBtn label="Fullscreen" onClick={toggleFullscreen}>
                <Maximize />
              </EmbedBtn>
            </div>
          </div>
        </div>
      </div>
      {episodePanel}
    </div>
  );
}
