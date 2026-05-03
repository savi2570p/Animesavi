import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Hls from 'hls.js';
import { Play, Pause, Maximize, Minimize, Download, X, List } from 'lucide-react';
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
          .select('title, video_url, external_url')
          .eq('season_id', season.id)
          .eq('episode_number', episodeNumber)
          .maybeSingle();
        if (!ep) throw new Error(`S${seasonNumber}E${episodeNumber} not found`);

        const url = ep.video_url || ep.external_url;
        if (!url) throw new Error('No video available');

        if (cancelled) return;
        setTitle(`${anime.title} • S${seasonNumber}E${episodeNumber}`);
        setVideoUrl(url);
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
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  }, []);

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
        position: 'fixed', inset: 0, background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: 0, padding: 0, overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        maxWidth: '100vw', maxHeight: '100vh', aspectRatio: '16 / 9',
        background: '#000', overflow: 'hidden',
      }}>
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
              preload="metadata"
              onClick={togglePlay}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                background: '#000', objectFit: 'contain',
              }}
              onError={() => setError('Video cannot be played on this device')}
            />

            {/* Flat custom controls — purple themed, no circular backgrounds. */}
            <div
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                padding: '40px 16px 14px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
                opacity: showControls || !isPlaying ? 1 : 0,
                transition: 'opacity 200ms ease',
                pointerEvents: showControls || !isPlaying ? 'auto' : 'none',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Timeline */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: 'ui-monospace, monospace', minWidth: 42 }}>
                  {formatTime(currentTime)}
                </span>
                <div style={{ position: 'relative', flex: 1, height: 4 }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(255,255,255,0.25)', borderRadius: 9999,
                  }} />
                  <div style={{
                    position: 'absolute', top: 0, left: 0, height: '100%',
                    width: `${progress}%`,
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
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    className="embed-ctrl-btn"
                  >
                    {isPlaying ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}
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
                background: transparent;
                border: 0;
                padding: 4px;
                color: #fff;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: color 150ms ease, transform 150ms ease;
                filter: drop-shadow(0 0 8px hsl(var(--primary) / 0.5));
              }
              .embed-ctrl-btn:hover { color: hsl(var(--primary)); }
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
      </div>
    </div>
  );
}
