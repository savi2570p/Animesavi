import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import Hls from 'hls.js';
import { ANIME_QUALITY_OVERRIDES } from '@/lib/audioLanguageUtils';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Settings,
  Loader2,
  SkipForward,
  SkipBack,
  PictureInPicture2,
  Check,
  Headphones,
  Subtitles,
  ChevronRight,
  ChevronLeft,
  Gauge,
  FastForward,
  Info,
  Keyboard,
} from 'lucide-react';
import { 
  getAudioTrackLabel, 
  getSubtitleTrackLabel, 
  getPreferredAudioTrack,
  normalizeLanguageCode,
  LANGUAGE_CODE_MAP
} from '@/lib/audioLanguageUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { DownloadVerificationDialog } from './DownloadVerificationDialog';
import { QualityOverlay } from './QualityOverlay';
import { BufferingIndicator } from './BufferingIndicator';
import { VolumeSlider } from './VolumeSlider';
import { GestureIndicator } from './GestureIndicator';
import { MobileMuteIndicator } from './MobileMuteIndicator';
import { VideoPlayerInfoOverlay } from './VideoPlayerInfoOverlay';
import { PremiumLoader } from './PremiumLoader';
import { EncodingOverlay } from './EncodingOverlay';
import { useVideoGestures } from '@/hooks/useVideoGestures';


interface AudioTrackInfo {
  id: number;
  label: string;
  language: string;
  enabled: boolean;
}

interface SubtitleTrackInfo {
  id: number;
  label: string;
  language: string;
  enabled: boolean;
}

interface QualityLevel {
  id: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
}

import { ServerType } from '@/hooks/useServerAutoSelect';

export { type ServerType } from '@/hooks/useServerAutoSelect';

interface VideoPlayerProps {
  videoUrl: string | null;
  externalUrl: string | null;
  title: string;
  animeTitle: string;
  episodeNumber: number;
  seasonNumber?: number;
  episodeId: string;
  poster?: string;
  isMovie?: boolean;
  activeServer: ServerType;
  isLoading?: boolean;
  audioLanguage?: string;
  captionsUrl?: string | null;
  isEncoding?: boolean;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  introStartTime?: number | null;
  introEndTime?: number | null;
  outroStartTime?: number | null;
  outroEndTime?: number | null;
  savedPlaybackProgress?: number;
  onResumeChoice?: (resume: boolean) => void;
  onVideoLoadSuccess?: () => void;
  onVideoLoadError?: () => void;
}

const serverConfigs: Record<ServerType, { name: string; features: string[]; playerStyle: string }> = {
  PLAY: { 
    name: 'PLAY', 
    features: ['watch'],
    playerStyle: 'basic'
  },
  SHORT: { 
    name: 'SAVI.IN', 
    features: ['watch', 'quality'],
    playerStyle: 'standard'
  },
  Zex: { 
    name: 'Zex', 
    features: ['watch', 'quality', 'download'],
    playerStyle: 'advanced'
  },
};

// Playback speed options
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Helper to detect if URL is an embeddable/external URL (not a direct video file)
const isEmbeddableUrl = (url: string | null): boolean => {
  if (!url) return false;
  const embedPatterns = [
    /youtube\.com/i,
    /youtu\.be/i,
    /vimeo\.com/i,
    /dailymotion\.com/i,
    /drive\.google\.com/i,
    /docs\.google\.com/i,
    /dropbox\.com/i,
    /streamable\.com/i,
    /ok\.ru/i,
    /rutube\.ru/i,
    /mega\.nz/i,
    /mediafire\.com/i,
    /streamtape/i,
    /doodstream/i,
    /filemoon/i,
    /vidoza/i,
    /mixdrop/i,
    /upstream/i,
    /fembed/i,
    /iframe/i,
    /embed/i,
    /player/i,
    /watch\?/i,
    /\/e\//i,
    /\/v\//i,
  ];
  return embedPatterns.some(pattern => pattern.test(url));
};

// Helper to detect HLS streams
const isHlsUrl = (url: string | null): boolean => {
  if (!url) return false;
  return /\.m3u8(\?.*)?$/i.test(url) || url.includes('.m3u8');
};


// Helper to detect direct video file URLs that can be played natively
const isDirectVideoUrl = (url: string | null): boolean => {
  if (!url) return false;
  
  // Native HTML5 video extensions (works on all devices)
  const nativeVideoExtensions = /\.(mp4|webm|ogg|ogv|m4v)(\?.*)?$/i;
  
  // Known video hosting CDNs that serve direct video files
  const directVideoPatterns = [
    /supabase.*storage/i,
    /blob\.core\.windows\.net/i,
    /s3\.amazonaws\.com/i,
    /s3\.[a-z-]+\.amazonaws\.com/i,
    /cloudfront\.net.*\.(mp4|webm|m3u8)/i,
    /cdn\..*\.(mp4|webm|m3u8)/i,
    /akamaihd\.net/i,
    /fastly\.net/i,
    /bunnycdn/i,
    /cloudflare.*video/i,
    /r2\.cloudflarestorage/i,
    /storage\.googleapis\.com/i,
    /firebasestorage\.googleapis\.com/i,
  ];
  
  // Check for native video extensions first
  if (nativeVideoExtensions.test(url)) return true;
  
  // Check for known CDN patterns
  return directVideoPatterns.some(pattern => pattern.test(url));
};

type SettingsMenu = 'main' | 'quality' | 'audio' | 'subtitles' | 'speed';

export function VideoPlayer({
  videoUrl,
  externalUrl,
  title,
  animeTitle,
  episodeNumber,
  seasonNumber = 1,
  episodeId,
  poster,
  isMovie = false,
  activeServer,
  isLoading = false,
  audioLanguage = 'original',
  captionsUrl,
  isEncoding = false,
  onTimeUpdate,
  onNextEpisode,
  hasNextEpisode = false,
  introStartTime = null,
  introEndTime = null,
  outroStartTime = null,
  outroEndTime = null,
  savedPlaybackProgress = 0,
  onResumeChoice,
  onVideoLoadSuccess,
  onVideoLoadError,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(0);
  
  // Subtitle tracks
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackInfo[]>([]);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<number>(-1); // -1 = off
  
  // HLS Quality levels
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQualityLevel, setCurrentQualityLevel] = useState<number>(-1); // -1 = Auto
  const [isAutoQuality, setIsAutoQuality] = useState(true);
  
  // Bitrate indicator
  const [currentBitrate, setCurrentBitrate] = useState<number>(0);
  const [estimatedBandwidth, setEstimatedBandwidth] = useState<number>(0);
  
  // Quality preference key for localStorage
  const QUALITY_PREFERENCE_KEY = 'preferred_quality_level';
  
  // Playback speed
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  
  // Settings menu state
  const [settingsMenu, setSettingsMenu] = useState<SettingsMenu>('main');
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Keyboard shortcuts info state
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  
  // Skip intro/outro state - Use props if available, otherwise defaults
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);
  const INTRO_START = introStartTime ?? 0;
  const INTRO_END = introEndTime ?? 90;
  const OUTRO_START = outroStartTime; // Can be null
  const OUTRO_END = outroEndTime; // Can be null
  
  // Next episode button state with auto-hide
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const nextEpisodeTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Watch Next countdown state
  const [showWatchNextOverlay, setShowWatchNextOverlay] = useState(false);
  const [watchNextCountdown, setWatchNextCountdown] = useState(10);
  const watchNextIntervalRef = useRef<NodeJS.Timeout>();
  
  // Resume overlay state
  const [showResumeOverlay, setShowResumeOverlay] = useState(false);
  const [savedProgress, setSavedProgress] = useState(savedPlaybackProgress);
  
  // Initialize resume overlay based on saved progress
  useEffect(() => {
    if (savedPlaybackProgress > 5 && savedPlaybackProgress < 95) {
      setSavedProgress(savedPlaybackProgress);
      setShowResumeOverlay(true);
    }
  }, [savedPlaybackProgress]);
  
  // Video processing state for SAVI.IN server
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTimeLeft, setProcessingTimeLeft] = useState(180);
  const processingTimerRef = useRef<NodeJS.Timeout>();
  
  // Download verification dialog state
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  
  // Premium loading state - Netflix-style loader
  const [showPremiumLoader, setShowPremiumLoader] = useState(true);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  
  // Encoding overlay state
  const [showEncodingOverlay, setShowEncodingOverlay] = useState(isEncoding);
  
  // Double-tap state for mobile seek
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  
  // Mobile mute indicator state (shows when video is muted due to autoplay policy)
  const [showMobileUnmute, setShowMobileUnmute] = useState(false);
  const [wasMutedForAutoplay, setWasMutedForAutoplay] = useState(false);
  
  
  const features = serverConfigs[activeServer].features;
  
  // Get any available URL for playback
  const anyVideoUrl = videoUrl || externalUrl;
  const effectiveVideoUrl = anyVideoUrl;
  const shouldUseIframe = useIframeFallback;
  
  // Detect if mobile device (MUST be before hooks that use it)
  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  
  // Gesture controls hook for mobile
  const { gestureState, isGestureActive } = useVideoGestures({
    containerRef,
    videoRef,
    volume,
    onVolumeChange: (v) => {
      setVolume(v);
      if (videoRef.current) {
        videoRef.current.volume = v;
        if (v > 0 && isMuted) {
          setIsMuted(false);
          videoRef.current.muted = false;
        }
      }
    },
    brightness,
    onBrightnessChange: (b) => {
      setBrightness(b);
      if (videoRef.current) {
        videoRef.current.style.filter = `brightness(${b})`;
      }
    },
    zoom,
    onZoomChange: (z) => {
      setZoom(z);
      if (videoRef.current) {
        videoRef.current.style.transform = `scale(${z})`;
        videoRef.current.style.transformOrigin = 'center center';
      }
    },
    enabled: isMobile && !shouldUseIframe,
  });
  
  // Reset state when video URL or server changes
  useEffect(() => {
    setVideoError(false);
    setUseIframeFallback(false);
    setAudioTracks([]);
    setCurrentAudioTrack(0);
    setSubtitleTracks([]);
    setCurrentSubtitleTrack(-1);
    setQualityLevels([]);
    setCurrentQualityLevel(-1);
    setIsAutoQuality(true);
    setIsProcessing(false);
    setProcessingTimeLeft(180);
    setBuffered(0);
    setSettingsMenu('main');
    setPlaybackSpeed(1);
    setShowSkipIntro(false);
    setShowNextEpisode(false);
    setCurrentBitrate(0);
    setEstimatedBandwidth(0);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setShowPremiumLoader(true);
    setHasUserInteracted(false);
    
    if (processingTimerRef.current) {
      clearInterval(processingTimerRef.current);
    }
    
    // Cleanup HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    // Force reload video when server changes
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
      video.load();
    }
  }, [videoUrl, externalUrl, activeServer]);

  // HLS.js initialization for multi-audio and subtitle support
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !effectiveVideoUrl) return;

    const setupHls = () => {
      // Check if it's an HLS stream
      if (isHlsUrl(effectiveVideoUrl)) {
        // Destroy existing HLS instance
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        // Check if browser natively supports HLS (Safari)
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          console.log('Using native HLS support (Safari)');
          video.src = effectiveVideoUrl;
          
          // For Safari, use native audioTracks and textTracks API
            const detectNativeTracks = () => {
            // Audio tracks with advanced multilingual detection
            const nativeAudioTracks = (video as any).audioTracks;
            if (nativeAudioTracks && nativeAudioTracks.length > 0) {
              const tracks: AudioTrackInfo[] = [];
              const trackInfoForSelection: Array<{ label: string; lang: string; index: number }> = [];
              
              for (let i = 0; i < nativeAudioTracks.length; i++) {
                const track = nativeAudioTracks[i];
                const label = getAudioLabel(track.label, track.language, i);
                tracks.push({
                  id: i,
                  label,
                  language: track.language || 'Unknown',
                  enabled: track.enabled,
                });
                trackInfoForSelection.push({
                  label: track.label || '',
                  lang: track.language || '',
                  index: i,
                });
                if (track.enabled) setCurrentAudioTrack(i);
              }
              setAudioTracks(tracks);
              
              // Use advanced preference-based selection (Hindi default)
              const preferredIndex = getPreferredAudioTrack(trackInfoForSelection, animeTitle);
              console.log('Safari preferred audio track:', preferredIndex, 'for anime:', animeTitle);
              
              if (preferredIndex >= 0 && nativeAudioTracks[preferredIndex]) {
                for (let i = 0; i < nativeAudioTracks.length; i++) {
                  nativeAudioTracks[i].enabled = (i === preferredIndex);
                }
                setCurrentAudioTrack(preferredIndex);
                
                // iOS needs a seek nudge to apply the initial audio track selection
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                if (isIOS && video.currentTime > 0) {
                  video.currentTime = video.currentTime + 0.01;
                }
              }
            }
            
            // Subtitle tracks with advanced detection
            const nativeTextTracks = video.textTracks;
            if (nativeTextTracks && nativeTextTracks.length > 0) {
              const subs: SubtitleTrackInfo[] = [];
              for (let i = 0; i < nativeTextTracks.length; i++) {
                const track = nativeTextTracks[i];
                if (track.kind === 'subtitles' || track.kind === 'captions') {
                  subs.push({
                    id: i,
                    label: getSubtitleLabel(track.label, track.language, i),
                    language: track.language || 'Unknown',
                    enabled: track.mode === 'showing',
                  });
                  if (track.mode === 'showing') setCurrentSubtitleTrack(i);
                }
              }
              setSubtitleTracks(subs);
            }
          };
          
          video.addEventListener('loadedmetadata', detectNativeTracks);
          return () => video.removeEventListener('loadedmetadata', detectNativeTracks);
        }

        // Use HLS.js for other browsers
        if (Hls.isSupported()) {
          console.log('Using HLS.js for multi-audio and subtitle support');
          
          // Detect mobile and connection type for optimized settings
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          const connection = (navigator as any).connection;
          const isSlowNetwork = connection && (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g' || connection.saveData);
          const isCellular = connection && connection.type === 'cellular';
          
          console.log('Network info:', { isMobile, isSlowNetwork, isCellular, effectiveType: connection?.effectiveType });
          
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true, // Enable for faster start
            // FAST START: Minimal initial buffering
            maxBufferLength: 10, // Reduced for faster playback start
            maxMaxBufferLength: isMobile ? 30 : 60,
            maxBufferSize: isMobile ? 20 * 1000 * 1000 : 40 * 1000 * 1000,
            maxBufferHole: 0.3,
            // CRITICAL: Always start at lowest quality for instant playback
            startLevel: 0, // Force lowest quality for fastest start
            autoStartLoad: true,
            // Aggressive ABR for quick upscaling after start
            abrEwmaDefaultEstimate: isSlowNetwork ? 500000 : 1500000,
            abrBandWidthFactor: 0.9,
            abrBandWidthUpFactor: 0.8,
            abrMaxWithRealBitrate: true,
            backBufferLength: 5,
            // FAST loading timeouts
            fragLoadingTimeOut: 8000,
            fragLoadingMaxRetry: 3,
            fragLoadingRetryDelay: 500,
            levelLoadingTimeOut: 6000,
            levelLoadingMaxRetry: 3,
            levelLoadingRetryDelay: 500,
            manifestLoadingTimeOut: 5000,
            manifestLoadingMaxRetry: 2,
            manifestLoadingRetryDelay: 300,
            // XHR setup
            xhrSetup: (xhr, url) => {
              xhr.withCredentials = false;
            },
            // Progressive for faster initial segment
            progressive: true,
            capLevelToPlayerSize: isMobile,
            testBandwidth: false, // Skip bandwidth test for faster start
          });
          
          hlsRef.current = hls;
          hls.loadSource(effectiveVideoUrl);
          hls.attachMedia(video);

          // Listen for manifest parsed to get audio tracks, subtitles, and quality levels
          hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            console.log('HLS manifest parsed:', {
              audioTracks: data.audioTracks,
              subtitleTracks: hls.subtitleTracks,
              levels: data.levels
            });
            
            // Audio tracks with advanced multilingual detection
            if (data.audioTracks && data.audioTracks.length > 0) {
              const tracks: AudioTrackInfo[] = data.audioTracks.map((track, index) => ({
                id: track.id,
                label: getAudioLabel(track.name, track.lang, index),
                language: track.lang || 'Unknown',
                enabled: index === hls.audioTrack,
              }));
              setAudioTracks(tracks);
              
              // Use advanced audio track selection based on content and preferences (Hindi default)
              const preferredIndex = getPreferredAudioTrack(
                data.audioTracks.map((t, i) => ({ 
                  label: t.name || '', 
                  lang: t.lang || '', 
                  index: i 
                })),
                animeTitle
              );
              
              console.log('Preferred audio track:', preferredIndex, 'for anime:', animeTitle);
              
              if (preferredIndex >= 0 && preferredIndex < data.audioTracks.length) {
                hls.audioTrack = preferredIndex;
                setCurrentAudioTrack(preferredIndex);
                // Save the selected language preference
                const selectedTrack = data.audioTracks[preferredIndex];
                if (selectedTrack?.lang) {
                  localStorage.setItem('preferred_audio_language', selectedTrack.lang);
                }
              } else {
                setCurrentAudioTrack(hls.audioTrack);
              }
            }
            
            // Subtitle tracks
            if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
              const subs: SubtitleTrackInfo[] = hls.subtitleTracks.map((track, index) => ({
                id: index,
                label: getSubtitleLabel(track.name, track.lang, index),
                language: track.lang || 'Unknown',
                enabled: index === hls.subtitleTrack,
              }));
              setSubtitleTracks(subs);
              setCurrentSubtitleTrack(hls.subtitleTrack);
            }
            
            // Quality levels
            if (data.levels && data.levels.length > 0) {
              const levels: QualityLevel[] = data.levels.map((level, index) => ({
                id: index,
                height: level.height,
                width: level.width,
                bitrate: level.bitrate,
                label: getQualityLabel(level.height, level.bitrate),
              }));
              // Sort by height descending (highest quality first)
              levels.sort((a, b) => b.height - a.height);
              setQualityLevels(levels);
              console.log('Quality levels detected:', levels);
              
              // Check for anime-specific quality override first
              const animeQualityOverride = Object.entries(ANIME_QUALITY_OVERRIDES).find(
                ([key]) => animeTitle.toLowerCase().includes(key)
              );
              
              if (animeQualityOverride) {
                const targetHeight = animeQualityOverride[1];
                const matchingLevel = levels.find(l => l.height === targetHeight);
                if (matchingLevel) {
                  hls.currentLevel = matchingLevel.id;
                  setIsAutoQuality(false);
                  setCurrentQualityLevel(matchingLevel.id);
                } else {
                  setIsAutoQuality(true);
                  setCurrentQualityLevel(-1);
                }
              } else {
                // Check for saved quality preference
                const savedQuality = localStorage.getItem(QUALITY_PREFERENCE_KEY);
                if (savedQuality !== null) {
                  const preferredLevel = parseInt(savedQuality, 10);
                  if (preferredLevel === -1) {
                    setIsAutoQuality(true);
                    setCurrentQualityLevel(-1);
                  } else {
                    const matchingLevel = levels.find(l => l.height === preferredLevel);
                    if (matchingLevel) {
                      hls.currentLevel = matchingLevel.id;
                      setIsAutoQuality(false);
                      setCurrentQualityLevel(matchingLevel.id);
                    } else {
                      setIsAutoQuality(true);
                      setCurrentQualityLevel(-1);
                    }
                  }
                } else {
                  setIsAutoQuality(true);
                  setCurrentQualityLevel(-1);
                }
              }
            }
            
            // Auto play
            video.play().catch(() => {});
          });

          // Listen for audio track changes
          hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
            console.log('Audio track switched to:', data.id);
            setCurrentAudioTrack(data.id);
          });
          
          // Listen for subtitle track changes
          hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (event, data) => {
            console.log('Subtitle track switched to:', data.id);
            setCurrentSubtitleTrack(data.id);
          });
          
          // Listen for level changes and update bitrate
          hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            console.log('Quality level switched to:', data.level);
            const level = hls.levels[data.level];
            if (level) {
              setCurrentBitrate(level.bitrate);
            }
            if (!isAutoQuality) {
              setCurrentQualityLevel(data.level);
            }
          });
          
          // Track bandwidth estimation for bitrate indicator
          hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
            if (hls.bandwidthEstimate) {
              setEstimatedBandwidth(hls.bandwidthEstimate);
            }
          });

          // Enhanced error handling for mobile networks
          let networkRetryCount = 0;
          const MAX_NETWORK_RETRIES = 5;
          
          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS error:', data);
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  networkRetryCount++;
                  console.log(`Network error, attempting recovery... (attempt ${networkRetryCount}/${MAX_NETWORK_RETRIES})`);
                  if (networkRetryCount <= MAX_NETWORK_RETRIES) {
                    // Progressive backoff for mobile networks
                    const delay = Math.min(1000 * networkRetryCount, 5000);
                    setTimeout(() => {
                      if (hlsRef.current) {
                        hls.startLoad();
                      }
                    }, delay);
                  } else {
                    console.error('Max network retries reached');
                    setVideoError(true);
                  }
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.log('Media error, attempting recovery...');
                  hls.recoverMediaError();
                  break;
                default:
                  console.error('Unrecoverable error');
                  // Only set error after delay
                  setTimeout(() => {
                    if (hlsRef.current) {
                      setVideoError(true);
                    }
                  }, 3000);
                  break;
              }
            } else {
              // Non-fatal errors - log but don't interrupt playback
              console.warn('Non-fatal HLS error:', data.type, data.details);
            }
          });
          
          // Reset retry count on successful fragment load
          hls.on(Hls.Events.FRAG_LOADED, () => {
            networkRetryCount = 0;
          });
        }
      } else {
        // Non-HLS video - use native playback
        video.src = effectiveVideoUrl;
        
        // Try to detect audio tracks for MP4/MKV with multiple audio streams
        const detectNativeTracks = () => {
          // Audio tracks with advanced multilingual detection
          const nativeAudioTracks = (video as any).audioTracks;
          if (nativeAudioTracks && nativeAudioTracks.length > 0) {
            const tracks: AudioTrackInfo[] = [];
            const trackInfoForSelection: Array<{ label: string; lang: string; index: number }> = [];
            
            for (let i = 0; i < nativeAudioTracks.length; i++) {
              const track = nativeAudioTracks[i];
              const label = getAudioLabel(track.label, track.language, i);
              tracks.push({
                id: i,
                label,
                language: track.language || 'Unknown',
                enabled: track.enabled,
              });
              trackInfoForSelection.push({
                label: track.label || '',
                lang: track.language || '',
                index: i,
              });
              if (track.enabled) setCurrentAudioTrack(i);
            }
            setAudioTracks(tracks);
            
            // Use advanced preference-based selection (Hindi default)
            const preferredIndex = getPreferredAudioTrack(trackInfoForSelection, animeTitle);
            console.log('Native preferred audio track:', preferredIndex, 'for anime:', animeTitle);
            
            if (preferredIndex >= 0 && nativeAudioTracks[preferredIndex]) {
              for (let i = 0; i < nativeAudioTracks.length; i++) {
                nativeAudioTracks[i].enabled = (i === preferredIndex);
              }
              setCurrentAudioTrack(preferredIndex);
              
              // iOS needs a seek nudge to apply the initial audio track selection
              const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
              if (isIOS && video.currentTime > 0) {
                video.currentTime = video.currentTime + 0.01;
              }
            }
          }
          
          // Subtitle tracks with advanced detection
          const nativeTextTracks = video.textTracks;
          if (nativeTextTracks && nativeTextTracks.length > 0) {
            const subs: SubtitleTrackInfo[] = [];
            for (let i = 0; i < nativeTextTracks.length; i++) {
              const track = nativeTextTracks[i];
              if (track.kind === 'subtitles' || track.kind === 'captions') {
                subs.push({
                  id: i,
                  label: getSubtitleLabel(track.label, track.language, i),
                  language: track.language || 'Unknown',
                  enabled: track.mode === 'showing',
                });
                if (track.mode === 'showing') setCurrentSubtitleTrack(i);
              }
            }
            setSubtitleTracks(subs);
          }
        };
        
        video.addEventListener('loadedmetadata', detectNativeTracks);
        video.addEventListener('canplay', detectNativeTracks);
        
        return () => {
          video.removeEventListener('loadedmetadata', detectNativeTracks);
          video.removeEventListener('canplay', detectNativeTracks);
        };
      }
    };

    setupHls();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [effectiveVideoUrl]);

  // Advanced multilingual audio label detection
  // Uses centralized utility for consistent language detection across the app
  const getAudioLabel = useCallback((label: string | undefined, lang: string | undefined, index: number): string => {
    return getAudioTrackLabel(label, lang, index, animeTitle);
  }, [animeTitle]);

  // Advanced multilingual subtitle label detection
  const getSubtitleLabel = useCallback((label: string | undefined, lang: string | undefined, index: number): string => {
    return getSubtitleTrackLabel(label, lang, index);
  }, []);

  // Helper to get readable quality labels
  const getQualityLabel = (height: number, bitrate: number): string => {
    const bitrateKbps = Math.round(bitrate / 1000);
    const bitrateMbps = (bitrate / 1000000).toFixed(1);
    
    if (height >= 2160) return `4K (${bitrateMbps} Mbps)`;
    if (height >= 1440) return `1440p (${bitrateMbps} Mbps)`;
    if (height >= 1080) return `1080p (${bitrateMbps} Mbps)`;
    if (height >= 720) return `720p (${bitrateKbps} kbps)`;
    if (height >= 480) return `480p (${bitrateKbps} kbps)`;
    if (height >= 360) return `360p (${bitrateKbps} kbps)`;
    if (height >= 240) return `240p (${bitrateKbps} kbps)`;
    return `${height}p (${bitrateKbps} kbps)`;
  };

  // Switch quality level - HLS.js only, with preference saving
  const switchQualityLevel = useCallback((levelId: number) => {
    if (hlsRef.current) {
      if (levelId === -1) {
        // Auto quality
        hlsRef.current.currentLevel = -1;
        setIsAutoQuality(true);
        setCurrentQualityLevel(-1);
        localStorage.setItem(QUALITY_PREFERENCE_KEY, '-1');
        toast.success('Quality: Auto');
      } else {
        // Specific quality
        hlsRef.current.currentLevel = levelId;
        setIsAutoQuality(false);
        setCurrentQualityLevel(levelId);
        const level = qualityLevels.find(l => l.id === levelId);
        if (level) {
          localStorage.setItem(QUALITY_PREFERENCE_KEY, level.height.toString());
        }
        toast.success(`Quality: ${level?.height || levelId}p`);
      }
    }
    setSettingsOpen(false);
  }, [qualityLevels]);

  // Switch audio track - works with both HLS.js and native
  // HLS.js is the primary method for audio switching on all platforms
  // Native API works on Safari/Firefox/iOS, but not Chrome/Edge for MP4
  const switchAudioTrack = useCallback((trackId: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const wasPlaying = !video.paused;
    const savedTime = video.currentTime;
    
    // Try HLS.js first - this is the primary and most reliable method
    if (hlsRef.current && hlsRef.current.audioTracks.length > 0) {
      console.log('Switching audio track via HLS.js:', trackId, 'on platform:', navigator.userAgent);
      
      hlsRef.current.audioTrack = trackId;
      const track = hlsRef.current.audioTracks[trackId];
      
      // Save audio preference (both track index and language)
      localStorage.setItem('preferred_audio_track', trackId.toString());
      if (track?.lang) {
        localStorage.setItem('preferred_audio_language', track.lang);
      }
      
      toast.success(`Audio: ${track?.name || `Track ${trackId + 1}`}`);
      setCurrentAudioTrack(trackId);
      setSettingsOpen(false);
      
      // Resume playback if was playing (some browsers pause on track switch)
      if (wasPlaying) {
        setTimeout(() => {
          video.play().catch(() => {});
        }, 100);
      }
      return;
    }
    
    // Native audioTracks API - required for iOS Safari with MP4 files
    const nativeAudioTracks = (video as any).audioTracks;
    if (nativeAudioTracks && nativeAudioTracks.length > 0) {
      console.log('Switching audio track via native API:', trackId, 'iOS:', isIOS, 'Safari:', isSafari);
      
      // iOS/Safari specific: disable all first, then enable target
      for (let i = 0; i < nativeAudioTracks.length; i++) {
        nativeAudioTracks[i].enabled = (i === trackId);
      }
      
      const track = nativeAudioTracks[trackId];
      
      // Save preferences
      localStorage.setItem('preferred_audio_track', trackId.toString());
      if (track?.language) {
        localStorage.setItem('preferred_audio_language', track.language);
      }
      
      // iOS Safari may need a seek nudge to actually switch the audio stream
      if (isIOS || isSafari) {
        console.log('iOS/Safari: applying seek nudge for audio switch');
        // Small seek to force audio pipeline refresh
        video.currentTime = savedTime + 0.01;
        
        // Verify the switch took effect after a short delay
        setTimeout(() => {
          if (nativeAudioTracks[trackId] && !nativeAudioTracks[trackId].enabled) {
            console.warn('iOS audio switch may not have taken effect, retrying...');
            for (let i = 0; i < nativeAudioTracks.length; i++) {
              nativeAudioTracks[i].enabled = (i === trackId);
            }
            video.currentTime = savedTime;
          }
          if (wasPlaying) {
            video.play().catch(() => {});
          }
        }, 200);
      } else if (wasPlaying) {
        setTimeout(() => {
          video.play().catch(() => {});
        }, 100);
      }
      
      toast.success(`Audio: ${track?.label || `Track ${trackId + 1}`}`);
      setCurrentAudioTrack(trackId);
      setSettingsOpen(false);
      return;
    }
    
    // No audio tracks available - inform user with helpful message
    console.warn('No audio tracks available via native API');
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
    const isWindows = /Windows/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if ((isChrome || isWindows) && !isAndroid) {
      toast.info('Audio track switching works best with HLS streams (.m3u8). For MP4 files, try using Safari or Firefox.');
    } else {
      toast.error('Audio track switching is not available for this video');
    }
    setSettingsOpen(false);
  }, []);

  // Switch subtitle track - works with both HLS.js and native
  const switchSubtitleTrack = useCallback((trackId: number) => {
    const video = videoRef.current;
    
    // Try HLS.js first
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = trackId;
      if (trackId === -1) {
        toast.success('Subtitles: Off');
      } else {
        const track = hlsRef.current.subtitleTracks[trackId];
        toast.success(`Subtitles: ${track?.name || `Track ${trackId + 1}`}`);
      }
      setCurrentSubtitleTrack(trackId);
      setSettingsOpen(false);
      return;
    }
    
    // Fallback to native textTracks API
    if (video) {
      const nativeTextTracks = video.textTracks;
      if (nativeTextTracks && nativeTextTracks.length > 0) {
        for (let i = 0; i < nativeTextTracks.length; i++) {
          const track = nativeTextTracks[i];
          if (track.kind === 'subtitles' || track.kind === 'captions') {
            track.mode = i === trackId ? 'showing' : 'hidden';
          }
        }
        if (trackId === -1) {
          toast.success('Subtitles: Off');
        } else {
          const track = nativeTextTracks[trackId];
          toast.success(`Subtitles: ${track?.label || `Track ${trackId + 1}`}`);
        }
        setCurrentSubtitleTrack(trackId);
      }
    }
    setSettingsOpen(false);
  }, []);

  // Change playback speed
  const changePlaybackSpeed = useCallback((speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      toast.success(`Speed: ${speed}x`);
    }
    setSettingsOpen(false);
  }, []);

  // Skip intro handler
  const handleSkipIntro = useCallback(() => {
    if (videoRef.current && INTRO_END) {
      videoRef.current.currentTime = INTRO_END;
      setShowSkipIntro(false);
      toast.success('Skipped intro');
    }
  }, [INTRO_END]);

  // Skip outro handler
  const handleSkipOutro = useCallback(() => {
    if (videoRef.current && OUTRO_END) {
      videoRef.current.currentTime = OUTRO_END;
      setShowSkipOutro(false);
      toast.success('Skipped outro');
    } else if (onNextEpisode) {
      onNextEpisode();
    }
  }, [OUTRO_END, onNextEpisode]);

  // Handle SAVI.IN processing simulation
  useEffect(() => {
    if (activeServer === 'SHORT' && videoError && !isProcessing) {
      setIsProcessing(true);
      setProcessingTimeLeft(180);
      
      processingTimerRef.current = setInterval(() => {
        setProcessingTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(processingTimerRef.current);
            setIsProcessing(false);
            setVideoError(false);
            if (videoRef.current) {
              videoRef.current.load();
              videoRef.current.play().catch(() => {});
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (processingTimerRef.current) {
        clearInterval(processingTimerRef.current);
      }
    };
  }, [activeServer, videoError, isProcessing]);

  // CRITICAL: Cleanup video on unmount
  useEffect(() => {
    const video = videoRef.current;
    
    return () => {
      if (video) {
        video.pause();
        video.src = '';
        video.load();
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Handle fullscreen changes - COMPREHENSIVE FIX
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFS);
      
      // CRITICAL: Ensure controls are shown when entering fullscreen
      if (isFS) {
        setShowControls(true);
      }
    };

    // Listen to all fullscreen events
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    // Also listen for video element specific events (iOS)
    const video = videoRef.current;
    if (video) {
      video.addEventListener('webkitbeginfullscreen', () => setIsFullscreen(true));
      video.addEventListener('webkitendfullscreen', () => setIsFullscreen(false));
    }
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', () => setIsFullscreen(true));
        video.removeEventListener('webkitendfullscreen', () => setIsFullscreen(false));
      }
    };
  }, []);

  // Auto-hide controls with IMPROVED logic
  useEffect(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    if (isPlaying && showControls && !settingsOpen) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000); // Increased to 3 seconds
    } else if (!isPlaying) {
      // Always show controls when paused
      setShowControls(true);
    }
    
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showControls, settingsOpen]);

  // Mouse/touch movement handler - ENHANCED for fullscreen
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    if (isPlaying && !settingsOpen) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying, settingsOpen]);

  // Touch handler for mobile - ENHANCED
  const handleTouchStart = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    if (isPlaying && !settingsOpen) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 4000); // Longer timeout for touch
    }
  }, [isPlaying, settingsOpen]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return isMovie ? '0:00:00' : '0:00';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (isMovie || hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      const prog = (current / dur) * 100;
      setProgress(prog);
      setCurrentTime(current);
      setDuration(dur);
      onTimeUpdate?.(current, dur);
      
      // Update buffered progress
      if (videoRef.current.buffered.length > 0) {
        const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        const bufferedProgress = (bufferedEnd / dur) * 100;
        setBuffered(bufferedProgress);
      }
      
      // Show skip intro button during intro (only if intro times are set)
      if (INTRO_END && current >= INTRO_START && current < INTRO_END && !isMovie) {
        setShowSkipIntro(true);
      } else {
        setShowSkipIntro(false);
      }
      
      // Show skip outro button during outro (only if outro times are set)
      if (OUTRO_START && current >= OUTRO_START && (!OUTRO_END || current < OUTRO_END) && !isMovie) {
        setShowSkipOutro(true);
      } else {
        setShowSkipOutro(false);
      }
      
      // Show next episode button when 20 seconds left
      const secondsLeft = dur - current;
      const nearEnd = dur > 0 && secondsLeft <= 20;
      if (nearEnd && hasNextEpisode && !isMovie) {
        if (!showNextEpisode) {
          setShowNextEpisode(true);
          // Auto-hide after 2 seconds if not interacted
          if (nextEpisodeTimeoutRef.current) {
            clearTimeout(nextEpisodeTimeoutRef.current);
          }
          nextEpisodeTimeoutRef.current = setTimeout(() => {
            setShowNextEpisode(false);
          }, 2000);
        }
      }
      
      // Show Watch Next overlay when video ends (within 5 seconds of end)
      if (dur > 0 && secondsLeft <= 5 && hasNextEpisode && !isMovie && !showWatchNextOverlay) {
        setShowWatchNextOverlay(true);
        setWatchNextCountdown(10);
      }
    }
  };
  
  // Watch Next countdown effect
  useEffect(() => {
    if (showWatchNextOverlay && hasNextEpisode && onNextEpisode) {
      watchNextIntervalRef.current = setInterval(() => {
        setWatchNextCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(watchNextIntervalRef.current);
            onNextEpisode();
            setShowWatchNextOverlay(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (watchNextIntervalRef.current) {
          clearInterval(watchNextIntervalRef.current);
        }
      };
    }
  }, [showWatchNextOverlay, hasNextEpisode, onNextEpisode]);
  
  // Cancel Watch Next
  const cancelWatchNext = useCallback(() => {
    if (watchNextIntervalRef.current) {
      clearInterval(watchNextIntervalRef.current);
    }
    setShowWatchNextOverlay(false);
    setWatchNextCountdown(10);
  }, []);
  
  // Handle resume overlay - show when there's saved progress
  const handleResumeChoice = useCallback((resume: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    
    if (resume && savedProgress > 0 && video.duration > 0) {
      const seekTime = (savedProgress / 100) * video.duration;
      video.currentTime = seekTime;
      toast.success(`Resuming from ${Math.round(savedProgress)}%`);
    } else {
      video.currentTime = 0;
      toast.success('Starting from beginning');
    }
    setShowResumeOverlay(false);
    onResumeChoice?.(resume);
    video.play().catch(() => {});
  }, [savedProgress, onResumeChoice]);

  // Reset next episode visibility on mouse move
  useEffect(() => {
    if (showControls && duration > 0 && duration - currentTime <= 20 && hasNextEpisode && !isMovie) {
      setShowNextEpisode(true);
      if (nextEpisodeTimeoutRef.current) {
        clearTimeout(nextEpisodeTimeoutRef.current);
      }
      nextEpisodeTimeoutRef.current = setTimeout(() => {
        setShowNextEpisode(false);
      }, 2000);
    }
    return () => {
      if (nextEpisodeTimeoutRef.current) {
        clearTimeout(nextEpisodeTimeoutRef.current);
      }
    };
  }, [showControls, duration, currentTime, hasNextEpisode, isMovie]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const time = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = time;
      setProgress(parseFloat(e.target.value));
    }
  };

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // Auto-unmute on user interaction (mobile autoplay starts muted)
        if (isMobile && videoRef.current.muted && wasMutedForAutoplay) {
          videoRef.current.muted = false;
          setIsMuted(false);
          setShowMobileUnmute(false);
          setWasMutedForAutoplay(false);
        }
        videoRef.current.play().catch((error) => {
          console.warn('Play failed:', error);
          // If play fails, try muted
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            setWasMutedForAutoplay(true);
            setShowMobileUnmute(true);
            videoRef.current.play().catch(() => {});
          }
        });
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying, isMobile, wasMutedForAutoplay]);

  // Handler for mobile unmute indicator tap
  const handleMobileUnmute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
      setShowMobileUnmute(false);
      setWasMutedForAutoplay(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      if (newVolume > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      } else if (newVolume === 0 && !isMuted) {
        videoRef.current.muted = true;
        setIsMuted(true);
      }
    }
  }, [isMuted]);

  // ENHANCED Fullscreen toggle - fixes all control issues
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    
    if (!container) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    try {
      // Check current fullscreen state
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      const isVideoInNativeFullscreen = video && (
        (video as any).webkitDisplayingFullscreen === true ||
        (video as any).webkitPresentationMode === 'fullscreen'
      );

      if (isCurrentlyFullscreen || isVideoInNativeFullscreen) {
        // EXIT FULLSCREEN
        if (isVideoInNativeFullscreen && (video as any).webkitExitFullscreen) {
          (video as any).webkitExitFullscreen();
        } else if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
        setIsFullscreen(false);
      } else {
        // ENTER FULLSCREEN
        // For iOS, use native video fullscreen
        if (isIOS && video) {
          if ((video as any).webkitEnterFullscreen) {
            (video as any).webkitEnterFullscreen();
            setIsFullscreen(true);
            return;
          }
          if ((video as any).webkitSupportsPresentationMode) {
            (video as any).webkitSetPresentationMode('fullscreen');
            setIsFullscreen(true);
            return;
          }
        }

        // For all other browsers - use CONTAINER fullscreen to keep custom controls
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          (container as any).msRequestFullscreen();
        }
        
        setIsFullscreen(true);
        setShowControls(true);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
      setIsFullscreen(!isFullscreen);
    }
  }, [isFullscreen]);

  const skipForward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, videoRef.current.duration);
    }
  }, []);

  const skipBackward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
    }
  }, []);

  // Picture-in-Picture toggle
  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        toast.success('Exited Picture-in-Picture');
      } else if (isIOS) {
        if ((video as any).webkitSupportsPresentationMode && 
            typeof (video as any).webkitSetPresentationMode === 'function') {
          (video as any).webkitSetPresentationMode('picture-in-picture');
          toast.success('Now playing in Picture-in-Picture mode');
        } else {
          toast.error('Picture-in-Picture is not supported on this iOS device');
        }
      } else if (document.pictureInPictureEnabled) {
        if (video.requestPictureInPicture) {
          await video.requestPictureInPicture();
          toast.success('Now playing in Picture-in-Picture mode');
        } else {
          toast.error('Picture-in-Picture is not supported on this device');
        }
      } else {
        toast.error('Picture-in-Picture is not supported');
      }
    } catch (error) {
      console.error('PiP error:', error);
      toast.error('Failed to enter Picture-in-Picture mode');
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'p':
          e.preventDefault();
          togglePiP();
          break;
        case 'arrowright':
          e.preventDefault();
          skipForward();
          break;
        case 'arrowleft':
          e.preventDefault();
          skipBackward();
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          toast.success(`Volume: ${Math.round(Math.min(1, volume + 0.1) * 100)}%`);
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          toast.success(`Volume: ${Math.round(Math.max(0, volume - 0.1) * 100)}%`);
          break;
        case 'escape':
          if (isFullscreen) {
            e.preventDefault();
            toggleFullscreen();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, togglePiP, skipForward, skipBackward, isFullscreen, toggleMute, handleVolumeChange, volume]);

  const handleDownload = () => {
    if (!effectiveVideoUrl) {
      toast.error('No video available for download');
      return;
    }
    setShowDownloadDialog(true);
  };

  // Double-tap handler for mobile seek
  const handleDoubleTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    const touch = e.touches[0] || e.changedTouches[0];
    const x = touch.clientX;
    const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
    
    const timeSinceLastTap = now - lastTapRef.current.time;
    const distanceFromLastTap = Math.abs(x - lastTapRef.current.x);
    
    if (timeSinceLastTap < 300 && distanceFromLastTap < 50) {
      e.preventDefault();
      const side = x < containerWidth / 2 ? 'left' : 'right';
      
      if (side === 'left') {
        skipBackward();
        setDoubleTapSide('left');
      } else {
        skipForward();
        setDoubleTapSide('right');
      }
      
      setTimeout(() => setDoubleTapSide(null), 500);
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x };
    }
  }, [skipForward, skipBackward]);

  // Click handler for desktop
  const handleVideoAreaClick = useCallback((e: React.MouseEvent) => {
    if (videoError) return;
    if ('ontouchstart' in window) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    const interactiveSelector =
      'button, a, input, textarea, select, [role="menuitem"], [role="option"], [data-radix-collection-item]';

    if (target.closest(interactiveSelector)) return;

    e.preventDefault();
    togglePlay();
  }, [togglePlay, videoError]);

  // Touch end handler for mobile
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    const touch = e.changedTouches[0];
    const x = touch.clientX;
    const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
    
    const timeSinceLastTap = now - lastTapRef.current.time;
    const distanceFromLastTap = Math.abs(x - lastTapRef.current.x);
    
    if (timeSinceLastTap < 300 && distanceFromLastTap < 50) {
      e.preventDefault();
      const side = x < containerWidth / 2 ? 'left' : 'right';
      const center = containerWidth / 3;
      
      if (x > center && x < containerWidth - center) {
        togglePlay();
      } else if (side === 'left') {
        skipBackward();
        setDoubleTapSide('left');
        setTimeout(() => setDoubleTapSide(null), 500);
      } else {
        skipForward();
        setDoubleTapSide('right');
        setTimeout(() => setDoubleTapSide(null), 500);
      }
      
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x };
      
      const target = e.target as HTMLElement;
      const interactiveSelector = 'button, a, input, textarea, select, [role="menuitem"]';
      if (!target.closest(interactiveSelector)) {
        setShowControls(true);
      }
    }
  }, [skipForward, skipBackward, togglePlay]);

  // Get current quality/audio/subtitle labels for display
  const getCurrentQualityLabel = () => {
    if (isAutoQuality) return 'Auto (1080p)';
    const level = qualityLevels.find(l => l.id === currentQualityLevel);
    return level ? `${level.height}p` : 'Auto';
  };

  const getCurrentAudioLabel = () => {
    const track = audioTracks.find(t => t.id === currentAudioTrack);
    return track?.label || '🇮🇳 Hindi';
  };

  const getCurrentSubtitleLabel = () => {
    if (currentSubtitleTrack === -1) return 'Off';
    const track = subtitleTracks.find(t => t.id === currentSubtitleTrack);
    return track?.label || 'Off';
  };

  // Loading state
  if (isLoading) {
    return (
      <div 
        ref={containerRef} 
        className="relative bg-black w-full"
        style={{ aspectRatio: '16/9', maxHeight: isFullscreen ? '100vh' : '70vh' }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-white text-lg">Loading {serverConfigs[activeServer]?.name || activeServer} server...</p>
        </div>
      </div>
    );
  }

  // External URL player (iframe) - Only use for embeddable URLs, not direct video/storage URLs
  if (shouldUseIframe && anyVideoUrl) {
    // Check if URL is a direct video/storage URL that won't work in an iframe
    const isStorageUrl = /supabase.*storage|blob\.core\.windows|s3\.amazonaws|cloudfront\.net|r2\.cloudflarestorage|storage\.googleapis/i.test(anyVideoUrl);
    const isDirectFile = /\.(mp4|mkv|webm|avi|m3u8|m4v)(\?.*)?$/i.test(anyVideoUrl);
    
    if (isStorageUrl || isDirectFile) {
      // For direct video URLs, fall back to native player instead of iframe
      return (
        <div 
          ref={containerRef} 
          className={`relative bg-black w-full ${isFullscreen ? 'fixed inset-0 z-[9999]' : ''}`}
          style={{ 
            aspectRatio: isFullscreen ? undefined : '16/9', 
            maxHeight: isFullscreen ? '100vh' : '70vh',
            height: isFullscreen ? '100vh' : undefined,
          }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="text-destructive mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <h3 className="text-white font-semibold text-lg">Video Not Available</h3>
            <p className="text-white/70 text-sm max-w-md">
              This video file could not be played. It may have been removed or the link is broken.
            </p>
            <Button
              onClick={() => {
                setUseIframeFallback(false);
                setVideoError(false);
                if (videoRef.current) {
                  videoRef.current.load();
                  videoRef.current.play().catch(() => {});
                }
              }}
              variant="outline"
              className="text-white border-white/30 hover:bg-white/10"
            >
              Try Again
            </Button>
          </div>
        </div>
      );
    }
    
    return (
      <div 
        ref={containerRef} 
        className={`relative bg-black w-full ${isFullscreen ? 'fixed inset-0 z-[9999]' : ''}`}
        style={{ 
          aspectRatio: isFullscreen ? undefined : '16/9', 
          maxHeight: isFullscreen ? '100vh' : '70vh',
          height: isFullscreen ? '100vh' : undefined,
        }}
      >
        <iframe
          src={`${anyVideoUrl}${anyVideoUrl.includes('?') ? '&' : '?'}autoplay=1`}
          className="w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          title={`${animeTitle} - Episode ${episodeNumber}`}
          style={{ border: 'none' }}
          sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
        />
      </div>
    );
  }

  // No video available
  if (!anyVideoUrl) {
    return (
      <div 
        className="w-full flex items-center justify-center bg-muted"
        style={{ aspectRatio: '16/9', maxHeight: '70vh' }}
      >
        <p className="text-muted-foreground">Video not available</p>
      </div>
    );
  }

  // Render settings menu content - Fixed click handling
  const renderSettingsContent = () => {
    switch (settingsMenu) {
      case 'quality':
        return (
          <div className="py-1">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSettingsMenu('main'); }}
              className="flex items-center gap-2 cursor-pointer text-muted-foreground w-full px-2 py-2 hover:bg-accent rounded-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Quality</DropdownMenuLabel>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); switchQualityLevel(-1); }}
              className={`${isAutoQuality ? 'bg-primary/20' : ''} flex items-center justify-between gap-4 cursor-pointer w-full px-2 py-2 hover:bg-accent rounded-sm`}
            >
              <span className="text-sm">Auto (1080p)</span>
              {isAutoQuality && <Check className="w-4 h-4 text-primary" />}
            </button>
            {qualityLevels.length > 0 ? (
              qualityLevels.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); switchQualityLevel(level.id); }}
                  className={`${!isAutoQuality && currentQualityLevel === level.id ? 'bg-primary/20' : ''} flex items-center justify-between gap-4 cursor-pointer w-full px-2 py-2 hover:bg-accent rounded-sm`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{level.height}p</span>
                    {level.height >= 1080 && (
                      <span className="text-[10px] font-bold bg-primary/20 text-primary px-1 py-0.5 rounded">HD</span>
                    )}
                  </div>
                  {!isAutoQuality && currentQualityLevel === level.id && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))
            ) : (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                Auto quality active
              </div>
            )}
          </div>
        );
      
      case 'audio':
        return (
          <div className="py-1">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSettingsMenu('main'); }}
              className="flex items-center gap-2 cursor-pointer text-muted-foreground w-full px-2 py-2 hover:bg-accent rounded-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Audio Track</DropdownMenuLabel>
            {audioTracks.length > 0 ? (
              audioTracks.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); switchAudioTrack(track.id); }}
                  className={`${currentAudioTrack === track.id ? 'bg-primary/20' : ''} flex items-center justify-between gap-4 cursor-pointer w-full px-2 py-2 hover:bg-accent rounded-sm`}
                >
                  <span className="text-sm">{track.label}</span>
                  {currentAudioTrack === track.id && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))
            ) : (
              <div className="flex items-center justify-between gap-4 w-full px-2 py-2 bg-primary/20 rounded-sm">
                <span className="text-sm">🇮🇳 Hindi</span>
                <Check className="w-4 h-4 text-primary" />
              </div>
            )}
          </div>
        );
      
      case 'subtitles':
        // Hide subtitles submenu entirely if no subtitle tracks exist
        if (subtitleTracks.length === 0) {
          // Auto-redirect back to main menu since there are no subtitles
          setSettingsMenu('main');
          return null;
        }
        return (
          <div className="py-1">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSettingsMenu('main'); }}
              className="flex items-center gap-2 cursor-pointer text-muted-foreground w-full px-2 py-2 hover:bg-accent rounded-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Subtitles</DropdownMenuLabel>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); switchSubtitleTrack(-1); }}
              className={`${currentSubtitleTrack === -1 ? 'bg-primary/20' : ''} flex items-center justify-between gap-4 cursor-pointer w-full px-2 py-2 hover:bg-accent rounded-sm`}
            >
              <span className="text-sm">Off</span>
              {currentSubtitleTrack === -1 && <Check className="w-4 h-4 text-primary" />}
            </button>
            {subtitleTracks.map((track) => (
              <button
                key={track.id}
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); switchSubtitleTrack(track.id); }}
                className={`${currentSubtitleTrack === track.id ? 'bg-primary/20' : ''} flex items-center justify-between gap-4 cursor-pointer w-full px-2 py-2 hover:bg-accent rounded-sm`}
              >
                <span className="text-sm">{track.label}</span>
                {currentSubtitleTrack === track.id && <Check className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        );
      
      case 'speed':
        return (
          <div className="py-1">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSettingsMenu('main'); }}
              className="flex items-center gap-2 cursor-pointer text-muted-foreground w-full px-2 py-2 hover:bg-accent rounded-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Playback Speed</DropdownMenuLabel>
            {PLAYBACK_SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); changePlaybackSpeed(speed); }}
                className={`${playbackSpeed === speed ? 'bg-primary/20' : ''} flex items-center justify-between gap-4 cursor-pointer w-full px-2 py-2 hover:bg-accent rounded-sm`}
              >
                <span className="text-sm">{speed}x</span>
                {playbackSpeed === speed && <Check className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        );
      
      default: // main menu
        return (
          <div className="py-1">
            <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-2">
              <Settings className="w-3 h-3" />
              Settings
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Speed option */}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSettingsMenu('speed'); }}
              className="flex items-center justify-between gap-4 cursor-pointer w-full px-2 py-2 hover:bg-accent rounded-sm"
            >
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                <span className="text-sm">Speed</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="text-xs">{playbackSpeed}x</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
            
            {/* Quality option */}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSettingsMenu('quality'); }}
              className="flex items-center justify-between gap-4 cursor-pointer w-full px-2 py-2 hover:bg-accent rounded-sm"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="text-sm">Quality</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="text-xs">{getCurrentQualityLabel()}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
            
            {/* Audio option */}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSettingsMenu('audio'); }}
              className="flex items-center justify-between gap-4 cursor-pointer w-full px-2 py-2 hover:bg-accent rounded-sm"
            >
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4" />
                <span className="text-sm">Audio</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="text-xs truncate max-w-[80px]">{getCurrentAudioLabel()}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
            
            {/* Subtitles option - only show if subtitles exist */}
            {subtitleTracks.length > 0 && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSettingsMenu('subtitles'); }}
                className="flex items-center justify-between gap-4 cursor-pointer w-full px-2 py-2 hover:bg-accent rounded-sm"
              >
                <div className="flex items-center gap-2">
                  <Subtitles className="w-4 h-4" />
                  <span className="text-sm">Subtitles</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="text-xs truncate max-w-[80px]">{getCurrentSubtitleLabel()}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            )}
          </div>
        );
    }
  };

  // Native video player with HLS.js support
  return (
    <div 
      ref={containerRef} 
      className={`relative bg-black w-full touch-manipulation select-none ${
        isFullscreen 
          ? 'fixed inset-0 z-[9999]' 
          : ''
      } ${!showControls && isPlaying ? 'cursor-none' : ''}`}
      style={{ 
        aspectRatio: isFullscreen ? undefined : '16/9', 
        maxHeight: isFullscreen ? '100dvh' : '70vh',
        height: isFullscreen ? '100dvh' : undefined,
        width: isFullscreen ? '100vw' : undefined,
        paddingTop: isFullscreen ? 'env(safe-area-inset-top)' : undefined,
        paddingBottom: isFullscreen ? 'env(safe-area-inset-bottom)' : undefined,
        paddingLeft: isFullscreen ? 'env(safe-area-inset-left)' : undefined,
        paddingRight: isFullscreen ? 'env(safe-area-inset-right)' : undefined,
      }}
      onClick={handleVideoAreaClick}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseLeave={() => isPlaying && !settingsOpen && setShowControls(false)}
    >

      {/* Encoding Overlay - shows when video is being encoded */}
      <EncodingOverlay
        isVisible={showEncodingOverlay}
        episodeId={episodeId}
        onComplete={() => setShowEncodingOverlay(false)}
      />

      {/* Premium Loading Animation - Netflix-style loader */}
      <PremiumLoader isVisible={showPremiumLoader && !shouldUseIframe && !!effectiveVideoUrl && !showEncodingOverlay} />

      {/* Buffering Indicator - only show after initial load */}
      <BufferingIndicator 
        videoRef={videoRef}
        isVisible={!shouldUseIframe && !!effectiveVideoUrl && !showPremiumLoader}
      />

      {/* Video Player Info Overlay - Anime Title & Episode/Season */}
      <VideoPlayerInfoOverlay
        animeTitle={animeTitle}
        episodeNumber={episodeNumber}
        seasonNumber={seasonNumber}
        isVisible={showControls && !isMovie}
      />

      {/* Quality Overlay */}
      <QualityOverlay
        currentBitrate={currentBitrate}
        estimatedBandwidth={estimatedBandwidth}
        qualityLevels={qualityLevels}
        currentQualityLevel={currentQualityLevel}
        isAutoQuality={isAutoQuality}
        onQualityChange={switchQualityLevel}
        isVisible={showControls && qualityLevels.length > 0}
        position="bottom-left"
      />

      {/* Gesture Indicator for mobile swipe controls */}
      <GestureIndicator
        type={gestureState.type}
        value={gestureState.value}
        isVisible={isGestureActive}
        position={gestureState.type === 'brightness' ? 'left' : gestureState.type === 'volume' ? 'right' : 'center'}
      />

      {/* Double-tap seek indicators */}
      {doubleTapSide === 'left' && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-[100] pointer-events-none animate-fade-in">
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-4 flex items-center gap-2">
            <SkipBack className="w-8 h-8 text-white" />
            <span className="text-white font-bold text-lg">10s</span>
          </div>
        </div>
      )}
      {doubleTapSide === 'right' && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[100] pointer-events-none animate-fade-in">
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-4 flex items-center gap-2">
            <span className="text-white font-bold text-lg">10s</span>
            <SkipForward className="w-8 h-8 text-white" />
          </div>
        </div>
      )}

      {/* Skip Intro Button - REMOVED per user request */}

      {/* Skip Outro Button */}
      {showSkipOutro && !showNextEpisode && (
        <button
          onClick={(e) => { e.stopPropagation(); handleSkipOutro(); }}
          className="absolute bottom-28 right-4 z-[100] px-6 py-3 bg-white/90 hover:bg-white text-black font-semibold rounded-lg shadow-lg transition-all duration-300 flex items-center gap-2"
        >
          <FastForward className="w-5 h-5" />
          Skip Outro
        </button>
      )}

      {/* Next Episode Button */}
      {showNextEpisode && hasNextEpisode && onNextEpisode && !showWatchNextOverlay && (
        <button
          onClick={(e) => { e.stopPropagation(); onNextEpisode(); }}
          className="absolute bottom-28 right-4 z-[100] px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-lg transition-all duration-300 flex items-center gap-2 animate-fade-in"
        >
          Next Episode
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
      
      {/* Watch Next Overlay with Countdown */}
      {showWatchNextOverlay && hasNextEpisode && onNextEpisode && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-[150] animate-fade-in">
          <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-8 max-w-md mx-4 shadow-2xl animate-scale-in text-center">
            <div className="mb-4">
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-muted/30"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray={276.46}
                    strokeDashoffset={276.46 * (1 - watchNextCountdown / 10)}
                    className="text-primary transition-all duration-1000"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-foreground">
                  {watchNextCountdown}
                </span>
              </div>
            </div>
            <h3 className="text-foreground font-heading font-bold text-xl mb-2">
              Up Next
            </h3>
            <p className="text-muted-foreground mb-6">
              Playing next episode in {watchNextCountdown} seconds...
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={(e) => { e.stopPropagation(); onNextEpisode(); setShowWatchNextOverlay(false); }}
                className="anime-button px-6"
              >
                <Play className="w-4 h-4 mr-2 fill-current" />
                Play Now
              </Button>
              <Button
                onClick={(e) => { e.stopPropagation(); cancelWatchNext(); }}
                variant="outline"
                className="px-6"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Resume Overlay - Skip/Resume choice */}
      {showResumeOverlay && savedProgress > 5 && savedProgress < 95 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-[150] animate-fade-in">
          <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-8 max-w-md mx-4 shadow-2xl animate-scale-in text-center">
            <div className="mb-4">
              <Play className="w-16 h-16 text-primary mx-auto" />
            </div>
            <h3 className="text-foreground font-heading font-bold text-xl mb-2">
              Resume Watching?
            </h3>
            <p className="text-muted-foreground mb-6">
              You were {Math.round(savedProgress)}% through this episode
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={(e) => { e.stopPropagation(); handleResumeChoice(true); }}
                className="anime-button px-6"
              >
                <Play className="w-4 h-4 mr-2 fill-current" />
                Resume from {Math.round(savedProgress)}%
              </Button>
              <Button
                onClick={(e) => { e.stopPropagation(); handleResumeChoice(false); }}
                variant="outline"
                className="px-6"
              >
                Start from Beginning
              </Button>
            </div>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        className={`w-full h-full object-contain transition-all duration-300 ${videoError ? 'hidden' : ''}`}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => {
          setIsPlaying(true);
          setHasUserInteracted(true);
          // Hide premium loader on play
          setShowPremiumLoader(false);
          // Check if video started muted on mobile (autoplay policy)
          if (isMobile && videoRef.current?.muted) {
            setWasMutedForAutoplay(true);
            setShowMobileUnmute(true);
            setIsMuted(true);
          }
        }}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            setVideoError(false);
          }
        }}
        onCanPlay={() => {
          setVideoError(false);
          // Hide premium loader when video is ready
          setShowPremiumLoader(false);
          // Notify parent that video loaded successfully (cancels fallback timer)
          onVideoLoadSuccess?.();
        }}
        onCanPlayThrough={() => {
          // Ensure loader is hidden when fully ready
          setShowPremiumLoader(false);
        }}
        onWaiting={() => {
          // Handle buffering state for mobile networks
          // Only show buffering if already playing (not initial load)
          if (hasUserInteracted) {
            console.log('Video buffering...');
          }
        }}
        onStalled={() => {
          // Handle stalled playback - common on mobile
          console.log('Video stalled, attempting to resume...');
          if (videoRef.current && !videoRef.current.paused) {
            // Try to resume playback
            setTimeout(() => {
              if (videoRef.current) {
                videoRef.current.play().catch(() => {});
              }
            }, 1000);
          }
        }}
        onProgress={() => {
          if (videoRef.current && videoRef.current.buffered.length > 0) {
            const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
            const bufferedProgress = (bufferedEnd / videoRef.current.duration) * 100;
            setBuffered(bufferedProgress);
          }
        }}
        onError={(e) => {
          const video = e.currentTarget;
          const error = video.error;
          console.error('Video error:', {
            src: video.src,
            networkState: video.networkState,
            readyState: video.readyState,
            error: error ? { code: error.code, message: error.message } : null
          });
          
          // Hide loader on error
          setShowPremiumLoader(false);
          
          // Only show error for actual failures, not for empty src or aborted loads
          if (video.src && video.networkState === 3 && video.readyState === 0) {
            // Retry once before showing error
            setTimeout(() => {
              if (videoRef.current && videoRef.current.networkState === 3) {
                videoRef.current.load();
                videoRef.current.play().catch(() => {
                  setVideoError(true);
                  // Notify parent of video load failure (triggers fallback to Zex)
                  onVideoLoadError?.();
                });
              }
            }, 2000);
          }
        }}
        autoPlay
        playsInline
        webkit-playsinline="true"
        x-webkit-airplay="allow"
        x5-video-player-type="h5-page"
        x5-video-player-fullscreen="true"
        x5-video-orientation="landscape"
        x5-playsinline="true"
        preload="auto"
        muted={isMobile}
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture={false}
      />
      
      {/* Mobile Mute Indicator - shows when video is muted for autoplay */}
      {isMobile && (
        <MobileMuteIndicator 
          isMuted={isMuted && wasMutedForAutoplay}
          isVisible={showMobileUnmute && isPlaying}
          onTap={handleMobileUnmute}
        />
      )}
      
      {/* Video Processing State for SAVI.IN */}
      {isProcessing && activeServer === 'SHORT' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-[50]">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-2xl animate-scale-in text-center">
            <div className="mb-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            </div>
            <h3 className="text-foreground font-semibold text-lg mb-2">Video is Processing</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Please come back after the processing is done
            </p>
            <div className="bg-muted rounded-full h-2 mb-3 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-1000"
                style={{ width: `${((180 - processingTimeLeft) / 180) * 100}%` }}
              />
            </div>
            <p className="text-primary font-mono text-xl font-bold">
              {Math.floor(processingTimeLeft / 60)}:{(processingTimeLeft % 60).toString().padStart(2, '0')}
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              Time remaining
            </p>
          </div>
        </div>
      )}

      {/* Video Error Modal */}
      {videoError && !isProcessing && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-[9999]">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-2xl animate-scale-in">
            <h3 className="text-foreground font-semibold text-center text-lg mb-2">Video Playback Issue</h3>
            <p className="text-muted-foreground text-sm text-center mb-4">
              This video couldn't be played directly. Try one of the options below:
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setVideoError(false);
                  if (videoRef.current) {
                    videoRef.current.load();
                    videoRef.current.play().catch(() => {});
                  }
                }}
                variant="default"
                className="w-full"
              >
                Retry Playback
              </Button>
              <Button
                onClick={() => setUseIframeFallback(true)}
                variant="outline"
                className="w-full"
              >
                Use Embed Player
              </Button>
            </div>
            <button
              onClick={() => setVideoError(false)}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground w-full text-center"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* CUSTOM CONTROLS - FIXED for fullscreen - Render inside container for native fullscreen */}
      {isFullscreen ? (
        <div 
          className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ 
            zIndex: 2147483646,
            pointerEvents: showControls ? 'auto' : 'none',
          }}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onClick={(e) => {
            // Allow click through to video toggle
            const target = e.target as HTMLElement;
            if (!target.closest('button, input, [role="menuitem"]')) {
              togglePlay();
            }
          }}
        >
          {/* Top gradient */}
          <div className="h-24 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

          {/* Center Play/Pause Button */}
          {!isPlaying && showControls && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2147483647 }}>
              <div 
                className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center cursor-pointer hover:bg-primary transition-colors shadow-2xl" 
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                style={{ pointerEvents: 'auto' }}
              >
                <Play className="w-10 h-10 text-white fill-current ml-1" />
              </div>
            </div>
          )}

          {/* Bottom controls */}
          <div 
            className="bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-16 pb-4 md:pb-6 px-3 md:px-6"
            style={{ pointerEvents: 'auto', zIndex: 2147483647 }}
          >
            {/* Progress bar with buffer indicator */}
            <div className="mb-3 md:mb-4 relative">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-white/90 text-xs md:text-sm font-mono min-w-[40px] md:min-w-[50px]">{formatTime(currentTime)}</span>
                <div className="flex-1 relative h-1.5 md:h-2">
                  {/* Buffer progress (background) */}
                  <div className="absolute inset-0 bg-white/20 rounded-full" />
                  <div 
                    className="absolute top-0 left-0 h-full bg-white/40 rounded-full transition-all duration-300"
                    style={{ width: `${buffered}%` }}
                  />
                  {/* Playback progress (foreground) */}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isNaN(progress) ? 0 : progress}
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-full bg-transparent rounded-full appearance-none cursor-pointer 
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                      [&::-webkit-slider-thumb]:md:w-5 [&::-webkit-slider-thumb]:md:h-5
                      [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg
                      [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125
                      [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:md:w-5 [&::-moz-range-thumb]:md:h-5
                      [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0
                      [&::-webkit-slider-runnable-track]:bg-transparent
                      [&::-moz-range-track]:bg-transparent"
                    style={{
                      background: `linear-gradient(to right, hsl(var(--primary)) ${progress}%, transparent ${progress}%)`,
                      touchAction: 'none',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <span className="text-white/90 text-xs md:text-sm font-mono min-w-[40px] md:min-w-[50px]">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Control buttons - Fullscreen version - Responsive */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 md:gap-2">
                <button 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                  onClick={(e) => { e.stopPropagation(); skipBackward(); }} 
                  title="Skip back 10s"
                >
                  <SkipBack className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button 
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                  onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                >
                  {isPlaying ? <Pause className="w-5 h-5 md:w-7 md:h-7" /> : <Play className="w-5 h-5 md:w-7 md:h-7 fill-current ml-0.5" />}
                </button>
                <button 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                  onClick={(e) => { e.stopPropagation(); skipForward(); }} 
                  title="Skip forward 10s"
                >
                  <SkipForward className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                {/* Volume Slider - Desktop */}
                <div className="hidden md:block" onClick={(e) => e.stopPropagation()}>
                  <VolumeSlider
                    volume={volume}
                    isMuted={isMuted}
                    onVolumeChange={handleVolumeChange}
                    onMuteToggle={toggleMute}
                  />
                </div>
                {/* Volume Button - Mobile (just mute toggle) */}
                <button 
                  className="md:hidden w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                  onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                {/* Next Episode Button - Only for PLAY and SHORT servers */}
                {hasNextEpisode && onNextEpisode && (
                  <button 
                    className="hidden md:flex w-auto px-3 h-8 md:h-10 rounded-full bg-primary/80 hover:bg-primary items-center justify-center text-white transition-colors gap-1" 
                    onClick={(e) => { e.stopPropagation(); onNextEpisode(); }} 
                    title="Next Episode"
                  >
                    <span className="text-xs font-medium">Next</span>
                    <SkipForward className="w-4 h-4" />
                  </button>
                )}
                {currentBitrate > 0 && (
                  <div className="hidden lg:flex items-center gap-1.5 ml-3 px-2 py-1 rounded bg-white/10 text-white/80">
                    <Gauge className="w-3.5 h-3.5" />
                    <span className="text-xs font-mono">{(currentBitrate / 1000000).toFixed(1)} Mbps</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Keyboard Shortcuts Info Button - Fullscreen */}
                <TooltipProvider>
                  <Tooltip open={showKeyboardShortcuts} onOpenChange={setShowKeyboardShortcuts}>
                    <TooltipTrigger asChild>
                      <button 
                        className="hidden md:flex w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white transition-colors" 
                        onClick={(e) => { e.stopPropagation(); setShowKeyboardShortcuts(!showKeyboardShortcuts); }}
                        title="Keyboard Shortcuts"
                      >
                        <Info className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-background/95 backdrop-blur-xl border-border/50 p-4 max-w-[280px]" style={{ zIndex: 2147483647 }}>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <Keyboard className="w-4 h-4" />
                          Keyboard Shortcuts
                        </h4>
                        <div className="grid gap-1.5 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Play/Pause</span>
                            <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">Space</kbd>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Seek Forward 10s</span>
                            <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">→</kbd>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Seek Backward 10s</span>
                            <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">←</kbd>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Fullscreen</span>
                            <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">F</kbd>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Mute</span>
                            <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">M</kbd>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Volume Up</span>
                            <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">↑</kbd>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Volume Down</span>
                            <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">↓</kbd>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Picture-in-Picture</span>
                            <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">P</kbd>
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {/* Next Episode Button Mobile */}
                {hasNextEpisode && onNextEpisode && (
                  <button 
                    className="md:hidden w-8 h-8 rounded-full bg-primary/80 hover:bg-primary flex items-center justify-center text-white transition-colors" 
                    onClick={(e) => { e.stopPropagation(); onNextEpisode(); }} 
                    title="Next Episode"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                )}
                
                {/* Settings Menu - Fullscreen Compatible - Uses container prop to render inside fullscreen */}
                <DropdownMenu 
                  modal={false} 
                  open={settingsOpen}
                  onOpenChange={(open) => { 
                    setSettingsOpen(open);
                    if (!open) setSettingsMenu('main'); 
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors relative"
                      onPointerDown={(e) => { 
                        e.stopPropagation(); 
                        e.preventDefault();
                        setSettingsOpen(prev => !prev); 
                      }}
                      title="Settings"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <Settings className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    side="top"
                    className="bg-background/95 backdrop-blur-xl border-border/50 min-w-[200px] md:min-w-[220px] max-h-[350px] overflow-y-auto"
                    sideOffset={12}
                    style={{ zIndex: 2147483647, pointerEvents: 'auto' }}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    onPointerDownOutside={(e) => e.preventDefault()}
                    forceMount={settingsOpen ? true : undefined}
                    container={containerRef.current || undefined}
                  >
                    {renderSettingsContent()}
                  </DropdownMenuContent>
                </DropdownMenu>

                {features.includes('download') && (
                  <button 
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                    onClick={(e) => { e.stopPropagation(); handleDownload(); }} 
                    title="Download"
                  >
                    <Download className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                )}
                <button 
                  className="flex w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white transition-colors" 
                  onClick={(e) => { e.stopPropagation(); togglePiP(); }} 
                  title="Picture-in-Picture"
                >
                  <PictureInPicture2 className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                  onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} 
                  title="Exit Fullscreen"
                >
                  <Minimize className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div 
          className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ 
            zIndex: 50,
            pointerEvents: showControls ? 'auto' : 'none',
          }}
        >
          {/* Top gradient */}
          <div className="h-24 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

          {/* Center Play/Pause Button */}
          {!isPlaying && showControls && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60]">
              <div 
                className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center cursor-pointer hover:bg-primary transition-colors shadow-2xl" 
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                style={{ pointerEvents: 'auto' }}
              >
                <Play className="w-10 h-10 text-white fill-current ml-1" />
              </div>
            </div>
          )}

          {/* Bottom controls */}
          <div 
            className="bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-16 pb-4 px-4"
            style={{ pointerEvents: 'auto', zIndex: 60 }}
          >
          {/* Progress bar with buffer indicator */}
          <div className="mb-4 relative">
            <div className="flex items-center gap-3">
              <span className="text-white/90 text-sm font-mono min-w-[50px]">{formatTime(currentTime)}</span>
              <div className="flex-1 relative h-2">
                {/* Buffer progress (background) */}
                <div 
                  className="absolute inset-0 bg-white/20 rounded-full"
                />
                <div 
                  className="absolute top-0 left-0 h-full bg-white/40 rounded-full transition-all duration-300"
                  style={{ width: `${buffered}%` }}
                />
                {/* Playback progress (foreground) */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isNaN(progress) ? 0 : progress}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full bg-transparent rounded-full appearance-none cursor-pointer 
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                    [&::-webkit-slider-thumb]:md:w-5 [&::-webkit-slider-thumb]:md:h-5
                    [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125
                    [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:md:w-5 [&::-moz-range-thumb]:md:h-5
                    [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0
                    [&::-webkit-slider-runnable-track]:bg-transparent
                    [&::-moz-range-track]:bg-transparent"
                  style={{
                    background: `linear-gradient(to right, hsl(var(--primary)) ${progress}%, transparent ${progress}%)`,
                    touchAction: 'none',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <span className="text-white/90 text-sm font-mono min-w-[50px]">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control buttons - Responsive for mobile */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5 md:gap-2">
              {/* Skip back */}
              <button 
                className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={(e) => { e.stopPropagation(); skipBackward(); }} 
                title="Skip back 10s"
              >
                <SkipBack className="w-3.5 h-3.5 md:w-5 md:h-5" />
              </button>

              {/* Play/Pause */}
              <button 
                className="w-9 h-9 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              >
                {isPlaying ? <Pause className="w-4 h-4 md:w-7 md:h-7" /> : <Play className="w-4 h-4 md:w-7 md:h-7 fill-current ml-0.5" />}
              </button>

              {/* Skip forward */}
              <button 
                className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={(e) => { e.stopPropagation(); skipForward(); }} 
                title="Skip forward 10s"
              >
                <SkipForward className="w-3.5 h-3.5 md:w-5 md:h-5" />
              </button>

              {/* Volume Slider - Desktop */}
              <div className="hidden md:block" onClick={(e) => e.stopPropagation()}>
                <VolumeSlider
                  volume={volume}
                  isMuted={isMuted}
                  onVolumeChange={handleVolumeChange}
                  onMuteToggle={toggleMute}
                />
              </div>
              {/* Volume Button - Mobile (just mute toggle) */}
              <button 
                className="md:hidden w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {/* Next Episode Button Desktop */}
              {hasNextEpisode && onNextEpisode && (
                <button 
                  className="hidden md:flex w-auto px-3 h-8 md:h-10 rounded-full bg-primary/80 hover:bg-primary items-center justify-center text-white transition-colors gap-1" 
                  onClick={(e) => { e.stopPropagation(); onNextEpisode(); }} 
                  title="Next Episode"
                >
                  <span className="text-xs font-medium">Next</span>
                  <SkipForward className="w-4 h-4" />
                </button>
              )}

              {/* Bitrate indicator */}
              {currentBitrate > 0 && (
                <div className="hidden lg:flex items-center gap-1.5 ml-3 px-2 py-1 rounded bg-white/10 text-white/80">
                  <Gauge className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono">{(currentBitrate / 1000000).toFixed(1)} Mbps</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-0.5 md:gap-1">
              {/* Keyboard Shortcuts Info Button */}
              <TooltipProvider>
                <Tooltip open={showKeyboardShortcuts} onOpenChange={setShowKeyboardShortcuts}>
                  <TooltipTrigger asChild>
                    <button 
                      className="hidden md:flex w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white transition-colors" 
                      onClick={(e) => { e.stopPropagation(); setShowKeyboardShortcuts(!showKeyboardShortcuts); }}
                      title="Keyboard Shortcuts"
                    >
                      <Info className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-background/95 backdrop-blur-xl border-border/50 p-4 max-w-[280px]" style={{ zIndex: 2147483647 }}>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Keyboard className="w-4 h-4" />
                        Keyboard Shortcuts
                      </h4>
                      <div className="grid gap-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Play/Pause</span>
                          <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">Space</kbd>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Seek Forward 10s</span>
                          <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">→</kbd>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Seek Backward 10s</span>
                          <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">←</kbd>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Fullscreen</span>
                          <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">F</kbd>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Mute</span>
                          <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">M</kbd>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Volume Up</span>
                          <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">↑</kbd>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Volume Down</span>
                          <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">↓</kbd>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Picture-in-Picture</span>
                          <kbd className="px-2 py-0.5 bg-muted rounded text-foreground font-mono">P</kbd>
                        </div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Next Episode Button Mobile */}
              {hasNextEpisode && onNextEpisode && (
                <button 
                  className="md:hidden w-7 h-7 rounded-full bg-primary/80 hover:bg-primary flex items-center justify-center text-white transition-colors" 
                  onClick={(e) => { e.stopPropagation(); onNextEpisode(); }} 
                  title="Next Episode"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Settings Menu - Non Fullscreen */}
              <DropdownMenu 
                modal={false} 
                open={settingsOpen}
                onOpenChange={(open) => { 
                  setSettingsOpen(open);
                  if (!open) setSettingsMenu('main'); 
                }}
              >
                <DropdownMenuTrigger asChild>
                  <button 
                    className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors relative"
                    onPointerDown={(e) => { 
                      e.stopPropagation(); 
                      e.preventDefault();
                      setSettingsOpen(prev => !prev); 
                    }}
                    title="Settings"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Settings className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  side="top"
                  className="bg-background/95 backdrop-blur-xl border-border/50 min-w-[200px] md:min-w-[220px] max-h-[350px] overflow-y-auto"
                  sideOffset={12}
                  style={{ zIndex: 2147483647, pointerEvents: 'auto' }}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                  onPointerDownOutside={(e) => e.preventDefault()}
                  forceMount={settingsOpen ? true : undefined}
                  container={containerRef.current || undefined}
                >
                  {renderSettingsContent()}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Download - Only for Zex server */}
              {features.includes('download') && (
                <button 
                  className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  onClick={(e) => { e.stopPropagation(); handleDownload(); }} 
                  title="Download"
                >
                  <Download className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              )}

              {/* PiP - Hidden on mobile */}
                <button 
                  className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); togglePiP(); }} 
                title="Picture-in-Picture"
              >
                <PictureInPicture2 className="w-4 h-4 md:w-5 md:h-5" />
              </button>

              {/* Fullscreen */}
                <button 
                  className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} 
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize className="w-4 h-4 md:w-5 md:h-5" /> : <Maximize className="w-4 h-4 md:w-5 md:h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
      
      {/* Download Verification Dialog */}
      <DownloadVerificationDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        videoUrl={effectiveVideoUrl || ''}
        fileName={`${animeTitle} - Episode ${episodeNumber}.mp4`}
      />
    </div>
  );
}
