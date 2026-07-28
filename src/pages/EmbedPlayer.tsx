import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, 
  SkipForward, SkipBack, Loader2, AlertTriangle,
  RefreshCw, Settings, Check, Download, Headphones, ShieldAlert,
  List, X
} from 'lucide-react';
import { Captions, CaptionsOff } from 'lucide-react';
import Hls from 'hls.js';
import { useEmbedPlayerBridge } from '@/hooks/useEmbedPlayerBridge';
import { getNetworkInfo } from '@/lib/videoUtils';
import { isHlsUrl as isHls, isDashUrl, selectCompatibleSources, detectDeviceKind } from '@/lib/streamSource';


function getLowBandwidthHlsConfig() {
  const { isSlowNetwork, isCellular, saveData } = getNetworkInfo();
  const slow = isSlowNetwork || saveData;
  return {
    enableWorker: true,
    lowLatencyMode: false,
    startLevel: 0,                     // start at lowest rendition for instant play
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

function detectDeviceInfo() {
  if (typeof window === 'undefined') return { isMobile: false, isIOS: false, isAndroid: false, isSafari: false };
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || isAndroid || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return { isMobile, isIOS, isAndroid, isSafari };
}

function isHlsUrl(url: string | null): boolean {
  return isHls(url);
}


export default function EmbedPlayer() {
  const { episodeId } = useParams();
  const [searchParams] = useSearchParams();
  const startTime = parseFloat(searchParams.get('t') || '0');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [domainAllowed, setDomainAllowed] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [episodeData, setEpisodeData] = useState<{ title: string; videoUrl: string | null } | null>(null);
  const [candidateUrls, setCandidateUrls] = useState<string[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [audioTracks, setAudioTracks] = useState<{ id: number; name: string; lang: string }[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(0);
  const [showEpisodePanel, setShowEpisodePanel] = useState(false);
  const [allEpisodes, setAllEpisodes] = useState<{ id: string; title: string; episode_number: number; season_number: number }[]>([]);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [captionsUrl, setCaptionsUrl] = useState<string | null>(null);
  const [subtitleTracks, setSubtitleTracks] = useState<{ id: number; name: string; lang: string }[]>([]);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<number>(-1); // -1 = off
  const [ccEnabled, setCcEnabled] = useState(false);
  const [showCcMenu, setShowCcMenu] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hlsLevels, setHlsLevels] = useState<{ id: number; height: number; label: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [isHlsActive, setIsHlsActive] = useState(false);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);

  const deviceInfo = detectDeviceInfo();

  // Domain + admin validation
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        setIsAdmin(true);
        setDomainAllowed(true);
        return;
      }

      const hostname = window.location.hostname;
      if (hostname === 'localhost' || ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
        setDomainAllowed(true); return;
      }
      const referrer = document.referrer;
      if (referrer) {
        try {
          const refHost = new URL(referrer).hostname;
          if (ALLOWED_DOMAINS.some(d => refHost === d || refHost.endsWith('.' + d))) {
            setDomainAllowed(true); return;
          }
        } catch {}
      }
      if (hostname.includes('lovable.app')) {
        setDomainAllowed(true); return;
      }
      setDomainAllowed(false);
    };
    checkAccess();
  }, []);

  // Disable right-click + inspect for non-admins
  useEffect(() => {
    if (isAdmin) return;
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) || (e.ctrlKey && e.key === 'u')) e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('contextmenu', handleContextMenu); document.removeEventListener('keydown', handleKeyDown); };
  }, [isAdmin]);
  

  // Mobile compact sizes
  const btnSize = deviceInfo.isMobile ? 'w-6 h-6' : 'w-8 h-8';
  const iconSize = deviceInfo.isMobile ? 'w-[13px] h-[13px]' : 'w-[18px] h-[18px]';
  const gapSize = deviceInfo.isMobile ? 'gap-1' : 'gap-2';

  // Fetch episode data (only if domain allowed)
  const [resolvedAnimeId, setResolvedAnimeId] = useState<string | null>(null);
  useEffect(() => {
    if (domainAllowed !== true) return;
    const fetchEpisode = async () => {
      if (!episodeId) { setFetchError('No episode ID provided'); return; }
      try {
        const { data, error } = await supabase
          .from('episodes').select('video_url, external_url, title, season_id, episode_number, captions_url')
          .eq('id', episodeId).single();
        if (error || !data) { setFetchError('Episode not found'); return; }
        // Build ordered candidate list so if one URL is broken (Object_not_found,
        // 404, DRM, iOS-incompatible codec), we auto-fall-back to the next.
        const candidates = [data.video_url, data.external_url]
          .filter((u): u is string => !!u && typeof u === 'string')
          .filter((u, i, arr) => arr.indexOf(u) === i);
        if (candidates.length === 0) { setFetchError('No video available'); return; }
        setCandidateUrls(candidates);
        setCandidateIndex(0);
        setEpisodeData({ title: data.title, videoUrl: candidates[0] });
        setCaptionsUrl(data.captions_url || null);

        // Fetch sibling episodes for episode selector
        if (data.season_id) {
          const { data: season } = await supabase.from('seasons').select('id, season_number, anime_id').eq('id', data.season_id).single();
          if (season) {
            setResolvedAnimeId(season.anime_id);
            const { data: allSeasons } = await supabase.from('seasons').select('id, season_number').eq('anime_id', season.anime_id).order('season_number');
            if (allSeasons) {
              const allEps: typeof allEpisodes = [];
              for (const s of allSeasons) {
                const { data: eps } = await supabase.from('episodes').select('id, title, episode_number').eq('season_id', s.id).order('episode_number');
                if (eps) allEps.push(...eps.map(e => ({ ...e, season_number: s.season_number })));
              }
              setAllEpisodes(allEps);
              const idx = allEps.findIndex(e => e.id === episodeId);
              if (idx >= 0) setCurrentEpisodeIndex(idx);
            }
          }
        }
      } catch {
        setFetchError('Failed to load episode');
      }
    };
    fetchEpisode();
  }, [episodeId, domainAllowed]);

  // 📝 Save watch history from embed player → shows up in main "/" Continue Watching
  useEffect(() => {
    if (!episodeId || !resolvedAnimeId) return;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      // Initial upsert (one row per user+episode)
      await supabase.from('watch_history').upsert({
        user_id: user.id,
        anime_id: resolvedAnimeId,
        episode_id: episodeId,
        progress: 0,
        completed: false,
        watched_at: new Date().toISOString(),
      }, { onConflict: 'user_id,episode_id', ignoreDuplicates: false });
      // Periodic progress sync (every 10s)
      intervalId = setInterval(async () => {
        const v = videoRef.current;
        if (!v || !v.duration) return;
        const pct = (v.currentTime / v.duration) * 100;
        const completed = pct >= 90;
        await supabase.from('watch_history').upsert({
          user_id: user.id,
          anime_id: resolvedAnimeId,
          episode_id: episodeId,
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
  }, [episodeId, resolvedAnimeId]);

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
          setIsHlsActive(true);
          if (data.levels?.length > 0) {
            setHlsLevels(data.levels.map((level, idx) => ({
              id: idx, height: level.height,
              label: level.height >= 2160 ? '4K' : level.height >= 1080 ? '1080p' : level.height >= 720 ? '720p' : level.height >= 480 ? '480p' : `${level.height}p`
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
          // Try to recover instead of slamming the user with an error overlay.
          if (data.type === 'networkError') { try { hls.startLoad(); } catch {} return; }
          if (data.type === 'mediaError') { try { hls.recoverMediaError(); } catch {} return; }
        });
      }
    } else {
      video.src = videoUrl;
    }
    
    const handleCanPlay = () => { setIsLoading(false); if (startTime > 0) video.currentTime = startTime; video.play().catch(() => {}); };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
      setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
    };
    const handleProgress = () => {
      if (video.buffered.length > 0) setBufferedProgress(video.duration ? (video.buffered.end(video.buffered.length - 1) / video.duration) * 100 : 0);
    };
    const handleError = (e: Event) => {
      const v = e.currentTarget as HTMLVideoElement;
      setIsLoading(false);
      if (v?.error && v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        // Auto-advance to the next candidate URL (external_url fallback etc.)
        if (candidateIndex < candidateUrls.length - 1) {
          const nextIdx = candidateIndex + 1;
          setCandidateIndex(nextIdx);
          setEpisodeData((prev) => prev ? { ...prev, videoUrl: candidateUrls[nextIdx] } : prev);
          setError(null);
          setIsLoading(true);
          return;
        }
        setError('Video failed to load - please try again');
      }
    };
    const handleLoadedMeta = () => {
      // Native (Safari/HLS-native + MP4 with multiple audio) audio track detection
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
      // Native text tracks (Safari HLS, embedded MP4 captions)
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

    video.addEventListener('loadedmetadata', handleLoadedMeta);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('error', handleError);
    
    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadedmetadata', handleLoadedMeta);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [episodeData?.videoUrl, startTime]);

  // Apply CC enable state to whichever subtitle layer is active
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // HLS subtitle tracks
    if (hlsRef.current && hlsRef.current.subtitleTracks?.length) {
      hlsRef.current.subtitleDisplay = ccEnabled;
      if (ccEnabled && currentSubtitleTrack < 0 && hlsRef.current.subtitleTracks.length > 0) {
        hlsRef.current.subtitleTrack = 0;
        setCurrentSubtitleTrack(0);
      } else if (!ccEnabled) {
        hlsRef.current.subtitleTrack = -1;
      }
    }
    // Native text tracks (also covers our injected <track> element)
    const tt = video.textTracks;
    if (tt) {
      for (let i = 0; i < tt.length; i++) {
        tt[i].mode = ccEnabled ? (i === Math.max(0, currentSubtitleTrack) ? 'showing' : 'disabled') : 'disabled';
      }
    }
  }, [ccEnabled, currentSubtitleTrack, captionsUrl, episodeData?.videoUrl]);

  const play = () => videoRef.current?.play();
  const pause = () => videoRef.current?.pause();
  const togglePlay = () => isPlaying ? pause() : play();
  const toggleMute = () => { if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); } };
  const seek = (time: number) => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, Math.min(time, duration)); };
  const setQualityLevel = (level: number) => { if (hlsRef.current) { hlsRef.current.currentLevel = level; setCurrentLevel(level); } };
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
  const retry = () => {
    setError(null);
    setIsLoading(true);
    // Reset to the first candidate on manual retry so we always try the primary
    // source again — if it still fails, the auto-fallback re-advances.
    if (candidateUrls.length > 0) {
      setCandidateIndex(0);
      setEpisodeData((prev) => prev ? { ...prev, videoUrl: candidateUrls[0] } : prev);
    } else {
      videoRef.current?.load();
    }
  };

  const handleDirectDownload = (quality: string) => {
    const url = episodeData?.videoUrl;
    if (!url) return;
    setIsDownloading(quality);
    setShowDownloadMenu(false);
    const safeName = episodeData?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'video';
    const fileName = `AnimeSavi_${safeName}_${quality}.mp4`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setIsDownloading(null);
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => { document.removeEventListener('fullscreenchange', handleFullscreenChange); document.removeEventListener('webkitfullscreenchange', handleFullscreenChange); };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => { setShowControls(false); setShowQualityMenu(false); setShowDownloadMenu(false); setShowAudioMenu(false); }, 3000);
    }
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [isPlaying, showControls]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) controlsTimeoutRef.current = setTimeout(() => { setShowControls(false); setShowQualityMenu(false); setShowDownloadMenu(false); setShowAudioMenu(false); }, 3000);
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return hrs > 0 ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current && duration) {
      const val = parseFloat(e.target.value);
      const time = (val / 100) * duration;
      videoRef.current.currentTime = time;
      setProgress(val);
      setCurrentTime(time);
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;
    try {
      const isFS = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (isFS) {
        document.exitFullscreen?.() || (document as any).webkitExitFullscreen?.();
      } else {
        if (deviceInfo.isIOS && video && (video as any).webkitEnterFullscreen) { (video as any).webkitEnterFullscreen(); return; }
        container.requestFullscreen?.() || (container as any).webkitRequestFullscreen?.();
      }
    } catch {}
  };

  const skipForward = useCallback(() => seek(currentTime + 10), [currentTime]);
  const skipBackward = useCallback(() => seek(currentTime - 10), [currentTime]);

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

  const handleDoubleTap = (e: React.TouchEvent) => {
    const now = Date.now();
    const touch = e.touches[0] || e.changedTouches[0];
    const x = touch.clientX;
    const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
    const timeSinceLastTap = now - lastTapRef.current.time;
    const distanceFromLastTap = Math.abs(x - lastTapRef.current.x);
    if (timeSinceLastTap < 300 && distanceFromLastTap < 50) {
      e.preventDefault();
      const side = x < containerWidth / 2 ? 'left' : 'right';
      if (side === 'left') { skipBackward(); setDoubleTapSide('left'); }
      else { skipForward(); setDoubleTapSide('right'); }
      setTimeout(() => setDoubleTapSide(null), 500);
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x };
    }
  };

  const closeAllMenus = () => { setShowQualityMenu(false); setShowDownloadMenu(false); setShowAudioMenu(false); setShowEpisodePanel(false); setShowCcMenu(false); };

  const switchToEpisode = useCallback(async (ep: typeof allEpisodes[0]) => {
    setShowEpisodePanel(false);
    setIsLoading(true);
    setError(null);
    const { data } = await supabase.from('episodes').select('video_url, external_url, title').eq('id', ep.id).single();
    if (!data) { setError('Episode failed to load'); return; }
    const candidates = [data.video_url, data.external_url]
      .filter((u): u is string => !!u && typeof u === 'string')
      .filter((u, i, arr) => arr.indexOf(u) === i);
    if (candidates.length === 0) { setError('No video available'); return; }
    setCandidateUrls(candidates);
    setCandidateIndex(0);
    setEpisodeData({ title: data.title, videoUrl: candidates[0] });
    const idx = allEpisodes.findIndex(e => e.id === ep.id);
    if (idx >= 0) setCurrentEpisodeIndex(idx);
  }, [allEpisodes]);

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
        <button onClick={retry} className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
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
      onTouchStart={(e) => { setShowControls(true); handleDoubleTap(e); }}
      onClick={(e) => { if (!(e.target as HTMLElement).closest('.controls-area')) { togglePlay(); closeAllMenus(); } }}
    >
      {(isLoading || isBuffering) && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            {isBuffering && <span className="text-white/70 text-sm">Buffering...</span>}
          </div>
        </div>
      )}

      {doubleTapSide === 'left' && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 pointer-events-none animate-fade-in">
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-4 flex items-center gap-2">
            <SkipBack className="w-8 h-8 text-white" />
            <span className="text-white font-bold text-lg">10s</span>
          </div>
        </div>
      )}
      {doubleTapSide === 'right' && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 pointer-events-none animate-fade-in">
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-4 flex items-center gap-2">
            <span className="text-white font-bold text-lg">10s</span>
            <SkipForward className="w-8 h-8 text-white" />
          </div>
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

      {/* Controls overlay */}
      <div 
        className={`controls-area absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar + Episodes button */}
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
          <h1 className="text-white font-medium truncate min-w-0 flex-1">{episodeData.title}</h1>
          {allEpisodes.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowEpisodePanel(!showEpisodePanel); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium transition-colors ml-2 shrink-0"
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
                <h3 className="text-white text-sm font-semibold truncate">Episodes</h3>
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

        {/* Center play button */}
        {!isPlaying && showControls && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center cursor-pointer pointer-events-auto shadow-xl hover:bg-primary transition-colors"
              onClick={() => play()}>
              <Play className="w-10 h-10 text-primary-foreground fill-current ml-1" />
            </button>
          </div>
        )}

        {/* Bottom controls */}
        <div className={`bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-16 ${deviceInfo.isMobile ? 'pb-2 px-3' : 'pb-4 px-4'}`}>
          {/* Progress bar */}
          <div className="mb-2 md:mb-3">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-white/90 text-[10px] md:text-xs font-mono min-w-[36px] md:min-w-[40px]">{formatTime(currentTime)}</span>
              <div className="flex-1 relative h-1 md:h-1.5">
                {/* Buffer track (background) */}
                <div className="absolute inset-0 bg-white/20 rounded-full pointer-events-none" />
                <div
                  className="absolute top-0 left-0 h-full bg-white/40 rounded-full pointer-events-none"
                  style={{ width: `${bufferedProgress}%` }}
                />
                {/* Played fill */}
                <div
                  className="absolute top-0 left-0 h-full bg-primary rounded-full pointer-events-none"
                  style={{ width: `${progress}%`, transform: 'translate3d(0,0,0)', willChange: 'width' }}
                />
                {/* YouTube-style smooth seek slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="any"
                  value={isNaN(progress) ? 0 : progress}
                  onChange={handleSeek}
                  className="smooth-seekbar absolute left-0 right-0 top-1/2 -translate-y-1/2"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <span className="text-white/90 text-[10px] md:text-xs font-mono min-w-[36px] md:min-w-[40px]">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control buttons - flat */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className={`flex items-center ${gapSize} shrink-0`}>
              <button className={`${btnSize} flex items-center justify-center text-white/90 hover:text-white transition-colors`} onClick={skipBackward}>
                <SkipBack className={iconSize} />
              </button>
              <button className={`${deviceInfo.isMobile ? 'w-7 h-7' : 'w-9 h-9'} flex items-center justify-center text-white hover:text-white transition-colors`} onClick={togglePlay}>
                {isPlaying ? <Pause className={deviceInfo.isMobile ? 'w-4 h-4' : 'w-5 h-5'} /> : <Play className={`${deviceInfo.isMobile ? 'w-4 h-4' : 'w-5 h-5'} fill-current`} />}
              </button>
              <button className={`${btnSize} flex items-center justify-center text-white/90 hover:text-white transition-colors`} onClick={skipForward}>
                <SkipForward className={iconSize} />
              </button>
              <button className={`${btnSize} flex items-center justify-center text-white/90 hover:text-white transition-colors`} onClick={toggleMute}>
                {isMuted ? <VolumeX className={iconSize} /> : <Volume2 className={iconSize} />}
              </button>
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
                    className={`${btnSize} ${ccEnabled ? 'text-primary' : 'text-white/90 hover:text-white'} flex items-center justify-center transition-colors`} title="Captions">
                    {ccEnabled ? <Captions className={iconSize} /> : <CaptionsOff className={iconSize} />}
                  </button>
                  {showCcMenu && subtitleTracks.length > 1 && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-sm rounded-lg py-2 min-w-[140px] shadow-xl z-50">
                      <button onClick={() => { setCcEnabled(false); setShowCcMenu(false); }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2 ${!ccEnabled ? 'text-primary' : 'text-white'}`}>
                        {!ccEnabled && <Check className="w-3 h-3" />} Off
                      </button>
                      {subtitleTracks.map(t => (
                        <button key={t.id} onClick={() => { setCurrentSubtitleTrack(t.id); setCcEnabled(true); setShowCcMenu(false); }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2 ${ccEnabled && currentSubtitleTrack === t.id ? 'text-primary' : 'text-white'}`}>
                          {ccEnabled && currentSubtitleTrack === t.id && <Check className="w-3 h-3" />}
                          {t.name || t.lang || `Subtitle ${t.id + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Audio switch — always visible so users can see/change track */}
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); closeAllMenus(); setShowAudioMenu(!showAudioMenu); }}
                  className={`${btnSize} flex items-center justify-center text-white/90 hover:text-white transition-colors`} title="Audio Track">
                  <Headphones className={iconSize} />
                </button>
                {showAudioMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-sm rounded-lg py-2 min-w-[150px] shadow-xl z-50">
                    {(() => {
                      const tracksToShow = audioTracks.length > 0
                        ? audioTracks
                        : [{ id: 0, name: 'Original Audio', lang: '' }];
                      return tracksToShow.map(t => (
                        <button key={t.id} onClick={() => switchAudioTrack(t.id)}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2 ${currentAudioTrack === t.id ? 'text-primary' : 'text-white'}`}>
                          {currentAudioTrack === t.id && <Check className="w-3 h-3" />}
                          {t.name || t.lang || `Audio ${t.id + 1}`}
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Quality selector */}
              {isHlsActive && hlsLevels.length > 1 && (
                <div className="relative">
                  <button className={`${btnSize} flex items-center justify-center text-white/90 hover:text-white transition-colors`}
                    onClick={(e) => { e.stopPropagation(); closeAllMenus(); setShowQualityMenu(!showQualityMenu); }}>
                    <Settings className={iconSize} />
                  </button>
                  {showQualityMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-sm rounded-lg py-2 min-w-[120px] shadow-xl z-50">
                      <button className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center justify-between ${currentLevel === -1 ? 'text-primary' : 'text-white'}`}
                        onClick={() => { setQualityLevel(-1); setShowQualityMenu(false); }}>
                        Auto {currentLevel === -1 && <Check className="w-4 h-4" />}
                      </button>
                      {hlsLevels.map(level => (
                        <button key={level.id}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center justify-between ${currentLevel === level.id ? 'text-primary' : 'text-white'}`}
                          onClick={() => { setQualityLevel(level.id); setShowQualityMenu(false); }}>
                          {level.label} {currentLevel === level.id && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Download 720p / 1080p → Shadow-Arise */}
              <div className="relative">
                <button className={`${btnSize} flex items-center justify-center text-white/90 hover:text-white transition-colors`}
                  onClick={(e) => { e.stopPropagation(); closeAllMenus(); setShowDownloadMenu(!showDownloadMenu); }} title="Download">
                  <Download className={iconSize} />
                </button>
                {showDownloadMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-sm rounded-lg py-2 min-w-[140px] shadow-xl z-50">
                    {[{ q: '720p', label: '720p HD' }, { q: '1080p', label: '1080p FHD' }].map(({ q, label }) => {
                      const epInfo = allEpisodes[currentEpisodeIndex];
                      const epNum = epInfo ? String(epInfo.episode_number).padStart(2, '0') : '01';
                      const animeTitleClean = episodeData?.title?.split(' - ')[0]?.replace(/[^a-zA-Z0-9 ]/g, '')?.trim() || 'Anime';
                      const shadowUrl = `/Shadow-Arise?quality=${q}&anime=${encodeURIComponent(animeTitleClean)}&ep=${epNum}&url=${encodeURIComponent(episodeData?.videoUrl || '')}`;
                      return (
                        <a key={q} href={shadowUrl} target="_blank" rel="noopener noreferrer"
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 text-white flex items-center gap-2 block">
                          <Download className="w-4 h-4" /> {label}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              <button className={`${btnSize} flex items-center justify-center text-white/90 hover:text-white transition-colors`} onClick={toggleFullscreen}>
                <Maximize className={iconSize} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

