import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  RefreshCw, Settings, Download, List,
} from 'lucide-react';
import {
  EmbedBrand, EmbedBtn, EmbedCenterPlay, EmbedDoubleTap, EmbedEpisodeDrawer, EmbedLoading,
  EmbedMenu, EmbedMenuItem, EmbedMenuLabel, EmbedSeek, EmbedStatus, EmbedTime,
} from '@/components/embed/EmbedChrome';
import { extractEmbedSrc, isEmbedLikeUrl } from '@/components/video/PureEmbedPlayer';
import Hls from 'hls.js';
import { useEmbedPlayerBridge } from '@/hooks/useEmbedPlayerBridge';
import { useEmbedResume } from '@/hooks/useEmbedResume';
import { getNetworkInfo } from '@/lib/videoUtils';
import { isHlsUrl as isHls, isDashUrl, selectCompatibleSources, detectDeviceKind } from '@/lib/streamSource';
import { isUuid, isSelfEmbedUrl } from '@/lib/embedLink';


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
  'animesavi.com',
  'www.animesavi.com',
  'floxanimeindia.in.net',
  'kairoanime.base44.app',
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

/** Episodes with no direct file but an external provider link play in an iframe. */
function isEmbedOnly(videoUrl: string | null | undefined, externalUrl: string | null | undefined): boolean {
  return !videoUrl && !!externalUrl && !isSelfEmbedUrl(externalUrl) && isEmbedLikeUrl(externalUrl);
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
  const dashRef = useRef<any>(null);

  
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
  // Provider iframe for episodes that only have an external embed link.
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  
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
      const referrer = document.referrer;
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
  const btnSize = deviceInfo.isMobile ? 'w-5 h-5' : 'w-8 h-8';
  const iconSize = deviceInfo.isMobile ? 'w-[11px] h-[11px]' : 'w-[18px] h-[18px]';
  const gapSize = deviceInfo.isMobile ? 'gap-1' : 'gap-2';

  // Fetch episode data (only if domain allowed)
  const [resolvedAnimeId, setResolvedAnimeId] = useState<string | null>(null);
  const [realEpisodeId, setRealEpisodeId] = useState<string | null>(null);
  useEffect(() => {
    if (domainAllowed !== true) return;
    const fetchEpisode = async () => {
      if (!episodeId) { setFetchError('No episode ID provided'); return; }
      try {
        // The route accepts BOTH the full UUID and the short 6-char code
        // (e.g. /embed/gy7e12), so short links resolve to the same episode.
        const key = episodeId.trim().toLowerCase();
        const query = supabase
          .from('episodes')
          .select('id, video_url, external_url, title, season_id, episode_number, captions_url');
        const { data, error } = isUuid(key)
          ? await query.eq('id', key).maybeSingle()
          : await query.eq('short_id', key).maybeSingle();
        if (error || !data) { setFetchError('Episode not found'); return; }
        setRealEpisodeId(data.id);
        // Build ordered candidate list, ranked by device compatibility.
        // iOS Safari can't play DASH/MKV → those get dropped so the fallback
        // jumps straight to a playable HLS/MP4 source instead of showing a
        // "Playback Error" on an unplayable format.
        // Self-referencing embed links (our own /embed/... page stored in
        // external_url) are NOT video sources — playing them fails.
        if (isEmbedOnly(data.video_url, data.external_url)) {
          setIframeSrc(extractEmbedSrc(data.external_url!));
          setEpisodeData({ title: data.title, videoUrl: null });
        } else {
        const rawSources = [data.video_url, data.external_url].filter(
          (u) => !!u && !isSelfEmbedUrl(u),
        );
        const candidates = selectCompatibleSources(rawSources);
        if (candidates.length === 0) {
          setFetchError(
            deviceInfo.isIOS
              ? 'No iOS-compatible source available for this episode (needs HLS or MP4).'
              : 'No video available for this episode.'
          );
          return;
        }
        setIframeSrc(null);
        setCandidateUrls(candidates);
        setCandidateIndex(0);
        setEpisodeData({ title: data.title, videoUrl: candidates[0] });
        }

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
              const idx = allEps.findIndex(e => e.id === data.id);
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
    if (!realEpisodeId || !resolvedAnimeId) return;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      // Keep existing checkpoints until actual playback advances.
      // Periodic progress sync (every 10s)
      intervalId = setInterval(async () => {
        const v = videoRef.current;
        if (!v || !v.duration || v.paused || v.currentTime <= 0) return;
        const pct = (v.currentTime / v.duration) * 100;
        const completed = pct >= 90;
        await supabase.from('watch_history').upsert({
          user_id: user.id,
          anime_id: resolvedAnimeId,
          episode_id: realEpisodeId,
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
  }, [realEpisodeId, resolvedAnimeId]);

  // Video playback setup
  useEffect(() => {
    const video = videoRef.current;
    const videoUrl = episodeData?.videoUrl;
    if (!video || !videoUrl) return;
    
    setIsLoading(true);
    setError(null);
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (dashRef.current) { try { dashRef.current.reset(); } catch {} dashRef.current = null; }
    video.muted = true;
    setIsMuted(true);

    const advanceCandidate = (reason: string) => {
      if (candidateIndex < candidateUrls.length - 1) {
        const nextIdx = candidateIndex + 1;
        console.warn('[EmbedPlayer] source failed, advancing candidate:', reason);
        setCandidateIndex(nextIdx);
        setEpisodeData((prev) => prev ? { ...prev, videoUrl: candidateUrls[nextIdx] } : prev);
        setIsLoading(true);
        return true;
      }
      return false;
    };

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
          if (data.type === 'networkError') { try { hls.startLoad(); } catch {} return; }
          if (data.type === 'mediaError') { try { hls.recoverMediaError(); } catch {} return; }
          // Unrecoverable HLS error → try next candidate URL.
          if (!advanceCandidate('hls-fatal')) setError('This stream could not be played on your device.');
        });
      } else {
        // Browser can't play HLS at all (rare) — try next candidate.
        if (!advanceCandidate('no-hls-support')) setError('HLS streaming is not supported on this browser.');
      }
    } else if (isDashUrl(videoUrl)) {
      // MPEG-DASH — requires MSE. iOS Safari cannot play this.
      if (deviceInfo.isIOS) {
        if (!advanceCandidate('ios-no-dash')) {
          setError('This episode uses MPEG-DASH which iOS cannot play. Try another server.');
        }
      } else {
        (async () => {
          try {
            const dashjs = await import('dashjs');
            const player = dashjs.MediaPlayer().create();
            dashRef.current = player;
            player.initialize(video, videoUrl, true);
            player.on(dashjs.MediaPlayer.events.ERROR, () => {
              if (!advanceCandidate('dash-error')) setError('This DASH stream could not be played.');
            });
          } catch {
            if (!advanceCandidate('dash-load-failed')) setError('Failed to load DASH player.');
          }
        })();
      }
    } else {
      video.src = videoUrl;
    }


    
    const handleCanPlay = () => { setIsLoading(false); video.play().catch(() => {}); };
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
      // Auto-advance to the next candidate URL on any decode/network/format error.
      const code = v?.error?.code;
      const isFormatOrDecode = code === 3 /* MEDIA_ERR_DECODE */ || code === 4 /* MEDIA_ERR_SRC_NOT_SUPPORTED */;
      if (v?.error && (v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || isFormatOrDecode)) {
        if (candidateIndex < candidateUrls.length - 1) {
          const nextIdx = candidateIndex + 1;
          setCandidateIndex(nextIdx);
          setEpisodeData((prev) => prev ? { ...prev, videoUrl: candidateUrls[nextIdx] } : prev);
          setError(null);
          setIsLoading(true);
          return;
        }
        const kind = detectDeviceKind();
        setError(
          kind === 'ios'
            ? 'This video format is not supported on iOS. Try another server.'
            : kind === 'android'
              ? 'This video format is not supported on Android. Try another server.'
              : 'Video failed to load — please try another server.'
        );
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
      if (dashRef.current) { try { dashRef.current.reset(); } catch {} dashRef.current = null; }

    };
  }, [episodeData?.videoUrl, startTime]);

  useEmbedResume(videoRef, realEpisodeId, episodeData?.videoUrl, searchParams.has('t') ? startTime : undefined);

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
    const idxEmbed = allEpisodes.findIndex(e => e.id === ep.id);
    // Resume checkpoints and watch tracking follow the episode actually playing.
    setRealEpisodeId(ep.id);
    if (isEmbedOnly(data.video_url, data.external_url)) {
      setIframeSrc(extractEmbedSrc(data.external_url!));
      setEpisodeData({ title: data.title, videoUrl: null });
      setIsLoading(false);
      if (idxEmbed >= 0) setCurrentEpisodeIndex(idxEmbed);
      return;
    }
    setIframeSrc(null);
    const candidates = selectCompatibleSources(
      [data.video_url, data.external_url].filter((u) => !!u && !isSelfEmbedUrl(u)),
    );
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
        <button type="button" onClick={retry} className="ep3-cta">
          <RefreshCw /> Retry
        </button>
      </EmbedStatus>
    );
  }

  const currentEp = allEpisodes[currentEpisodeIndex];
  const epLabel = currentEp ? `S${currentEp.season_number} · E${currentEp.episode_number}` : null;
  const seasons = Array.from(new Set(allEpisodes.map((e) => e.season_number))).sort((a, b) => a - b);

  const topBar = (
    <div className="ep3-top">
      <div className="ep3-top-info">
        <EmbedBrand compact />
        <span className="ep3-divider" aria-hidden />
        <div className="ep3-top-text">
          <p className="ep3-title">{episodeData.title}</p>
          {epLabel && <p className="ep3-sub"><b>{epLabel}</b></p>}
        </div>
      </div>
      {allEpisodes.length > 1 && (
        <button
          type="button"
          className="ep3-chip-btn"
          data-active={showEpisodePanel ? 'true' : undefined}
          aria-expanded={showEpisodePanel}
          onClick={(e) => { e.stopPropagation(); setShowEpisodePanel(!showEpisodePanel); }}
        >
          <List /> Episodes
        </button>
      )}
    </div>
  );

  const episodeDrawer = showEpisodePanel ? (
    <EmbedEpisodeDrawer
      heading="Episodes"
      subheading={`${allEpisodes.length} episodes${seasons.length > 1 ? ` · ${seasons.length} seasons` : ''}`}
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
  ) : null;

  // Embed-only episodes (no direct file) play inside the provider's iframe.
  if (iframeSrc) {
    return (
      <div ref={containerRef} className="ep3 ep3-root embed-player">
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          title={episodeData.title || 'Embedded video'}
          className="ep3-frame embed-frame"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          onContextMenu={(e) => e.preventDefault()}
        />
        <div className="embed-frame-shield" aria-hidden="true" onContextMenu={(e) => e.preventDefault()} />
        {allEpisodes.length > 1 && (
          <div style={{ position: 'absolute', top: 'max(10px, env(safe-area-inset-top))', right: 'max(10px, env(safe-area-inset-right))', zIndex: 20 }}>
            <button
              type="button"
              className="ep3-chip-btn"
              data-active={showEpisodePanel ? 'true' : undefined}
              onClick={() => setShowEpisodePanel(!showEpisodePanel)}
            >
              <List /> Episodes
            </button>
          </div>
        )}
        {episodeDrawer}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="ep3 ep3-root"
      onMouseMove={handleMouseMove}
      onTouchStart={(e) => { setShowControls(true); handleDoubleTap(e); }}
      onClick={(e) => { if (!(e.target as HTMLElement).closest('.controls-area')) { togglePlay(); closeAllMenus(); } }}
    >
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

      {(isLoading || isBuffering) && <EmbedLoading label={isBuffering && !isLoading ? 'Buffering' : undefined} />}
      {doubleTapSide && <EmbedDoubleTap side={doubleTapSide} />}

      <div
        className="controls-area ep3-layer"
        data-visible={showControls ? 'true' : 'false'}
        onClick={(e) => e.stopPropagation()}
      >
        {topBar}

        {!isPlaying && !isLoading && <EmbedCenterPlay onClick={() => play()} />}

        <div className="ep3-bottom">
          <EmbedSeek
            value={isNaN(progress) ? 0 : progress}
            buffered={bufferedProgress}
            onChange={(val) => {
              if (videoRef.current && duration) {
                const time = (val / 100) * duration;
                videoRef.current.currentTime = time;
                setProgress(val);
                setCurrentTime(time);
              }
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
              {isHlsActive && hlsLevels.length > 1 && (
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
                      <EmbedMenuItem active={currentLevel === -1} onClick={() => { setQualityLevel(-1); setShowQualityMenu(false); }}>
                        Auto
                      </EmbedMenuItem>
                      {hlsLevels.map((level) => (
                        <EmbedMenuItem
                          key={level.id}
                          active={currentLevel === level.id}
                          onClick={() => { setQualityLevel(level.id); setShowQualityMenu(false); }}
                        >
                          {level.label}
                        </EmbedMenuItem>
                      ))}
                    </EmbedMenu>
                  )}
                </div>
              )}

              {/* Download 720p / 1080p → Shadow-Arise */}
              <div className="ep3-anchor">
                <EmbedBtn
                  label="Download"
                  active={showDownloadMenu}
                  onClick={(e) => { e.stopPropagation(); closeAllMenus(); setShowDownloadMenu(!showDownloadMenu); }}
                >
                  <Download />
                </EmbedBtn>
                {showDownloadMenu && (
                  <EmbedMenu label="Download">
                    <EmbedMenuLabel>Download</EmbedMenuLabel>
                    {[{ q: '720p', tag: 'HD' }, { q: '1080p', tag: 'FHD' }].map(({ q, tag }) => {
                      const epInfo = allEpisodes[currentEpisodeIndex];
                      const epNum = epInfo ? String(epInfo.episode_number).padStart(2, '0') : '01';
                      const animeTitleClean = episodeData?.title?.split(' - ')[0]?.replace(/[^a-zA-Z0-9 ]/g, '')?.trim() || 'Anime';
                      const shadowUrl = `/Shadow-Arise?quality=${q}&anime=${encodeURIComponent(animeTitleClean)}&ep=${epNum}&url=${encodeURIComponent(episodeData?.videoUrl || '')}`;
                      return (
                        <a key={q} href={shadowUrl} target="_blank" rel="noopener noreferrer" className="ep3-menu-item">
                          <span>{q}</span>
                          <small>{tag}</small>
                        </a>
                      );
                    })}
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

      {episodeDrawer}
    </div>
  );
}
