import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Play, Pause, Volume2, VolumeX, Maximize,
  SkipForward, Loader2, AlertTriangle, RefreshCw,
  Settings, Check, ShieldAlert, Download
} from 'lucide-react';
import Hls from 'hls.js';

const ALLOWED_ORIGINS = [
  'https://crunchysavi.lovable.app',
  'https://animesavi.lovable.app',
];

function isHlsUrl(url: string | null): boolean {
  if (!url) return false;
  return /\.m3u8(\?.*)?$/i.test(url) || url.includes('.m3u8');
}

function detectDeviceInfo() {
  if (typeof window === 'undefined') return { isMobile: false, isIOS: false };
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isMobile = isIOS || /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return { isMobile, isIOS };
}

const createSlug = (title: string): string =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function EmbedSlugPlayer() {
  const { animeSlug, episodeSlug } = useParams<{ animeSlug: string; episodeSlug?: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [domainAllowed, setDomainAllowed] = useState<boolean | null>(null);
  const [episodeData, setEpisodeData] = useState<{ title: string; videoUrl: string | null } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hlsLevels, setHlsLevels] = useState<{ id: number; height: number; label: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const deviceInfo = detectDeviceInfo();

  // Domain validation
  useEffect(() => {
    const referrer = document.referrer;
    const isInIframe = window.self !== window.top;

    // Allow if opened from an allowed origin via referrer
    if (referrer && ALLOWED_ORIGINS.some(origin => referrer.startsWith(origin))) {
      setDomainAllowed(true);
      return;
    }

    // Allow if same-origin direct access (for development/testing on animesavi itself)
    if (!isInIframe && window.location.origin === 'https://animesavi.lovable.app') {
      setDomainAllowed(true);
      return;
    }

    // Allow for local development
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('lovable.app')) {
      setDomainAllowed(true);
      return;
    }

    // Block everything else
    setDomainAllowed(false);
  }, []);

  // Disable right-click and inspect shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || (e.ctrlKey && e.shiftKey && e.key === 'J')) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Resolve anime slug + episode slug to video URL
  useEffect(() => {
    if (domainAllowed !== true) return;

    const resolveEpisode = async () => {
      if (!animeSlug) { setFetchError('Invalid embed URL'); return; }

      const { data: animeList } = await supabase.from('anime_public').select('id, title');
      if (!animeList) { setFetchError('Failed to load'); return; }

      const anime = animeList.find(a => a.title && createSlug(a.title) === animeSlug);
      if (!anime) { setFetchError('Anime not found'); return; }

      // Parse episode slug
      let seasonNumber = 1;
      let episodeNumber = 1;

      if (episodeSlug) {
        const fullMatch = episodeSlug.match(/^season-(\d+)-episode-(\d+)$/i);
        const shortMatch = episodeSlug.match(/^s(\d+)-?e(\d+)$/i);
        const epOnly = episodeSlug.match(/^episode-(\d+)$/i);

        if (fullMatch) { seasonNumber = +fullMatch[1]; episodeNumber = +fullMatch[2]; }
        else if (shortMatch) { seasonNumber = +shortMatch[1]; episodeNumber = +shortMatch[2]; }
        else if (epOnly) { episodeNumber = +epOnly[1]; }
      }

      const { data: seasons } = await supabase
        .from('seasons').select('id, season_number')
        .eq('anime_id', anime.id).order('season_number');

      if (!seasons?.length) { setFetchError('No episodes available'); return; }

      const targetSeason = seasons.find(s => s.season_number === seasonNumber) || seasons[0];

      const { data: ep } = await supabase
        .from('episodes').select('id, title, video_url, external_url')
        .eq('season_id', targetSeason.id).eq('episode_number', episodeNumber).single();

      if (!ep) { setFetchError('Episode not found'); return; }

      const url = ep.video_url || ep.external_url;
      if (!url) { setFetchError('No video available'); return; }

      setEpisodeData({ title: ep.title, videoUrl: url });
    };

    resolveEpisode();
  }, [animeSlug, episodeSlug, domainAllowed]);

  // Video playback setup
  useEffect(() => {
    const video = videoRef.current;
    const videoUrl = episodeData?.videoUrl;
    if (!video || !videoUrl) return;

    setIsLoading(true);
    setError(null);

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    video.muted = true;
    setIsMuted(true);

    if (isHlsUrl(videoUrl)) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = videoUrl;
      } else if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true, startLevel: 0, maxBufferLength: 10 });
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          if (data.levels?.length > 0) {
            setHlsLevels(data.levels.map((l, i) => ({
              id: i, height: l.height,
              label: l.height >= 2160 ? '4K' : l.height >= 1080 ? '1080p' : l.height >= 720 ? '720p' : `${l.height}p`
            })));
          }
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => setCurrentLevel(data.level));
        hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) setError('Playback error'); });
      }
    } else {
      video.src = videoUrl;
    }

    const onCanPlay = () => { setIsLoading(false); video.play().catch(() => {}); };
    const onError = () => { setIsLoading(false); setError('Video failed to load'); };

    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('play', () => setIsPlaying(true));
    video.addEventListener('pause', () => setIsPlaying(false));
    video.addEventListener('waiting', () => setIsBuffering(true));
    video.addEventListener('playing', () => setIsBuffering(false));
    video.addEventListener('timeupdate', () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
      setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
    });
    video.addEventListener('progress', () => {
      if (video.buffered.length > 0) {
        setBufferedProgress(video.duration ? (video.buffered.end(video.buffered.length - 1) / video.duration) * 100 : 0);
      }
    });
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [episodeData?.videoUrl]);

  // Controls
  const togglePlay = () => (isPlaying ? videoRef.current?.pause() : videoRef.current?.play());
  const toggleMute = () => { if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); } };
  const skipForward = useCallback(() => {
    if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
  }, [duration]);

  const toggleFullscreen = async () => {
    const c = containerRef.current;
    if (!c) return;
    try {
      const isFS = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (isFS) {
        document.exitFullscreen?.() || (document as any).webkitExitFullscreen?.();
      } else {
        if (deviceInfo.isIOS && videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
          (videoRef.current as any).webkitEnterFullscreen(); return;
        }
        c.requestFullscreen?.() || (c as any).webkitRequestFullscreen?.();
      }
    } catch {}
  };

  useEffect(() => {
    const h = () => setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', h);
    document.addEventListener('webkitfullscreenchange', h);
    return () => { document.removeEventListener('fullscreenchange', h); document.removeEventListener('webkitfullscreenchange', h); };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => { setShowControls(false); setShowQualityMenu(false); }, 3000);
    }
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [isPlaying, showControls]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) controlsTimeoutRef.current = setTimeout(() => { setShowControls(false); setShowQualityMenu(false); }, 3000);
  }, [isPlaying]);

  const formatTime = (s: number) => {
    if (isNaN(s) || !isFinite(s)) return '0:00';
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    return hrs > 0 ? `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Blocked domain screen
  if (domainAllowed === false) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h2 className="text-white text-xl font-bold">Playback Restricted</h2>
        <p className="text-white/70 max-w-md">
          {document.referrer
            ? 'Embedded playback is restricted. This player can only be used on CrunchySavi.'
            : 'Direct playback not allowed. Please watch from CrunchySavi.'}
        </p>
        <a
          href="https://crunchysavi.lovable.app"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Go to CrunchySavi
        </a>
      </div>
    );
  }

  if (domainAllowed === null) {
    return <div className="fixed inset-0 bg-black flex items-center justify-center"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;
  }

  if (fetchError) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 p-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <p className="text-white text-lg text-center">{fetchError}</p>
      </div>
    );
  }

  if (!episodeData) {
    return <div className="fixed inset-0 bg-black flex items-center justify-center"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive" />
        <h2 className="text-white text-xl font-bold">Playback Error</h2>
        <p className="text-white/80 max-w-md">{error}</p>
        <button onClick={() => { setError(null); setIsLoading(true); videoRef.current?.load(); }}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          <RefreshCw className="w-5 h-5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black"
      onMouseMove={handleMouseMove}
      onTouchStart={() => setShowControls(true)}
      onClick={(e) => { if (!(e.target as HTMLElement).closest('.controls-area')) togglePlay(); }}
    >
      {(isLoading || isBuffering) && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay playsInline muted preload="auto"
        controlsList="nodownload noremoteplayback"
      />

      {/* Controls */}
      <div
        className={`controls-area absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-20 pb-3 px-4">
          {/* Progress bar */}
          <div className="relative w-full h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = ((e.clientX - rect.left) / rect.width) * 100;
              if (videoRef.current && duration) videoRef.current.currentTime = (pct / 100) * duration;
            }}>
            <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full" style={{ width: `${bufferedProgress}%` }} />
            <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${progress}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${progress}%`, marginLeft: '-7px' }} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button onClick={togglePlay} className="text-white hover:text-primary transition-colors p-1">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button onClick={skipForward} className="text-white hover:text-primary transition-colors p-1">
                <SkipForward className="w-5 h-5" />
              </button>
              <button onClick={toggleMute} className="text-white hover:text-primary transition-colors p-1">
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <span className="text-white/80 text-xs ml-1">{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Quality */}
              {hlsLevels.length > 0 && (
                <div className="relative">
                  <button onClick={() => setShowQualityMenu(!showQualityMenu)} className="text-white hover:text-primary transition-colors p-1">
                    <Settings className="w-5 h-5" />
                  </button>
                  {showQualityMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/95 border border-white/10 rounded-lg p-1 min-w-[120px]">
                      <button onClick={() => { if (hlsRef.current) hlsRef.current.currentLevel = -1; setCurrentLevel(-1); setShowQualityMenu(false); }}
                        className={`w-full text-left px-3 py-1.5 text-sm rounded ${currentLevel === -1 ? 'text-primary' : 'text-white/80'} hover:bg-white/10 flex items-center gap-2`}>
                        {currentLevel === -1 && <Check className="w-3 h-3" />} Auto
                      </button>
                      {hlsLevels.map(l => (
                        <button key={l.id} onClick={() => { if (hlsRef.current) hlsRef.current.currentLevel = l.id; setCurrentLevel(l.id); setShowQualityMenu(false); }}
                          className={`w-full text-left px-3 py-1.5 text-sm rounded ${currentLevel === l.id ? 'text-primary' : 'text-white/80'} hover:bg-white/10 flex items-center gap-2`}>
                          {currentLevel === l.id && <Check className="w-3 h-3" />} {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button onClick={toggleFullscreen} className="text-white hover:text-primary transition-colors p-1">
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Center play button when paused */}
      {!isPlaying && !isLoading && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
        </div>
      )}
    </div>
  );
}
