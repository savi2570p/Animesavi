import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Hls from 'hls.js';
import { Play, Pause, Maximize, Minimize, Download, X, List, RotateCcw, RotateCw, Subtitles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { extractEmbedSrc, isEmbedLikeUrl } from '@/components/video/PureEmbedPlayer';

const QUALITY_TIERS: Array<{ label: string; tag: string }> = [
  { label: '480p', tag: 'SD' },
  { label: '720p', tag: 'HD' },
  { label: '1080p', tag: 'FHD' },
  { label: '2160p', tag: '4K' },
];

/**
 * MinimalEmbedPage — ultra-light single-element embed.
 *
 * Route: /embed/:animeSlug/:seasonSlug/:episodeSlug
 *
 * - Direct files / HLS → native <video> element with custom flat purple controls
 *   (play/pause, timeline, fullscreen, download). No circular backgrounds.
 * - External provider links → single top-level iframe, no overlays
 *   (cross-origin makes custom controls impossible — provider's controls are used).
 *
 * Access control: only animesavi.com and shadowflix.lovable.app may embed.
 */

const ALLOWED_EMBED_HOSTS = [
  'shadowflix.lovable.app',
  'animesavi.com',
  'www.animesavi.com',
];

function isHostAllowed(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  return ALLOWED_EMBED_HOSTS.some((allowed) => h === allowed || h.endsWith('.' + allowed));
}

function checkEmbedAccess(): boolean {
  if (typeof window === 'undefined') return false;
  const currentHost = window.location.hostname.toLowerCase();
  if (currentHost === 'localhost' || currentHost.endsWith('.lovable.app') || currentHost.endsWith('.lovableproject.com')) {
    return true;
  }
  if (window.parent === window) {
    return isHostAllowed(currentHost);
  }
  try {
    const ref = document.referrer;
    if (!ref) return false;
    const refHost = new URL(ref).hostname;
    return isHostAllowed(refHost);
  } catch {
    return false;
  }
}

const slugify = (t: string): string =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const isHlsUrl = (url: string): boolean => /\.m3u8(\?.*)?$/i.test(url);

function parseSeasonNumber(slug?: string): number {
  if (!slug) return 1;
  const m = slug.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

function parseEpisodeNumber(slug?: string): number {
  if (!slug) return 1;
  const m = slug.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  const h = Math.floor(m / 60);
  if (h > 0) {
    return `${h}:${(m % 60).toString().padStart(2, '0')}:${sec}`;
  }
  return `${m}:${sec}`;
}

export default function MinimalEmbedPage() {
  const { animeSlug, seasonSlug, episodeSlug } = useParams<{
    animeSlug: string;
    seasonSlug: string;
    episodeSlug: string;
  }>();

  // Shadow theme = stripped-down embed (no download button).
  const isShadowTheme = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('theme') === 'shadow';

  // Shadow theme bypasses host restrictions — usable from anywhere.
  // Regular /embed/ links remain limited to the allowlisted hosts.
  const [accessAllowed] = useState<boolean>(() => isShadowTheme || checkEmbedAccess());
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [captionsUrl, setCaptionsUrl] = useState<string | null>(null);
  const [audioLanguage, setAudioLanguage] = useState<string>('original');
  const [ccEnabled, setCcEnabled] = useState(false);
  const [title, setTitle] = useState<string>('');
  const [animeTitle, setAnimeTitle] = useState<string>('');
  const [seasonNum, setSeasonNum] = useState<number>(1);
  const [currentEpisodeNum, setCurrentEpisodeNum] = useState<number>(1);
  const [episodeList, setEpisodeList] = useState<Array<{ episode_number: number; title: string | null }>>([]);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Custom control state (only used when rendering native <video>)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const hideTimer = useRef<number | null>(null);

  // Resolve episode → video URL.
  useEffect(() => {
    if (!accessAllowed) return;
    let cancelled = false;
    (async () => {
      try {
        if (!animeSlug || !seasonSlug || !episodeSlug) {
          throw new Error('Invalid embed URL');
        }
        const seasonNumber = parseSeasonNumber(seasonSlug);
        const episodeNumber = parseEpisodeNumber(episodeSlug);

        const { data: animeList, error: animeErr } = await supabase
          .from('anime_public')
          .select('id, title');
        if (animeErr) throw animeErr;
        const anime = animeList?.find((a) => a.title && slugify(a.title) === animeSlug);
        if (!anime) throw new Error('Anime not found');

        const { data: seasons } = await supabase
          .from('seasons')
          .select('id, season_number')
          .eq('anime_id', anime.id);
        const season = seasons?.find((s) => s.season_number === seasonNumber) ?? seasons?.[0];
        if (!season) throw new Error('Season not found');

        const { data: ep } = await supabase
          .from('episodes')
          .select('title, video_url, external_url, captions_url, audio_language')
          .eq('season_id', season.id)
          .eq('episode_number', episodeNumber)
          .maybeSingle();
        if (!ep) throw new Error(`S${seasonNumber}E${episodeNumber} not found`);

        const url = ep.video_url || ep.external_url;
        if (!url) throw new Error('No video available');

        // Fetch sibling episodes for the Episodes tab (Shadow Link only).
        let siblings: Array<{ episode_number: number; title: string | null }> = [];
        if (isShadowTheme) {
          const { data: epList } = await supabase
            .from('episodes')
            .select('episode_number, title')
            .eq('season_id', season.id)
            .order('episode_number', { ascending: true });
          siblings = (epList || []) as Array<{ episode_number: number; title: string | null }>;
        }

        if (cancelled) return;
        setTitle(`${anime.title} • S${seasonNumber}E${episodeNumber}`);
        setAnimeTitle(anime.title);
        setSeasonNum(seasonNumber);
        setCurrentEpisodeNum(episodeNumber);
        setEpisodeList(siblings);
        setVideoUrl(url);
        setCaptionsUrl(ep.captions_url || null);
        const lang = (ep.audio_language || 'original').toLowerCase();
        setAudioLanguage(lang);
        // Auto-CC: Japanese audio defaults to subs ON; Hindi defaults to OFF; others ON if subs exist.
        setCcEnabled(!!ep.captions_url && lang !== 'hindi' && lang !== 'hi' && lang !== 'hindi-dub');
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Video cannot be played on this device');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [animeSlug, seasonSlug, episodeSlug, accessAllowed]);

  const useIframe = useMemo(() => (videoUrl ? isEmbedLikeUrl(videoUrl) : false), [videoUrl]);
  const iframeSrc = useMemo(() => (videoUrl ? extractEmbedSrc(videoUrl) : ''), [videoUrl]);

  // HLS / direct file setup.
  useEffect(() => {
    if (useIframe || !videoUrl) return;
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHlsUrl(videoUrl)) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = videoUrl;
      } else if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) setError('Video cannot be played on this device');
        });
      } else {
        setError('Video cannot be played on this device');
      }
    } else {
      video.src = videoUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoUrl, useIframe]);

  // Wire up native video → custom UI state.
  useEffect(() => {
    if (useIframe) return;
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => setCurrentTime(v.currentTime);
    const onLoaded = () => setDuration(v.duration || 0);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('durationchange', onLoaded);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('durationchange', onLoaded);
    };
  }, [useIframe, videoUrl]);

  // Track fullscreen state.
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const toggleFullscreen = useCallback(() => {
    const v = videoRef.current;
    const el = containerRef.current;
    // iOS Safari: prefer the native iPhone/iPad fullscreen video player.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
    const vAny = v as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (isIOS && vAny?.webkitEnterFullscreen) {
      try { vAny.webkitEnterFullscreen(); return; } catch {}
    }
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  }, []);

  // Keyboard shortcuts: ←/→ to skip ±10s
  useEffect(() => {
    if (useIframe) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const v = videoRef.current;
      if (!v) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        v.currentTime = Math.max(0, v.currentTime - 10);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        v.currentTime = Math.min(v.duration || v.currentTime, v.currentTime + 10);
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        if (v.paused) v.play().catch(() => {}); else v.pause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [useIframe]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const pct = parseFloat(e.target.value);
    v.currentTime = (pct / 100) * duration;
  }, [duration]);

  const handleDownloadClick = useCallback(() => {
    setShowQualityPicker(true);
  }, []);

  const handleQualitySelect = useCallback((quality: string) => {
    if (!videoUrl) return;
    const animeName = (title.split('•')[0] || 'video').trim();
    const epMatch = title.match(/S(\d+)E(\d+)/i);
    const ep = epMatch ? `${epMatch[1].padStart(2, '0')}` : '01';
    const params = new URLSearchParams({
      quality,
      anime: animeName,
      ep,
      url: videoUrl,
    });
    // Same-tab navigation → no default OS player, no popup blockers.
    window.location.href = `/shadow-arise?${params.toString()}`;
  }, [videoUrl, title]);

  const bumpControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 3000);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!accessAllowed) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.85)', fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14, padding: 24, textAlign: 'center',
      }}>
        This embed is not authorized for this domain.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={bumpControls}
      onTouchStart={bumpControls}
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        width: '100%', height: '100%', minHeight: '100dvh',
        background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: 0, padding: 0, overflow: 'hidden',
      }}
    >
      {/* Force html/body to fill viewport so iOS Safari renders the embed reliably. */}
      <style>{`html,body,#root{margin:0;padding:0;width:100%;height:100%;min-height:100dvh;background:#000;overflow:hidden;}`}</style>
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        background: '#000', overflow: 'hidden',
      }}>
        {/* Top-right Episodes button (Shadow Link only) */}
        {isShadowTheme && episodeList.length > 1 && (
           <button
            onClick={() => setShowEpisodes((v) => !v)}
            aria-label="Episodes"
            aria-expanded={showEpisodes}
            title="Episodes"
            style={{
              position: 'absolute',
              top: 'max(10px, env(safe-area-inset-top))',
              right: 'max(10px, env(safe-area-inset-right))',
              zIndex: 30,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 9px',
              background: showEpisodes ? 'hsl(var(--primary) / 0.85)' : 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid hsl(var(--primary) / 0.5)',
              borderRadius: 9999,
              color: '#fff',
              fontSize: 10.5,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: 1,
              pointerEvents: 'auto',
              transition: 'all 200ms ease',
            }}
          >
            <List size={12} />
            <span>{showEpisodes ? 'Close' : 'Episodes'}</span>
          </button>
        )}
        {loading && !error && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1,
          }}>
            <div style={{
              width: 36, height: 36,
              border: '2px solid rgba(255,255,255,0.2)',
              borderTopColor: 'hsl(var(--primary))',
              borderRadius: '50%',
              animation: 'embed-spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes embed-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.85)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 14, padding: 24, textAlign: 'center',
          }}>
            Video cannot be played on this device
          </div>
        )}

        {!error && videoUrl && useIframe && (
          <iframe
            src={iframeSrc}
            title={title || 'Embedded video'}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              border: 0, background: '#000',
            }}
          />
        )}

        {!error && videoUrl && !useIframe && (
          <>
            <video
              ref={videoRef}
              playsInline
              autoPlay
              preload="auto"
              crossOrigin={captionsUrl ? 'anonymous' : undefined}
              onClick={togglePlay}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                background: '#000', objectFit: 'contain',
                // Avoid transforms — they break touch hit-test in landscape on iOS/Android.
                transform: 'translateZ(0)',
                touchAction: 'manipulation',
              }}
              onError={() => setError('Video cannot be played on this device')}
            >
              {captionsUrl && (
                <track
                  key={captionsUrl}
                  kind="subtitles"
                  src={captionsUrl}
                  srcLang={audioLanguage === 'hindi' ? 'hi' : 'en'}
                  label={audioLanguage === 'hindi' ? 'Hindi' : 'English'}
                  default={ccEnabled}
                />
              )}
            </video>

            {/* Flat custom controls — purple themed, no circular backgrounds. */}
            <div
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                padding: 'max(40px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(14px, env(safe-area-inset-bottom, 14px)) max(16px, env(safe-area-inset-left, 0px))',
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
                opacity: showControls || !isPlaying ? 1 : 0,
                transition: 'opacity 200ms ease',
                pointerEvents: showControls || !isPlaying ? 'auto' : 'none',
                touchAction: 'manipulation',
                zIndex: 5,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Timeline — wrapper enlarged to 22px for hit-test, visual bar stays 4px */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: 'ui-monospace, monospace', minWidth: 42 }}>
                  {formatTime(currentTime)}
                </span>
                <div style={{ position: 'relative', flex: 1, height: 22, display: 'flex', alignItems: 'center', touchAction: 'pan-x' }}>
                  <div style={{
                    position: 'absolute', left: 0, right: 0, top: '50%', height: 4, transform: 'translateY(-50%)',
                    background: 'rgba(255,255,255,0.25)', borderRadius: 9999,
                  }} />
                  <div style={{
                    position: 'absolute', top: '50%', left: 0, height: 4,
                    width: `${progress}%`, transform: 'translateY(-50%)',
                    background: 'hsl(var(--primary))',
                    borderRadius: 9999,
                    boxShadow: '0 0 8px hsl(var(--primary) / 0.6)',
                  }} />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step="any"
                    value={isNaN(progress) ? 0 : progress}
                    onChange={handleSeek}
                    className="embed-range"
                    style={{
                      position: 'absolute', inset: 0,
                      width: '100%', height: '100%',
                      background: 'transparent',
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      cursor: 'pointer',
                      margin: 0,
                    }}
                  />
                </div>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: 'ui-monospace, monospace', minWidth: 42, textAlign: 'right' }}>
                  {formatTime(duration)}
                </span>
              </div>

              {/* Buttons row — flat icons, purple hover, no circle bg. */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <button
                    onClick={() => {
                      const v = videoRef.current;
                      if (!v) return;
                      v.currentTime = Math.max(0, v.currentTime - 10);
                    }}
                    aria-label="Back 10 seconds"
                    title="Back 10s"
                    className="embed-ctrl-btn"
                  >
                    <RotateCcw size={20} />
                  </button>
                  <button
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    className="embed-ctrl-btn"
                  >
                    {isPlaying ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}
                  </button>
                  <button
                    onClick={() => {
                      const v = videoRef.current;
                      if (!v) return;
                      v.currentTime = Math.min(v.duration || v.currentTime, v.currentTime + 10);
                    }}
                    aria-label="Forward 10 seconds"
                    title="Forward 10s"
                    className="embed-ctrl-btn"
                  >
                    <RotateCw size={20} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  {!isShadowTheme && (
                    <button
                      onClick={handleDownloadClick}
                      aria-label="Download"
                      className="embed-ctrl-btn"
                    >
                      <Download size={20} />
                    </button>
                  )}
                  <button
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    className="embed-ctrl-btn"
                  >
                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <style>{`
              .embed-ctrl-btn {
                background: rgba(0,0,0,0.35);
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 999px;
                min-width: 44px;
                min-height: 44px;
                padding: 8px;
                color: #fff;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: color 150ms ease, transform 150ms ease, background 150ms ease;
                filter: drop-shadow(0 0 8px hsl(var(--primary) / 0.5));
                -webkit-tap-highlight-color: transparent;
                touch-action: manipulation;
              }
              .embed-ctrl-btn:hover { color: hsl(var(--primary)); background: rgba(0,0,0,0.55); }
              .embed-ctrl-btn:active { transform: scale(0.92); }
              .embed-range::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 14px; height: 14px;
                border-radius: 50%;
                background: hsl(var(--primary));
                box-shadow: 0 0 8px hsl(var(--primary) / 0.7);
                cursor: pointer;
                border: 0;
              }
              .embed-range::-moz-range-thumb {
                width: 14px; height: 14px;
                border-radius: 50%;
                background: hsl(var(--primary));
                box-shadow: 0 0 8px hsl(var(--primary) / 0.7);
                cursor: pointer;
                border: 0;
              }
              .embed-range::-webkit-slider-runnable-track { background: transparent; }
              .embed-range::-moz-range-track { background: transparent; }
            `}</style>
          </>
        )}

        {/* Quality picker overlay — shown when user clicks Download */}
        {showQualityPicker && videoUrl && (
          <div
            onClick={() => setShowQualityPicker(false)}
            style={{
              position: 'absolute', inset: 0, zIndex: 20,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'rgba(15, 8, 25, 0.95)',
                border: '1px solid hsl(var(--primary) / 0.4)',
                borderRadius: 16,
                padding: '20px 18px',
                width: '100%', maxWidth: 360,
                boxShadow: '0 0 40px hsl(var(--primary) / 0.25)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Download size={16} style={{ color: 'hsl(var(--primary))' }} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Select Quality</span>
                </div>
                <button
                  onClick={() => setShowQualityPicker(false)}
                  aria-label="Close"
                  style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 4 }}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {QUALITY_TIERS.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => handleQualitySelect(q.label)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                      e.currentTarget.style.background = 'hsl(var(--primary) / 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    }}
                  >
                    <span>{q.label}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 800,
                      padding: '2px 6px', borderRadius: 4,
                      background: 'hsl(var(--primary) / 0.2)',
                      color: 'hsl(var(--primary))',
                    }}>{q.tag}</span>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 12, textAlign: 'center' }}>
                Opens secure download page
              </p>
            </div>
          </div>
        )}

        {/* Shadow Link Episodes drawer */}
        {isShadowTheme && showEpisodes && (
          <div
            onClick={() => setShowEpisodes(false)}
            style={{
              position: 'absolute', inset: 0, zIndex: 25,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              display: 'flex', justifyContent: 'flex-end',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 360, height: '100%',
                background: 'rgba(15, 8, 25, 0.96)',
                borderLeft: '1px solid hsl(var(--primary) / 0.3)',
                display: 'flex', flexDirection: 'column',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: '#fff',
                animation: 'embed-slide-in 220ms ease-out',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {animeTitle}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    Season {seasonNum} • {episodeList.length} episodes
                  </div>
                </div>
                <button
                  onClick={() => setShowEpisodes(false)}
                  aria-label="Close"
                  style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {episodeList.map((e) => {
                  const active = e.episode_number === currentEpisodeNum;
                  return (
                    <button
                      key={e.episode_number}
                      onClick={() => {
                        const epSlug = `episode-${e.episode_number}`;
                        const seasonSlugCurrent = `season-${seasonNum}`;
                        const search = window.location.search;
                        window.location.href = `/embed/${animeSlug}/${seasonSlugCurrent}/${epSlug}${search}`;
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        width: '100%', textAlign: 'left',
                        padding: '10px 12px', marginBottom: 4,
                        borderRadius: 8,
                        border: active ? '1px solid hsl(var(--primary))' : '1px solid rgba(255,255,255,0.08)',
                        background: active ? 'hsl(var(--primary) / 0.18)' : 'rgba(255,255,255,0.03)',
                        color: '#fff', cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        flexShrink: 0,
                        width: 32, height: 32, borderRadius: 6,
                        background: active ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800,
                      }}>
                        {e.episode_number}
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        flex: 1,
                      }}>
                        {e.title || `Episode ${e.episode_number}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              <style>{`@keyframes embed-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
