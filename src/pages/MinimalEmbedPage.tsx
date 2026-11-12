import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShadowMinimalPlayer } from '@/components/video/ShadowMinimalPlayer';
import Hls from 'hls.js';
import { getHLSConfig } from '@/lib/videoUtils';
import { Play, Pause, Maximize, Minimize } from 'lucide-react';
import { EmbedBrand, EmbedBtn, EmbedCenterPlay, EmbedLoading, EmbedSeek, EmbedStatus, EmbedTime } from '@/components/embed/EmbedChrome';
import { supabase } from '@/integrations/supabase/client';
import { extractEmbedSrc, isEmbedLikeUrl } from '@/components/video/PureEmbedPlayer';
import { useEmbedResume } from '@/hooks/useEmbedResume';

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
 * - Direct files / HLS → native <video> element with the shared Embed Player v3
 *   controls (play/pause, timeline, fullscreen).
 * - External provider links → single top-level iframe, no overlays
 *   (cross-origin makes custom controls impossible — provider's controls are used).
 *
 * Access control: only animesavi.com and shadowflix.lovable.app may embed.
 */

const ALLOWED_EMBED_HOSTS = [
  'shadowflix.lovable.app',
  'animesavi.com',
  'www.animesavi.com',
  'floxanimeindia.in.net',
  'kairoanime.base44.app',
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
  const navigate = useNavigate();

  // Shadow theme = stripped-down embed (no download button).
  const isShadowTheme = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('theme') === 'shadow';

  // Shadow theme bypasses host restrictions — usable from anywhere.
  // Regular /embed/ links remain limited to the allowlisted hosts.
  const [accessAllowed] = useState<boolean>(() => isShadowTheme || checkEmbedAccess());
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [resolvedEpisodeId, setResolvedEpisodeId] = useState<string | null>(null);
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
  const [audioTracks, setAudioTracks] = useState<Array<{ id: number; name: string; lang: string }>>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(0);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
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
          .select('id, title, video_url, external_url, captions_url, audio_language')
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
        setResolvedEpisodeId(ep.id);
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

    setAudioTracks([]);
    setShowAudioMenu(false);
    if (isHlsUrl(videoUrl)) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = videoUrl;
      } else if (Hls.isSupported()) {
        const hls = new Hls(getHLSConfig() as any);
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (hls.audioTracks?.length) {
            setAudioTracks(hls.audioTracks.map((t, i) => ({
              id: i,
              name: t.name || t.lang || `Audio ${i + 1}`,
              lang: t.lang || '',
            })));
            setCurrentAudioTrack(hls.audioTrack);
          }
        });
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, d) => setCurrentAudioTrack(d.id));
        hls.on(Hls.Events.ERROR, (_, data) => {
          // Don't surface transient HLS errors as a blocking "cannot be played" overlay.
          // The native <video onError> will fire for real, unrecoverable failures.
          if (!data.fatal) return;
          if (data.type === 'networkError') {
            try { hls.startLoad(); } catch {}
          }
        });
      } else {
        // No HLS support and no native — leave the player silent; <video onError>
        // (if it triggers) will surface a real failure. Avoid an immediate overlay.
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
    const onLoaded = () => {
      setDuration(v.duration || 0);
      // Native audio track detection (Safari HLS, multi-audio MP4)
      const nativeAudio = (v as any).audioTracks;
      if (nativeAudio && nativeAudio.length && audioTracks.length === 0) {
        const tracks: Array<{ id: number; name: string; lang: string }> = [];
        for (let i = 0; i < nativeAudio.length; i++) {
          const t = nativeAudio[i];
          tracks.push({ id: i, name: t.label || t.language || `Audio ${i + 1}`, lang: t.language || '' });
          if (t.enabled) setCurrentAudioTrack(i);
        }
        setAudioTracks(tracks);
      }
    };
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

  useEmbedResume(videoRef, resolvedEpisodeId, videoUrl, undefined, !useIframe && !isShadowTheme);

  // Track fullscreen state + force layout recalc on orientation change so
  // touch coordinates stay aligned with the visual controls in landscape.
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    const onOrient = () => {
      // Force reflow so 100dvh recomputes against the new viewport
      const el = containerRef.current;
      if (el) {
        el.style.display = 'none';
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.offsetHeight;
        el.style.display = '';
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('orientationchange', onOrient);
    window.addEventListener('resize', onOrient);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('orientationchange', onOrient);
      window.removeEventListener('resize', onOrient);
    };
  }, []);

  // Apply CC enable/disable to the actual TextTrack once metadata loads
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const apply = () => {
      const tracks = v.textTracks;
      for (let i = 0; i < tracks.length; i++) tracks[i].mode = ccEnabled ? 'showing' : 'disabled';
    };
    apply();
    v.addEventListener('loadedmetadata', apply);
    return () => v.removeEventListener('loadedmetadata', apply);
  }, [ccEnabled, captionsUrl]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const switchAudioTrack = useCallback((trackId: number) => {
    if (hlsRef.current && hlsRef.current.audioTracks?.length) {
      hlsRef.current.audioTrack = trackId;
    } else {
      const native = (videoRef.current as any)?.audioTracks;
      if (native && native.length) {
        for (let i = 0; i < native.length; i++) native[i].enabled = i === trackId;
      }
    }
    setCurrentAudioTrack(trackId);
    setShowAudioMenu(false);
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
      <EmbedStatus
        tone="blocked"
        title="Embed not authorised"
        message="This embed is not authorised for this domain."
      />
    );
  }

  // ── Shadow link: identical experience to Shadow link v2 + Episodes button ──
  if (isShadowTheme) {
    return (
      <div className="ep3-page">
        <style>{`html,body,#root{margin:0;padding:0;background:#000;}`}</style>
        <div className="ep3-page-inner">
          {loading ? (
            <div className="ep3-page-player">
              <EmbedStatus tone="loading" brand={false} variant="inline" />
            </div>
          ) : error || !videoUrl ? (
            <div className="ep3-page-player">
              <EmbedStatus tone="error" brand={false} variant="inline" title="Episode not available" />
            </div>
          ) : (
            <>
              <div className="ep3-page-player">
                <ShadowMinimalPlayer
                  key={`${seasonNum}-${currentEpisodeNum}`}
                  resumeEpisodeId={resolvedEpisodeId}
                  videoUrl={useIframe ? null : videoUrl}
                  embedUrl={useIframe ? iframeSrc : null}
                  overlayTitle={animeTitle || title}
                  overlaySeason={seasonNum}
                  overlayEpisode={currentEpisodeNum}
                  episodes={episodeList.map((e) => ({
                    key: String(e.episode_number),
                    number: e.episode_number,
                    title: e.title,
                    seasonNumber: seasonNum,
                    active: e.episode_number === currentEpisodeNum,
                  }))}
                  onSelectEpisode={(key) => {
                    const num = Number(key);
                    if (!num || num === currentEpisodeNum) return;
                    navigate(
                      `/embed/${animeSlug}/${seasonSlug}/episode-${num}?theme=shadow`,
                      { replace: true },
                    );
                  }}
                />
              </div>

              {/* Title row — episode switching lives inside the player */}
              <div className="ep3-page-title">
                <h1>{animeTitle || title}</h1>
                <span>S{seasonNum} · E{currentEpisodeNum}</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const controlsOn = showControls || !isPlaying;

  return (
    <div
      ref={containerRef}
      className="ep3"
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
      <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
        {loading && !error && <EmbedLoading />}

        {error && (
          <EmbedStatus tone="error" variant="overlay" title="Can't play this video" message="Video cannot be played on this device" />
        )}

        {!error && videoUrl && useIframe && (
          <>
            <iframe
              src={iframeSrc}
              title={title || 'Embedded video'}
              className="ep3-frame embed-frame"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              onContextMenu={(e) => e.preventDefault()}
              style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' } as React.CSSProperties}
            />
            <div className="embed-frame-shield" aria-hidden="true" onContextMenu={(e) => e.preventDefault()} />
          </>
        )}

        {!error && videoUrl && !useIframe && (
          <>
            <video
              disablePictureInPicture
              disableRemotePlayback
              {...({ 'x-webkit-airplay': 'deny' } as any)}
              ref={videoRef}
              playsInline
              autoPlay
              preload="auto"
              crossOrigin={captionsUrl ? 'anonymous' : undefined}
              onClick={togglePlay}
              className="ep3-video"
              style={{
                // Avoid transforms — they break touch hit-test in landscape on iOS/Android.
                transform: 'translateZ(0)',
                touchAction: 'manipulation',
              }}
              onError={(e) => {
                // Only flag a real failure when the element actually has an error code
                // AND has tried to load. Avoids spurious "cannot be played" toasts on
                // iOS/Android right after a src swap.
                const v = e.currentTarget;
                if (v.error && v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
                  setError('Video cannot be played on this device');
                }
              }}
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

            <div className="ep3-layer is-pass" data-visible={controlsOn ? 'true' : 'false'}>
              <div className="ep3-top" onClick={(e) => e.stopPropagation()}>
                <div className="ep3-top-info">
                  <EmbedBrand compact />
                  {(animeTitle || title) && (
                    <>
                      <span className="ep3-divider" aria-hidden />
                      <div className="ep3-top-text">
                        <p className="ep3-title">{animeTitle || title}</p>
                        <p className="ep3-sub"><b>S{seasonNum} · E{currentEpisodeNum}</b></p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!isPlaying && !loading && <EmbedCenterPlay onClick={togglePlay} />}

              <div className="ep3-bottom" onClick={(e) => e.stopPropagation()} style={{ touchAction: 'manipulation' }}>
                <EmbedSeek
                  value={isNaN(progress) ? 0 : progress}
                  onChange={(pct) => {
                    const v = videoRef.current;
                    if (!v || !duration) return;
                    v.currentTime = (pct / 100) * duration;
                  }}
                />
                <div className="ep3-bar">
                  <div className="ep3-group">
                    <EmbedBtn label={isPlaying ? 'Pause' : 'Play'} primary onClick={togglePlay}>
                      {isPlaying ? <Pause /> : <Play />}
                    </EmbedBtn>
                    <EmbedTime current={currentTime} duration={duration} />
                  </div>
                  <div className="ep3-group">
                    <EmbedBtn label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen}>
                      {isFullscreen ? <Minimize /> : <Maximize />}
                    </EmbedBtn>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
