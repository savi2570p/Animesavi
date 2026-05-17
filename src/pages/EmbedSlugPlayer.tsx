import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Play, Pause, Volume2, VolumeX, Maximize,
  SkipForward, Loader2, AlertTriangle, RefreshCw,
  Settings, Check, ShieldAlert, Download, Headphones,
  List, ChevronRight, X, Gauge
} from 'lucide-react';
import { Captions, CaptionsOff } from 'lucide-react';
import Hls from 'hls.js';
import { useEmbedPlayerBridge } from '@/hooks/useEmbedPlayerBridge';
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
  const [allEpisodes, setAllEpisodes] = useState<{ id: string; title: string; episode_number: number; season_number: number; season_id: string }[]>([]);
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

      if (hostname === 'localhost' || ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
        setDomainAllowed(true); return;
      }
      if (referrer) {
        try {
          const refHost = new URL(referrer).hostname;
          if (ALLOWED_DOMAINS.some(d => refHost === d || refHost.endsWith('.' + d))) {
            setDomainAllowed(true); return;
          }
        } catch {}
      }
      // Allow lovable.app preview domains
      if (hostname.includes('lovable.app')) {
        setDomainAllowed(true); return;
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

  // Switch episode handler
  const switchToEpisode = useCallback(async (ep: typeof allEpisodes[0]) => {
    setShowEpisodePanel(false);
    setIsLoading(true);
    setError(null);
    const { data } = await supabase.from('episodes').select('video_url, external_url, title, captions_url').eq('id', ep.id).single();
    if (!data) { setError('Episode failed to load'); return; }
    const url = data.video_url || data.external_url;
    if (!url) { setError('No video available'); return; }
    setEpisodeData(prev => ({ title: data.title, videoUrl: url, animeTitle: prev?.animeTitle || '' }));
    setCaptionsUrl(data.captions_url || null);
    setSubtitleTracks([]);
    setAudioTracks([]);
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
      await supabase.from('watch_history').upsert({
        user_id: user.id,
        anime_id: resolvedAnimeId,
        episode_id: currentEpisodeId,
        progress: 0,
        completed: false,
        watched_at: new Date().toISOString(),
      }, { onConflict: 'user_id,anime_id', ignoreDuplicates: false });
      intervalId = setInterval(async () => {
        const v = videoRef.current;
        if (!v || !v.duration) return;
        const pct = (v.currentTime / v.duration) * 100;
        await supabase.from('watch_history').upsert({
          user_id: user.id,
          anime_id: resolvedAnimeId,
          episode_id: currentEpisodeId,
          progress: Math.floor(pct),
          completed: pct >= 90,
          watched_at: new Date().toISOString(),
        }, { onConflict: 'user_id,anime_id', ignoreDuplicates: false });
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
          if (hls.audioTracks?.length > 1) {
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
        hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) setError('Playback error'); });
      }
    } else {
      video.src = videoUrl;
    }

    const onCanPlay = () => { setIsLoading(false); video.play().catch(() => {}); };
    const onError = () => { setIsLoading(false); setError('Video failed to load'); };
    const onLoadedMeta = () => {
      const nativeAudio = (video as any).audioTracks;
      if (nativeAudio && nativeAudio.length > 1 && audioTracks.length === 0) {
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
  const btnSize = deviceInfo.isMobile ? 'w-[28px] h-[28px]' : 'w-9 h-9';
  const iconSize = deviceInfo.isMobile ? 'w-[14px] h-[14px]' : 'w-5 h-5';
  const gapSize = deviceInfo.isMobile ? 'gap-[5px]' : 'gap-2';
  const controlButtonClass = `${btnSize} rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-90 ${isShadowTheme ? 'bg-primary/20 border border-primary/30 text-white hover:bg-primary/80 shadow-lg shadow-primary/20' : 'text-white hover:text-primary'}`;

  // Blocked domain
  if (domainAllowed === false) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 p-6 text-center select-none" style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}>
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h2 className="text-white text-xl font-bold">Playback Restricted</h2>
        <p className="text-white/70 max-w-md">These links are restricted only for authorized websites. For more visit</p>
        <a href="https://animesavi.lovable.app" target="_blank" rel="noopener noreferrer"
          className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold text-lg">
          AnimeSavi
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
      onClick={(e) => { if (!(e.target as HTMLElement).closest('.controls-area')) { togglePlay(); closeAllMenus(); } }}
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
        crossOrigin={captionsUrl ? 'anonymous' : undefined}
      >
        {captionsUrl && (
          <track kind="subtitles" src={captionsUrl} srcLang="en" label="English" default />
        )}
      </video>

      {/* Controls */}
      <div
        className={`controls-area absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title + Episode selector button */}
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate">
              <span className="text-primary">S{currentSeasonNumber} E{currentEpisodeNumber}</span>
              <span className="mx-1.5 text-white/40">•</span>
              {episodeData.title}
            </p>
          </div>
          {allEpisodes.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowEpisodePanel(!showEpisodePanel); closeAllMenus(); }}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium transition-colors ml-2 shrink-0"
            >
              <List className="w-3 h-3" /> Episodes
            </button>
          )}
        </div>

        {/* Episode panel - slides from right */}
        {showEpisodePanel && (
          <>
            <div className="absolute inset-0 z-40 bg-black/60" onClick={(e) => { e.stopPropagation(); setShowEpisodePanel(false); }} />
            <div
              className="absolute top-0 right-0 bottom-0 z-50 w-[280px] sm:w-[320px] bg-black/95 backdrop-blur-md border-l border-white/10 flex flex-col"
              style={{ animation: 'slideInRight 0.25s ease-out' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-3 border-b border-white/10">
                <h3 className="text-white text-sm font-semibold truncate">{episodeData.animeTitle} — Episodes</h3>
                <button onClick={() => setShowEpisodePanel(false)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2.5 scrollbar-none" style={{ maxHeight: '250px' }}>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))' }}>
                  {allEpisodes.map((ep, idx) => (
                    <button
                      key={ep.id}
                      onClick={() => switchToEpisode(ep)}
                      className="flex items-center justify-center rounded-[10px] text-[10px] font-semibold transition-all duration-200 hover:scale-105"
                      style={{
                        aspectRatio: '1 / 1',
                        maxWidth: '60px',
                        maxHeight: '60px',
                        background: idx === currentEpisodeIndex ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.05)',
                        color: idx === currentEpisodeIndex ? 'white' : 'rgba(255,255,255,0.7)',
                        boxShadow: idx === currentEpisodeIndex ? '0 0 12px hsl(var(--primary) / 0.5)' : 'none',
                      }}
                    >
                      S{ep.season_number} EP{ep.episode_number}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <style>{`
              @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}</style>
          </>
        )}

        <div className={`bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16 ${deviceInfo.isMobile ? 'pb-2 px-3' : 'pb-3 px-4'}`}>
          {/* Progress bar */}
          <div className={`relative w-full ${deviceInfo.isMobile ? 'h-[3px]' : 'h-1.5'} bg-white/20 rounded-full mb-2 cursor-pointer group`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = ((e.clientX - rect.left) / rect.width) * 100;
              if (videoRef.current && duration) videoRef.current.currentTime = (pct / 100) * duration;
            }}>
            <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full" style={{ width: `${bufferedProgress}%` }} />
            <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${progress}%` }} />
            <div className={`absolute top-1/2 -translate-y-1/2 ${deviceInfo.isMobile ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity`}
              style={{ left: `${progress}%`, marginLeft: deviceInfo.isMobile ? '-5px' : '-7px' }} />
          </div>

          {/* Time + Controls */}
          <div className={`flex items-center justify-between gap-2 flex-wrap`}>
            <div className={`flex items-center ${gapSize} shrink-0`}>
              <button onClick={togglePlay} className={controlButtonClass}>
                {isPlaying ? <Pause className={iconSize} /> : <Play className={`${iconSize} ml-0.5`} />}
              </button>
              <button onClick={skipForward} className={controlButtonClass}>
                <SkipForward className={iconSize} />
              </button>
              <button onClick={toggleMute} className={controlButtonClass}>
                {isMuted ? <VolumeX className={iconSize} /> : <Volume2 className={iconSize} />}
              </button>
              <span className="text-white/80 text-[10px] sm:text-xs ml-1">{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>

            <div className={`flex items-center ${gapSize} flex-wrap justify-end`}>
              {/* CC subtitles */}
              {(captionsUrl || subtitleTracks.length > 0) && (
                <div className="relative">
                  <button onClick={(e) => {
                    e.stopPropagation();
                    if (subtitleTracks.length > 1) { closeAllMenus(); setShowCcMenu(!showCcMenu); }
                    else { setCcEnabled(v => !v); }
                  }}
                    className={`${controlButtonClass} ${ccEnabled ? '!bg-primary/80 !text-white' : ''}`} title="Captions">
                    {ccEnabled ? <Captions className={iconSize} /> : <CaptionsOff className={iconSize} />}
                  </button>
                  {showCcMenu && subtitleTracks.length > 1 && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/95 border border-white/10 rounded-lg p-1 min-w-[140px] z-50">
                      <button onClick={() => { setCcEnabled(false); setShowCcMenu(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs rounded ${!ccEnabled ? 'text-primary' : 'text-white/80'} hover:bg-white/10 flex items-center gap-2`}>
                        {!ccEnabled && <Check className="w-3 h-3" />} Off
                      </button>
                      {subtitleTracks.map(t => (
                        <button key={t.id} onClick={() => { setCurrentSubtitleTrack(t.id); setCcEnabled(true); setShowCcMenu(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded ${ccEnabled && currentSubtitleTrack === t.id ? 'text-primary' : 'text-white/80'} hover:bg-white/10 flex items-center gap-2`}>
                          {ccEnabled && currentSubtitleTrack === t.id && <Check className="w-3 h-3" />}
                          {t.name || t.lang || `Subtitle ${t.id + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Audio switch */}
              {audioTracks.length > 1 && (
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); closeAllMenus(); setShowAudioMenu(!showAudioMenu); }}
                    className={controlButtonClass} title="Audio Track">
                    <Headphones className={iconSize} />
                  </button>
                  {showAudioMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/95 border border-white/10 rounded-lg p-1 min-w-[130px] z-50">
                      {audioTracks.map(t => (
                        <button key={t.id} onClick={() => switchAudioTrack(t.id)}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded flex items-center gap-2 ${currentAudioTrack === t.id ? 'text-primary' : 'text-white/80'} hover:bg-white/10`}>
                          {currentAudioTrack === t.id && <Check className="w-3 h-3" />}
                          {t.name || t.lang || `Audio ${t.id + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quality */}
              {hlsLevels.length > 0 && (
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); closeAllMenus(); setShowQualityMenu(!showQualityMenu); }}
                    className={controlButtonClass}>
                    <Settings className={iconSize} />
                  </button>
                  {showQualityMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/95 border border-white/10 rounded-lg p-1 min-w-[120px] z-50">
                      <button onClick={() => { if (hlsRef.current) hlsRef.current.currentLevel = -1; setCurrentLevel(-1); setShowQualityMenu(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs rounded ${currentLevel === -1 ? 'text-primary' : 'text-white/80'} hover:bg-white/10 flex items-center gap-2`}>
                        {currentLevel === -1 && <Check className="w-3 h-3" />} Auto
                      </button>
                      {hlsLevels.map(l => (
                        <button key={l.id} onClick={() => { if (hlsRef.current) hlsRef.current.currentLevel = l.id; setCurrentLevel(l.id); setShowQualityMenu(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded ${currentLevel === l.id ? 'text-primary' : 'text-white/80'} hover:bg-white/10 flex items-center gap-2`}>
                          {currentLevel === l.id && <Check className="w-3 h-3" />} {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Download with 480p/720p/1080p */}
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); closeAllMenus(); setShowDownloadMenu(!showDownloadMenu); }}
                  className={controlButtonClass} title="Download">
                  {isDownloading ? <Loader2 className={`${iconSize} animate-spin`} /> : <Download className={iconSize} />}
                </button>
                {showDownloadMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/95 border border-white/10 rounded-lg p-1 min-w-[130px] z-50">
                    {['480p', '720p', '1080p', '2160p (4K)'].map((q) => (
                      <button key={q} onClick={(e) => { e.stopPropagation(); handleDirectDownload(q); }}
                        className={`w-full text-left px-3 py-1.5 text-xs rounded text-white/80 hover:bg-white/10 flex items-center gap-2 ${isDownloading === q ? 'opacity-50' : ''}`}
                        disabled={!!isDownloading}>
                        <Download className="w-3 h-3" /> {q}
                        {isDownloading === q && <Loader2 className="w-3 h-3 animate-spin" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); closeAllMenus(); setShowSpeedMenu(!showSpeedMenu); }} className={controlButtonClass} title="Speed">
                  <Gauge className={iconSize} />
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/95 border border-primary/30 rounded-lg p-1 min-w-[110px] z-50">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                      <button key={speed} onClick={(e) => { e.stopPropagation(); changePlaybackSpeed(speed); }}
                        className={`w-full text-left px-3 py-1.5 text-xs rounded hover:bg-primary/15 flex items-center gap-2 ${playbackSpeed === speed ? 'text-primary' : 'text-white/80'}`}>
                        {playbackSpeed === speed && <Check className="w-3 h-3" />} {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={toggleFullscreen} className={controlButtonClass}>
                <Maximize className={iconSize} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Center play button when paused */}
      {!isPlaying && !isLoading && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-primary/70 shadow-2xl shadow-primary/30 flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
        </div>
      )}
    </div>
  );
}
