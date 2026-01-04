import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import Hls from 'hls.js';
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
} from 'lucide-react';
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

interface AudioTrackInfo {
  id: number;
  label: string;
  language: string;
  enabled: boolean;
}

export type ServerType = 'PLAY' | 'SHORT' | 'Zex';

interface VideoPlayerProps {
  videoUrl: string | null;
  externalUrl: string | null;
  title: string;
  animeTitle: string;
  episodeNumber: number;
  episodeId: string;
  poster?: string;
  isMovie?: boolean;
  activeServer: ServerType;
  isLoading?: boolean;
  audioLanguage?: string;
  captionsUrl?: string | null;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
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
  
  // Direct video file extensions
  const videoExtensions = /\.(mp4|webm|mkv|avi|mov|m4v|ogg|ogv|mpd)(\?.*)?$/i;
  
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
  
  // Check for video extensions first
  if (videoExtensions.test(url)) return true;
  
  // Check for known CDN patterns
  return directVideoPatterns.some(pattern => pattern.test(url));
};

export function VideoPlayer({
  videoUrl,
  externalUrl,
  title,
  animeTitle,
  episodeNumber,
  episodeId,
  poster,
  isMovie = false,
  activeServer,
  isLoading = false,
  audioLanguage = 'original',
  captionsUrl,
  onTimeUpdate,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState<'1080p' | '720p' | '480p' | '360p'>('1080p');
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(0);
  
  // Video processing state for SAVI.IN server
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTimeLeft, setProcessingTimeLeft] = useState(180);
  const processingTimerRef = useRef<NodeJS.Timeout>();
  
  // Download verification dialog state
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  
  // Double-tap state for mobile seek
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  
  const features = serverConfigs[activeServer].features;
  
  // Get any available URL for playback
  const anyVideoUrl = videoUrl || externalUrl;
  const effectiveVideoUrl = anyVideoUrl;
  const shouldUseIframe = useIframeFallback;
  
  // Reset state when video URL changes
  useEffect(() => {
    setVideoError(false);
    setUseIframeFallback(false);
    setAudioTracks([]);
    setCurrentAudioTrack(0);
    setIsProcessing(false);
    setProcessingTimeLeft(180);
    
    if (processingTimerRef.current) {
      clearInterval(processingTimerRef.current);
    }
    
    // Cleanup HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, [videoUrl, externalUrl]);

  // HLS.js initialization for multi-audio support
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
          
          // For Safari, use native audioTracks API
          const detectNativeAudioTracks = () => {
            const nativeAudioTracks = (video as any).audioTracks;
            if (nativeAudioTracks && nativeAudioTracks.length > 0) {
              const tracks: AudioTrackInfo[] = [];
              for (let i = 0; i < nativeAudioTracks.length; i++) {
                const track = nativeAudioTracks[i];
                tracks.push({
                  id: i,
                  label: getAudioLabel(track.label, track.language, i),
                  language: track.language || 'Unknown',
                  enabled: track.enabled,
                });
                if (track.enabled) setCurrentAudioTrack(i);
              }
              setAudioTracks(tracks);
            }
          };
          
          video.addEventListener('loadedmetadata', detectNativeAudioTracks);
          return () => video.removeEventListener('loadedmetadata', detectNativeAudioTracks);
        }

        // Use HLS.js for other browsers
        if (Hls.isSupported()) {
          console.log('Using HLS.js for multi-audio support');
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
          });
          
          hlsRef.current = hls;
          hls.loadSource(effectiveVideoUrl);
          hls.attachMedia(video);

          // Listen for manifest parsed to get audio tracks
          hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            console.log('HLS manifest parsed, audio tracks:', data.audioTracks);
            if (data.audioTracks && data.audioTracks.length > 0) {
              const tracks: AudioTrackInfo[] = data.audioTracks.map((track, index) => ({
                id: track.id,
                label: getAudioLabel(track.name, track.lang, index),
                language: track.lang || 'Unknown',
                enabled: index === hls.audioTrack,
              }));
              setAudioTracks(tracks);
              setCurrentAudioTrack(hls.audioTrack);
            }
            
            // Auto play
            video.play().catch(() => {});
          });

          // Listen for audio track changes
          hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
            console.log('Audio track switched to:', data.id);
            setCurrentAudioTrack(data.id);
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS error:', data);
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  setVideoError(true);
                  break;
              }
            }
          });
        }
      } else {
        // Non-HLS video - use native playback
        video.src = effectiveVideoUrl;
        
        // Try to detect audio tracks for MP4/MKV with multiple audio streams
        const detectNativeAudioTracks = () => {
          const nativeAudioTracks = (video as any).audioTracks;
          if (nativeAudioTracks && nativeAudioTracks.length > 0) {
            const tracks: AudioTrackInfo[] = [];
            for (let i = 0; i < nativeAudioTracks.length; i++) {
              const track = nativeAudioTracks[i];
              tracks.push({
                id: i,
                label: getAudioLabel(track.label, track.language, i),
                language: track.language || 'Unknown',
                enabled: track.enabled,
              });
              if (track.enabled) setCurrentAudioTrack(i);
            }
            setAudioTracks(tracks);
          }
        };
        
        video.addEventListener('loadedmetadata', detectNativeAudioTracks);
        video.addEventListener('canplay', detectNativeAudioTracks);
        
        return () => {
          video.removeEventListener('loadedmetadata', detectNativeAudioTracks);
          video.removeEventListener('canplay', detectNativeAudioTracks);
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

  // Helper to get readable audio labels
  const getAudioLabel = (label: string | undefined, lang: string | undefined, index: number): string => {
    const language = (lang || '').toLowerCase();
    
    if (label && label.trim()) return label;
    
    if (language.includes('hin') || language === 'hi') return '🇮🇳 Hindi';
    if (language.includes('eng') || language === 'en') return '🇬🇧 English';
    if (language.includes('jpn') || language === 'ja' || language.includes('jap')) return '🇯🇵 Japanese';
    if (language.includes('spa') || language === 'es') return '🇪🇸 Spanish';
    if (language.includes('fra') || language === 'fr') return '🇫🇷 French';
    if (language.includes('ger') || language === 'de') return '🇩🇪 German';
    if (language.includes('ita') || language === 'it') return '🇮🇹 Italian';
    if (language.includes('por') || language === 'pt') return '🇧🇷 Portuguese';
    if (language.includes('kor') || language === 'ko') return '🇰🇷 Korean';
    if (language.includes('chi') || language === 'zh') return '🇨🇳 Chinese';
    
    return `Audio ${index + 1}`;
  };

  // Switch audio track - works with both HLS.js and native
  const switchAudioTrack = useCallback((trackId: number) => {
    const video = videoRef.current;
    
    // Try HLS.js first
    if (hlsRef.current && hlsRef.current.audioTracks.length > 0) {
      hlsRef.current.audioTrack = trackId;
      const track = hlsRef.current.audioTracks[trackId];
      toast.success(`Audio: ${track?.name || `Track ${trackId + 1}`}`);
      setCurrentAudioTrack(trackId);
      return;
    }
    
    // Fallback to native audioTracks API
    if (video) {
      const nativeAudioTracks = (video as any).audioTracks;
      if (nativeAudioTracks && nativeAudioTracks.length > 0) {
        for (let i = 0; i < nativeAudioTracks.length; i++) {
          nativeAudioTracks[i].enabled = i === trackId;
        }
        const track = nativeAudioTracks[trackId];
        toast.success(`Audio: ${track?.label || `Track ${trackId + 1}`}`);
        setCurrentAudioTrack(trackId);
      }
    }
  }, []);

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
    
    if (isPlaying && showControls) {
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
  }, [isPlaying, showControls]);

  // Mouse/touch movement handler - ENHANCED for fullscreen
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Touch handler for mobile - ENHANCED
  const handleTouchStart = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 4000); // Longer timeout for touch
    }
  }, [isPlaying]);

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
    }
  };

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
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

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
  }, [togglePlay, toggleFullscreen, togglePiP, skipForward, skipBackward, isFullscreen]);

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
          <p className="text-white text-lg">Loading {activeServer === 'SHORT' ? 'SAVI.IN' : activeServer} server...</p>
        </div>
      </div>
    );
  }

  // External URL player (iframe)
  if (shouldUseIframe && anyVideoUrl) {
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
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
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

      <video
        ref={videoRef}
        className={`w-full h-full object-contain transition-all duration-300 ${
          quality === '360p' ? 'blur-[2px]' : 
          quality === '480p' ? 'blur-[1px]' : 
          ''
        } ${videoError ? 'hidden' : ''}`}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            setVideoError(false);
          }
        }}
        onCanPlay={() => setVideoError(false)}
        onError={(e) => {
          const video = e.currentTarget;
          if (video.src && video.networkState === 3) {
            console.error('Video failed to load:', video.src);
            setVideoError(true);
          }
        }}
        poster={poster}
        autoPlay
        playsInline
        webkit-playsinline="true"
        crossOrigin="anonymous"
      />
      
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

      {/* CUSTOM CONTROLS - FIXED for fullscreen */}
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
          {/* Progress bar */}
          <div className="mb-4 relative">
            <div className="flex items-center gap-3">
              <span className="text-white/90 text-sm font-mono min-w-[50px]">{formatTime(currentTime)}</span>
              <div className="flex-1 relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={handleSeek}
                  className="w-full h-2 bg-white/30 rounded-full appearance-none cursor-pointer 
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
                    [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125
                    [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-primary 
                    [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0"
                  style={{
                    background: `linear-gradient(to right, hsl(var(--primary)) ${progress}%, rgba(255,255,255,0.3) ${progress}%)`,
                    touchAction: 'none',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <span className="text-white/90 text-sm font-mono min-w-[50px]">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Skip back */}
              <button 
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={(e) => { e.stopPropagation(); skipBackward(); }} 
                title="Skip back 10s"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              {/* Play/Pause */}
              <button 
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              >
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 fill-current ml-0.5" />}
              </button>

              {/* Skip forward */}
              <button 
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={(e) => { e.stopPropagation(); skipForward(); }} 
                title="Skip forward 10s"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              {/* Volume */}
              <button 
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              {/* Episode title - desktop only */}
              <span className="text-white/70 text-sm hidden md:block ml-4 truncate max-w-[200px]">
                Episode {episodeNumber}: {title}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Audio Track Selector with HLS.js support */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors relative"
                    onClick={(e) => e.stopPropagation()}
                    title="Audio Track"
                  >
                    <Headphones className="w-5 h-5" />
                    {audioTracks.length > 1 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[10px] flex items-center justify-center font-bold">
                        {audioTracks.length}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                {createPortal(
                  <DropdownMenuContent 
                    align="end" 
                    className="bg-background/95 backdrop-blur-xl border-border/50 min-w-[200px]"
                    sideOffset={8}
                    style={{ zIndex: 2147483647 }}
                  >
                    <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-2">
                      <Headphones className="w-3 h-3" />
                      Audio Track
                      {audioTracks.length > 0 && (
                        <span className="ml-auto text-primary">({audioTracks.length} available)</span>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {audioTracks.length > 0 ? (
                      audioTracks.map((track) => (
                        <DropdownMenuItem
                          key={track.id}
                          onClick={(e) => { e.stopPropagation(); switchAudioTrack(track.id); }}
                          className={`${currentAudioTrack === track.id ? 'bg-primary/20' : ''} flex items-center justify-between gap-4 cursor-pointer`}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{track.label}</span>
                            {track.language !== 'Unknown' && (
                              <span className="text-xs text-muted-foreground">{track.language}</span>
                            )}
                          </div>
                          {currentAudioTrack === track.id && <Check className="w-4 h-4 text-primary" />}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-2 py-3 space-y-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Headphones className="w-4 h-4" />
                          <span className="text-sm font-medium">Single Audio Track</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          This video has only one audio track. Multi-audio videos (like dual audio anime) will show available languages here.
                        </p>
                        <div className="pt-1 border-t border-border/50">
                          <p className="text-xs text-muted-foreground/70">
                            💡 HLS streams (.m3u8) with multiple audio tracks are fully supported in all browsers.
                          </p>
                        </div>
                      </div>
                    )}
                  </DropdownMenuContent>,
                  document.body
                )}
              </DropdownMenu>

              {/* Quality selector */}
              {features.includes('quality') && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  {createPortal(
                    <DropdownMenuContent 
                      align="end" 
                      className="bg-background/95 backdrop-blur-xl border-border/50 min-w-[120px]"
                      sideOffset={8}
                      style={{ zIndex: 2147483647 }}
                    >
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Quality</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(['1080p', '720p', '480p', '360p'] as const).map((q) => (
                        <DropdownMenuItem
                          key={q}
                          onClick={(e) => { e.stopPropagation(); setQuality(q); }}
                          className={`${quality === q ? 'bg-primary/20' : ''} flex items-center justify-between gap-4 cursor-pointer`}
                        >
                          <span className="text-sm font-medium">{q}</span>
                          <div className="flex items-center gap-2">
                            {(q === '720p' || q === '1080p') && (
                              <span className="text-[10px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded">HD</span>
                            )}
                            {quality === q && <Check className="w-4 h-4 text-primary" />}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>,
                    document.body
                  )}
                </DropdownMenu>
              )}

              {/* Download */}
              {features.includes('download') && (
                <button 
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                  onClick={(e) => { e.stopPropagation(); handleDownload(); }} 
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </button>
              )}

              {/* PiP */}
              <button 
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={(e) => { e.stopPropagation(); togglePiP(); }} 
                title="Picture-in-Picture"
              >
                <PictureInPicture2 className="w-5 h-5" />
              </button>

              {/* Fullscreen - ALWAYS VISIBLE AND CLICKABLE */}
              <button 
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} 
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
      
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
