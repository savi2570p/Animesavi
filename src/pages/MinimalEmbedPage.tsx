import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Hls from 'hls.js';
import { supabase } from '@/integrations/supabase/client';
import { extractEmbedSrc, isEmbedLikeUrl } from '@/components/video/PureEmbedPlayer';

/**
 * MinimalEmbedPage — ultra-light, single-iframe (or single <video>) embed.
 *
 * Route: /embed/:animeSlug/:seasonSlug/:episodeSlug
 *
 * Design goals:
 *  - One media element only. No nested iframes. No overlays during playback.
 *  - Loads instantly on iOS Safari (no click-to-load, no autoplay dependency).
 *  - Native browser controls = guaranteed iOS compatibility.
 *
 * Access control (Shadow embed link):
 *  Only the two approved hosts may embed or open this page directly.
 *  All other referrers / hosts get a clean "not authorized" message.
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

/**
 * Decide whether the current load is allowed:
 *  - If running inside an iframe → check the parent's referrer host.
 *  - If opened directly → check the current window host.
 *  - Lovable preview / sandbox hosts are allowed for development only.
 */
function checkEmbedAccess(): boolean {
  if (typeof window === 'undefined') return false;

  const currentHost = window.location.hostname.toLowerCase();

  // Dev/preview escape hatch — never blocks Lovable preview iframes.
  if (currentHost === 'localhost' || currentHost.endsWith('.lovable.app') || currentHost.endsWith('.lovableproject.com')) {
    return true;
  }

  // Direct navigation (top-level): the page itself must be on an allowed host.
  if (window.parent === window) {
    return isHostAllowed(currentHost);
  }

  // Embedded in an iframe: trust the referrer host (best signal browsers expose).
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

export default function MinimalEmbedPage() {
  const { animeSlug, seasonSlug, episodeSlug } = useParams<{
    animeSlug: string;
    seasonSlug: string;
    episodeSlug: string;
  }>();

  const [accessAllowed] = useState<boolean>(() => checkEmbedAccess());
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);


  // Resolve the episode → video URL. One round-trip, three small queries.
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
        const season =
          seasons?.find((s) => s.season_number === seasonNumber) ?? seasons?.[0];
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
    return () => {
      cancelled = true;
    };
  }, [animeSlug, seasonSlug, episodeSlug, accessAllowed]);

  // Decide whether the source should render as an iframe or as <video>.
  // External provider links → single iframe. Direct files / HLS → <video>.
  const useIframe = useMemo(() => (videoUrl ? isEmbedLikeUrl(videoUrl) : false), [videoUrl]);
  const iframeSrc = useMemo(() => (videoUrl ? extractEmbedSrc(videoUrl) : ''), [videoUrl]);

  // HLS / direct file setup (only when we render <video>).
  useEffect(() => {
    if (useIframe || !videoUrl) return;
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHlsUrl(videoUrl)) {
      // Native HLS (Safari / iOS) — preferred path, smallest overhead.
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          maxWidth: '100vw',
          maxHeight: '100vh',
          aspectRatio: '16 / 9',
          background: '#000',
          borderRadius: 0,
          overflow: 'hidden',
        }}
      >
        {/* Subtle loading spinner — shown only until the source is resolved. */}
        {loading && !error && (
          <div
            aria-label="Loading"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                border: '2px solid rgba(255,255,255,0.2)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'embed-spin 0.8s linear infinite',
              }}
            />
            <style>{`@keyframes embed-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.85)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: 14,
              padding: 24,
              textAlign: 'center',
            }}
          >
            Video cannot be played on this device
          </div>
        )}

        {!error && videoUrl && useIframe && (
          // Single, top-level iframe → no nesting, no postMessage handshake,
          // no sandbox (globally stripped). iOS-safe.
          <iframe
            src={iframeSrc}
            title={title || 'Embedded video'}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              border: 0,
              background: '#000',
            }}
          />
        )}

        {!error && videoUrl && !useIframe && (
          <video
            ref={videoRef}
            controls
            playsInline
            // No autoplay → satisfies iOS user-activation rules; user taps play.
            preload="metadata"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              background: '#000',
              objectFit: 'contain',
            }}
            onError={() => setError('Video cannot be played on this device')}
          />
        )}
      </div>
    </div>
  );
}
