import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Loader2, RefreshCw, Settings, Download, List, Gauge,
} from 'lucide-react';
import {
  EmbedBrand, EmbedBtn, EmbedCenterPlay, EmbedEpisodeDrawer, EmbedLoading,
  EmbedMenu, EmbedMenuItem, EmbedMenuLabel, EmbedSeek, EmbedStatus, EmbedTime,
} from '@/components/embed/EmbedChrome';
import Hls from 'hls.js';
import { useEmbedPlayerBridge } from '@/hooks/useEmbedPlayerBridge';
import { useEmbedResume } from '@/hooks/useEmbedResume';
import { getNetworkInfo } from '@/lib/videoUtils';

function getLowBandwidthHlsConfig() {
  const { isSlowNetwork, isCellular, saveData } = getNetworkInfo();
  const slow = isSlowNetwork || saveData;
  return {
    enableWorker: true,
    lowLatencyMode: false,
    startLevel: 0,
    autoStartLoad: true,
    maxBufferLength: slow ? 6 : 12,
    maxMaxBufferLength: slow ? 20 : 60,
    maxBufferSize: slow ? 20 * 1000 * 1000 : 60 * 1000 * 1000,
    backBufferLength: slow ? 8 : 20,
    abrEwmaDefaultEstimate: slow ? 250000 : isCellular ? 1200000 : 2500000,
    abrBandWidthFactor: slow ? 0.6 : 0.8,
    abrBandWidthUpFactor: slow ? 0.4 : 0.6,
    fragLoadingTimeOut: 30000,
    fragLoadingMaxRetry: 8,
    manifestLoadingTimeOut: 15000,
    manifestLoadingMaxRetry: 6,
  };
}

const ALLOWED_DOMAINS = [
  'shadow-arise.lovable.app',
  'crunchysavi.lovable.app',
  'animesavi.lovable.app',
  'animesavi.com',
  'www.animesavi.com',
  'floxanimeindia.in.net',
  'kairoanime.base44.app',
];

const ADMIN_EMAILS = [
  'savi2570p@gmail.com',
  'shadowtoonsindia@gmail.com',
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
  const { animeSlug, seasonSlug, episodeSlug } = useParams<{ animeSlug: string; seasonSlug?: string; episodeSlug?: string }>();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [domainAllowed, setDomainAllowed] = useState<boolean | null>(null);
  const [episodeData, setEpisodeData] = useState<{ title: string; videoUrl: string | null; animeTitle: string } | null>(null);
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
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [audioTracks, setAudioTracks] = useState<{ id: number; name: string; lang: string }[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(0);
  const [captionsUrl, setCaptionsUrl] = useState<string | null>(null);
  const [subtitleTracks, setSubtitleTracks] = useState<{ id: number; name: string; lang: string }[]>([]);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<number>(-1);
  const [ccEnabled, setCcEnabled] = useState(false);
  const [showCcMenu, setShowCcMenu] = useState(false);

  // Episode selection state
  const [allEpisodes, setAllEpisodes] = useState<{ id: string; title: string; episode_number: number; season_number: number; season_id: string; video_url?: string | null; external_url?: string | null; captions_url?: string | null }[]>([]);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [showEpisodePanel, setShowEpisodePanel] = useState(false);
  const [currentSeasonNumber, setCurrentSeasonNumber] = useState(1);
  const [currentEpisodeNumber, setCurrentEpisodeNumber] = useState(1);
  const [resolvedAnimeId, setResolvedAnimeId] = useState<string | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const deviceInfo = detectDeviceInfo();
  const isShadowTheme = searchParams.get('theme') === 'shadow';

  // Domain + admin validation
  useEffect(() => {
    const checkAccess = async () => {
      // Check admin bypass first
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        setDomainAllowed(true); return;
      }

      const referrer = document.referrer;
      const hostname = window.location.hostname;

      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.lovable.app') ||
        hostname.endsWith('.lovable.dev') ||
        hostname.endsWith('.lovableproject.com') ||
        hostname.endsWith('.sandbox.lovable.dev') ||
        ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))
      ) {
        setDomainAllowed(true); return;
      }
      if (referrer) {
        try {
          const refHost = new URL(referrer).hostname;
          if (
            refHost.endsWith('.lovable.app') ||
            refHost.endsWith('.lovableproject.com') ||
            ALLOWED_DOMAINS.some(d => refHost === d || refHost.endsWith('.' + d))
          ) {
            setDomainAllowed(true); return;
          }
        } catch {}
      }
      setDomainAllowed(false);
    };
    checkAccess();
  }, []);

  // Disable right-click + inspect for non-admins
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) return; // Admin bypass

      const handleContextMenu = (e: MouseEvent) => e.preventDefault();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) || (e.ctrlKey && e.key === 'u')) e.preventDefault();
      };
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleKeyDown);
      return () => { document.removeEventListener('contextmenu', handleContextMenu); document.removeEventListener('keydown', handleKeyDown); };
    };
    checkAdmin();
  }, []);

  // Resolve anime slug + season slug + episode slug
  useEffect(() => {
    if (domainAllowed !== true) return;

    const resolveEpisode = async () => {
      if (!animeSlug) { setFetchError('Invalid embed URL'); return; }

      const { data: animeList } = await supabase.from('anime_public').select('id, title');
      if (!animeList) { setFetchError('Failed to load'); return; }

      const anime = animeList.find(a => a.title && createSlug(a.title) === animeSlug);
      if (!anime) { setFetchError('Anime not found'); return; }

      // Parse season and episode from URL params
      let seasonNumber = 1;
      let episodeNumber = 1;

      // Check if seasonSlug is provided (3-segment URL: /embed/:anime/:season/:episode)
      if (seasonSlug && episodeSlug) {
        // seasonSlug: "season-2" or "s2"
        const seasonMatch = seasonSlug.match(/^(?:season-?)?(\d+)$/i) || seasonSlug.match(/^s(\d+)$/i);
        if (seasonMatch) seasonNumber = +seasonMatch[1];

        // episodeSlug: "episode-1" or "e1"
        const epMatch = episodeSlug.match(/^(?:episode-?)?(\d+)$/i) || episodeSlug.match(/^e(\d+)$/i);
        if (epMatch) episodeNumber = +epMatch[1];
      } else if (episodeSlug && !seasonSlug) {
        // 2-segment URL: /embed/:anime/:episodeSlug
        // episodeSlug can be: "season-2-episode-3", "s2e3", "episode-5"
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
        .from('episodes').select('id, title, video_url, external_url, captions_url')
        .eq('season_id', targetSeason.id).eq('episode_number', episodeNumber).single();

      if (!ep) { setFetchError(`S${seasonNumber}E${episodeNumber} not found`); return; }

      const url = ep.video_url || ep.external_url;
      if (!url) { setFetchError('No video available'); return; }

      setEpisodeData({ title: ep.title, videoUrl: url, animeTitle: anime.title || '' });
      setCaptionsUrl(ep.captions_url || null);
      setResolvedAnimeId(anime.id || null);
      setCurrentSeasonNumber(seasonNumber);
      setCurrentEpisodeNumber(episodeNumber);

      // Fetch all episodes for episode selector — prefetch video URLs in parallel for instant switching
      const seasonResults = await Promise.all(
        seasons.map((s) =>
          supabase
            .from('episodes')
            .select('id, title, episode_number, video_url, external_url, captions_url')
            .eq('season_id', s.id)
            .order('episode_number')
            .then(({ data }) => ({ s, eps: data || [] }))
        )
      );
      const allEps: typeof allEpisodes = [];
      seasonResults.forEach(({ s, eps }) => {
        allEps.push(
          ...eps.map((e: any) => ({
            id: e.id,
            title: e.title,
            episode_number: e.episode_number,
            season_number: s.season_number,
            season_id: s.id,
            video_url: e.video_url,
            external_url: e.external_url,
            captions_url: e.captions_url,
          })) as any
        );
      });
      setAllEpisodes(allEps as any);
      const idx = allEps.findIndex(e => e.episode_number === episodeNumber && e.season_number === seasonNumber);
      setCurrentEpisodeIndex(idx >= 0 ? idx : 0);
    };

    resolveEpisode();
  }, [animeSlug, seasonSlug, episodeSlug, domainAllowed]);

  // Switch episode handler — uses prefetched URLs for instant switching
  const switchToEpisode = useCallback(async (ep: typeof allEpisodes[0]) => {
    setShowEpisodePanel(false);

    // Tear down current playback IMMEDIATELY for snappy UI response
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (videoRef.current) { try { videoRef.current.pause(); videoRef.current.removeAttribute('src'); videoRef.current.load(); } catch {} }

    setSubtitleTracks([]);
    setAudioTracks([]);
    setError(null);

    let url = ep.video_url || ep.external_url || null;
    let captions = ep.captions_url || null;
    let title = ep.title;

    // Fallback: fetch only if prefetched data is missing
    if (!url) {
      setIsLoading(true);
      const { data } = await supabase.from('episodes').select('video_url, external_url, title, captions_url').eq('id', ep.id).single();
      if (!data) { setError('Episode failed to load'); return; }
      url = data.video_url || data.external_url;
      captions = data.captions_url;
      title = data.title;
    }
    if (!url) { setError('No video available'); return; }

    setEpisodeData(prev => ({ title, videoUrl: url!, animeTitle: prev?.animeTitle || '' }));
    setCaptionsUrl(captions);
    setCurrentSeasonNumber(ep.season_number);
    setCurrentEpisodeNumber(ep.episode_number);
    const idx = allEpisodes.findIndex(e => e.id === ep.id);
    if (idx >= 0) setCurrentEpisodeIndex(idx);
  }, [allEpisodes]);

  // 📝 Save watch history from slug embed player → main "/" Continue Watching
  const currentEpisodeId = allEpisodes[currentEpisodeIndex]?.id;
  useEffect(() => {
    if (!currentEpisodeId || !resolvedAnimeId) return;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      intervalId = setInterval(async () => {
        const v = videoRef.current;
        if (!v || !v.duration || v.paused || v.currentTime <= 0) return;
        const pct = (v.currentTime / v.duration) * 100;
        const completed = pct >= 90;
        await supabase.from('watch_history').upsert({
          user_id: user.id,
          anime_id: resolvedAnimeId,
          episode_id: currentEpisodeId,
          progress: Math.floor(pct),
          completed,
          completed_at: completed ? new Date().toISOString() : null,
          last_position: Math.floor(completed ? v.duration : v.currentTime),
          duration: Math.floor(v.duration),
          watched_at: new Date().toISOString(),
        }, { onConflict: 'user_id,episode_id', ignoreDuplicates: false });
      }, 10000);
    })();
    return () => { cancelled = true; if (intervalId) clearInterval(intervalId); };
  }, [currentEpisodeId, resolvedAnimeId]);

  // Keyboard shortcuts (Space, F, M)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (videoRef.current) isPlaying ? videoRef.current.pause() : videoRef.current.play();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'k':
          e.preventDefault();
          if (videoRef.current) isPlaying ? videoRef.current.pause() : videoRef.current.play();
          break;
        case ',':
          e.preventDefault();
          setPlaybackSpeed((s) => Math.max(0.5, +(s - 0.25).toFixed(2)));
          break;
        case '.':
          e.preventDefault();
          setPlaybackSpeed((s) => Math.min(2, +(s + 0.25).toFixed(2)));
          break;
        case 'arrowright':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
          break;
        case 'arrowleft':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPlaying, duration]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed, episodeData?.videoUrl]);

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
        const hls = new Hls(getLowBandwidthHlsConfig());
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          if (data.levels?.length > 0) {
            setHlsLevels(data.levels.map((l, i) => ({
              id: i, height: l.height,
              label: l.height >= 2160 ? '4K' : l.height >= 1080 ? '1080p' : l.height >= 720 ? '720p' : l.height >= 480 ? '480p' : `${l.height}p`
            })));
          }
          if (hls.audioTracks?.length) {
            setAudioTracks(hls.audioTracks.map((t, i) => ({
              id: i, name: t.name || t.lang || `Audio ${i + 1}`, lang: t.lang || ''
            })));
            setCurrentAudioTrack(hls.audioTrack);
          }
          if (hls.subtitleTracks?.length) {
            setSubtitleTracks(hls.subtitleTracks.map((t, i) => ({
              id: i, name: t.name || t.lang || `Subtitle ${i + 1}`, lang: t.lang || ''
            })));
          }
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => setCurrentLevel(data.level));
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, data) => setCurrentAudioTrack(data.id));
        hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_, data) => setCurrentSubtitleTrack(data.id));
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) return;
          if (data.type === 'networkError') { try { hls.startLoad(); } catch {} return; }
          if (data.type === 'mediaError') { try { hls.recoverMediaError(); } catch {} return; }
        });
      }
    } else {
      video.src = videoUrl;
    }

    const onCanPlay = () => { setIsLoading(false); video.play().catch(() => {}); };
    const onError = (e: Event) => {
      setIsLoading(false);
      const v = e.currentTarget as HTMLVideoElement;
      if (v?.error && v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        setError('Video failed to load');
      }
    };
    const onLoadedMeta = () => {
      const nativeAudio = (video as any).audioTracks;
      if (nativeAudio && nativeAudio.length && audioTracks.length === 0) {
        const tracks: { id: number; name: string; lang: string }[] = [];
        for (let i = 0; i < nativeAudio.length; i++) {
          const t = nativeAudio[i];
          tracks.push({ id: i, name: t.label || t.language || `Audio ${i + 1}`, lang: t.language || '' });
          if (t.enabled) setCurrentAudioTrack(i);
        }
        setAudioTracks(tracks);
      }
      const tt = video.textTracks;
      if (tt && tt.length > 0 && subtitleTracks.length === 0) {
        const tracks: { id: number; name: string; lang: string }[] = [];
        for (let i = 0; i < tt.length; i++) {
          const track = tt[i];
          if (track.kind === 'subtitles' || track.kind === 'captions') {
            tracks.push({ id: i, name: track.label || track.language || `Subtitle ${i + 1}`, lang: track.language || '' });
          }
        }
        if (tracks.length) setSubtitleTracks(tracks);
      }
    };

    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadedmetadata', onLoadedMeta);
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
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      video.removeEventListener('error', onError);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [episodeData?.videoUrl]);

  useEmbedResume(videoRef, currentEpisodeId, episodeData?.videoUrl);

  // Apply CC enable state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (hlsRef.current && hlsRef.current.subtitleTracks?.length) {
      hlsRef.current.subtitleDisplay = ccEnabled;
      if (ccEnabled && currentSubtitleTrack < 0) {
        hlsRef.current.subtitleTrack = 0;
        setCurrentSubtitleTrack(0);
      } else if (!ccEnabled) {
        hlsRef.current.subtitleTrack = -1;
      }
    }
    const tt = video.textTracks;
    if (tt) {
      for (let i = 0; i < tt.length; i++) {
        tt[i].mode = ccEnabled ? (i === Math.max(0, currentSubtitleTrack) ? 'showing' : 'disabled') : 'disabled';
      }
    }
  }, [ccEnabled, currentSubtitleTrack, captionsUrl, episodeData?.videoUrl]);

  // Controls
  const togglePlay = () => (isPlaying ? videoRef.current?.pause() : videoRef.current?.play());
  const toggleMute = () => { if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); } };
  const skipForward = useCallback(() => {
    if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
  }, [duration]);

  const switchAudioTrack = (trackId: number) => {
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
  };

  const changePlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    setShowSpeedMenu(false);
  };

  const handleDirectDownload = (quality: string) => {
    const url = episodeData?.videoUrl;
    if (!url) return;
    setIsDownloading(quality);
    setShowDownloadMenu(false);

    // Route through the cinematic /Shadow-Arise landing page so the user
    // gets the proper preparation UI + auto-download with a clean filename.
    const animeName = episodeData?.animeTitle || 'AnimeSavi';
    const epNum = String(currentEpisodeNumber || 1).padStart(2, '0');
    const params = new URLSearchParams({
      quality,
      anime: animeName,
      ep: epNum,
      url,
    });
    const target = `/Shadow-Arise?${params.toString()}`;
    window.open(target, '_blank', 'noopener');

    setIsDownloading(null);
  };

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

  const play = useCallback(() => {
    void videoRef.current?.play();
  }, []);
  const pause = useCallback(() => videoRef.current?.pause(), []);
  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(time, duration));
    }
  }, [duration]);
  const getPlaybackState = useCallback(() => ({
    currentTime,
    duration,
    isPlaying,
    isMuted,
    isFullscreen,
    readyState: videoRef.current?.readyState ?? 0,
  }), [currentTime, duration, isFullscreen, isMuted, isPlaying]);

  useEmbedPlayerBridge({
    videoRef,
    getPlaybackState,
    play,
    pause,
    togglePlay,
    seek,
    toggleFullscreen,
    errorReason: error,
  });

  const closeAllMenus = () => { setShowQualityMenu(false); setShowDownloadMenu(false); setShowAudioMenu(false); setShowEpisodePanel(false); setShowSpeedMenu(false); setShowCcMenu(false); };

  useEffect(() => {
    const h = () => setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', h);
    document.addEventListener('webkitfullscreenchange', h);
    return () => { document.removeEventListener('fullscreenchange', h); document.removeEventListener('webkitfullscreenchange', h); };
  }, []);

  // Auto-hide controls after 3s
  useEffect(() => {
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowQualityMenu(false);
        setShowDownloadMenu(false);
        setShowAudioMenu(false);
        setShowSpeedMenu(false);
      }, 3000);
    }
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [isPlaying, showControls]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      setShowQualityMenu(false);
      setShowDownloadMenu(false);
      setShowAudioMenu(false);
      setShowSpeedMenu(false);
    }, 3000);
  }, [isPlaying]);

  const formatTime = (s: number) => {
    if (isNaN(s) || !isFinite(s)) return '0:00';
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    return hrs > 0 ? `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Mobile compact sizes
  const btnSize = deviceInfo.isMobile ? 'w-5 h-5' : 'w-8 h-8';
  const iconSize = deviceInfo.isMobile ? 'w-[11px] h-[11px]' : 'w-[18px] h-[18px]';
  const gapSize = deviceInfo.isMobile ? 'gap-1' : 'gap-2';
  // Flat icon-only buttons (no circles, no glassy chip), works for both themes.
  const controlButtonClass = `${btnSize} flex items-center justify-center transition-colors text-white/90 hover:text-white`;

  // Blocked domain
  if (domainAllowed === false) {
    return (
      <EmbedStatus
        tone="blocked"
        title="Playback restricted"
        message="This player only works on authorised websites. Watch the episode on AnimeSavi+ instead."
      >
        <a href="https://animesavi.lovable.app" target="_blank" rel="noopener noreferrer" className="ep3-cta">
          Open AnimeSavi+
        </a>
      </EmbedStatus>
    );
  }

  if (domainAllowed === null || (!episodeData && !fetchError)) {
    return <EmbedStatus tone="loading" />;
  }

  if (fetchError) {
    return <EmbedStatus tone="error" title="Episode unavailable" message={fetchError} />;
  }

  if (error) {
    return (
      <EmbedStatus tone="error" title="Playback error" message={error}>
        <button type="button" className="ep3-cta" onClick={() => { setError(null); setIsLoading(true); videoRef.current?.load(); }}>
          <RefreshCw /> Retry
        </button>
      </EmbedStatus>
    );
  }

  const seasonCount = new Set(allEpisodes.map((e) => e.season_number)).size;

  return (
    <div
      ref={containerRef}
      className="ep3 ep3-root"
      onMouseMove={handleMouseMove}
      onTouchStart={() => setShowControls(true)}
      onClick={(e) => { if (!(e.target as HTMLElement).closest('.controls-area')) { togglePlay(); closeAllMenus(); } }}
    >
      {/* Prefetch next episode's video + captions so the next switch is near-instant */}
      {(() => {
        const next = allEpisodes[currentEpisodeIndex + 1];
        const nextUrl = next?.video_url || next?.external_url;
        const nextCaps = next?.captions_url;
        return (
          <>
            {nextUrl && <link rel="prefetch" href={nextUrl} as="fetch" crossOrigin="anonymous" />}
            {nextCaps && <link rel="prefetch" href={nextCaps} as="fetch" crossOrigin="anonymous" />}
          </>
        );
      })()}

      <video
        disablePictureInPicture
        disableRemotePlayback
        {...({ 'x-webkit-airplay': 'deny' } as any)}
        ref={videoRef}
        className="ep3-video"
        autoPlay playsInline muted preload="auto"
        controlsList="nodownload noremoteplayback"
        crossOrigin={captionsUrl ? 'anonymous' : undefined}
      >
        {captionsUrl && (
          <track kind="subtitles" src={captionsUrl} srcLang="en" label="English" default />
        )}
      </video>

      {(isLoading || isBuffering) && (
        <EmbedLoading
          title={isLoading ? episodeData.title : undefined}
          label={isLoading ? `S${currentSeasonNumber} · E${currentEpisodeNumber} · Loading` : 'Buffering'}
        />
      )}

      <div
        className="controls-area ep3-layer"
        data-visible={showControls ? 'true' : 'false'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ep3-top">
          <div className="ep3-top-info">
            <EmbedBrand compact />
            <span className="ep3-divider" aria-hidden />
            <div className="ep3-top-text">
              <p className="ep3-title">{episodeData.animeTitle || episodeData.title}</p>
              <p className="ep3-sub">
                <b>S{currentSeasonNumber} · E{currentEpisodeNumber}</b>
                {episodeData.animeTitle && episodeData.title ? ` · ${episodeData.title}` : ''}
              </p>
            </div>
          </div>
          {allEpisodes.length > 1 && (
            <button
              type="button"
              className="ep3-chip-btn"
              data-active={showEpisodePanel ? 'true' : undefined}
              aria-expanded={showEpisodePanel}
              onClick={(e) => { e.stopPropagation(); closeAllMenus(); setShowEpisodePanel(!showEpisodePanel); }}
            >
              <List /> Episodes
            </button>
          )}
        </div>

        {!isPlaying && !isLoading && !isBuffering && <EmbedCenterPlay onClick={togglePlay} />}

        <div className="ep3-bottom">
          <EmbedSeek
            value={isNaN(progress) ? 0 : progress}
            buffered={bufferedProgress}
            onChange={(val) => {
              if (videoRef.current && duration) videoRef.current.currentTime = (val / 100) * duration;
            }}
          />
          <div className="ep3-bar">
            <div className="ep3-group">
              <EmbedBtn label={isPlaying ? 'Pause' : 'Play'} primary onClick={togglePlay}>
                {isPlaying ? <Pause /> : <Play />}
              </EmbedBtn>
              <EmbedBtn label={isMuted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
                {isMuted ? <VolumeX /> : <Volume2 />}
              </EmbedBtn>
              <EmbedTime current={currentTime} duration={duration} />
            </div>

            <div className="ep3-group">
              {hlsLevels.length > 0 && (
                <div className="ep3-anchor">
                  <EmbedBtn
                    label="Quality"
                    active={showQualityMenu}
                    onClick={(e) => { e.stopPropagation(); closeAllMenus(); setShowQualityMenu(!showQualityMenu); }}
                  >
                    <Settings />
                  </EmbedBtn>
                  {showQualityMenu && (
                    <EmbedMenu label="Quality">
                      <EmbedMenuLabel>Quality</EmbedMenuLabel>
                      <EmbedMenuItem
                        active={currentLevel === -1}
                        onClick={() => { if (hlsRef.current) hlsRef.current.currentLevel = -1; setCurrentLevel(-1); setShowQualityMenu(false); }}
                      >
                        Auto
                      </EmbedMenuItem>
                      {hlsLevels.map((l) => (
                        <EmbedMenuItem
                          key={l.id}
                          active={currentLevel === l.id}
                          onClick={() => { if (hlsRef.current) hlsRef.current.currentLevel = l.id; setCurrentLevel(l.id); setShowQualityMenu(false); }}
                        >
                          {l.label}
                        </EmbedMenuItem>
                      ))}
                    </EmbedMenu>
                  )}
                </div>
              )}

              <div className="ep3-anchor">
                <EmbedBtn
                  label="Download"
                  active={showDownloadMenu}
                  onClick={(e) => { e.stopPropagation(); closeAllMenus(); setShowDownloadMenu(!showDownloadMenu); }}
                >
                  {isDownloading ? <Loader2 className="animate-spin" /> : <Download />}
                </EmbedBtn>
                {showDownloadMenu && (
                  <EmbedMenu label="Download">
                    <EmbedMenuLabel>Download</EmbedMenuLabel>
                    {['480p', '720p', '1080p', '2160p (4K)'].map((q) => (
                      <EmbedMenuItem
                        key={q}
                        disabled={!!isDownloading}
                        onClick={(e) => { e.stopPropagation(); handleDirectDownload(q); }}
                        hint={isDownloading === q ? 'Saving' : undefined}
                      >
                        {q}
                      </EmbedMenuItem>
                    ))}
                  </EmbedMenu>
                )}
              </div>

              <div className="ep3-anchor">
                <EmbedBtn
                  label="Playback speed"
                  active={showSpeedMenu}
                  onClick={(e) => { e.stopPropagation(); closeAllMenus(); setShowSpeedMenu(!showSpeedMenu); }}
                >
                  <Gauge />
                </EmbedBtn>
                {showSpeedMenu && (
                  <EmbedMenu label="Playback speed">
                    <EmbedMenuLabel>Speed</EmbedMenuLabel>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                      <EmbedMenuItem
                        key={speed}
                        active={playbackSpeed === speed}
                        onClick={(e) => { e.stopPropagation(); changePlaybackSpeed(speed); }}
                      >
                        {speed === 1 ? 'Normal' : `${speed}x`}
                      </EmbedMenuItem>
                    ))}
                  </EmbedMenu>
                )}
              </div>

              <EmbedBtn label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize /> : <Maximize />}
              </EmbedBtn>
            </div>
          </div>
        </div>
      </div>

      {showEpisodePanel && (
        <EmbedEpisodeDrawer
          heading={episodeData.animeTitle || 'Episodes'}
          subheading={`${allEpisodes.length} episodes${seasonCount > 1 ? ` · ${seasonCount} seasons` : ''}`}
          items={allEpisodes.map((ep, idx) => ({
            key: ep.id,
            number: ep.episode_number,
            title: ep.title,
            seasonNumber: ep.season_number,
            active: idx === currentEpisodeIndex,
          }))}
          onSelect={(item) => {
            const ep = allEpisodes.find((e) => e.id === item.key);
            if (ep) void switchToEpisode(ep);
          }}
          onClose={() => setShowEpisodePanel(false)}
        />
      )}
    </div>
  );
}
