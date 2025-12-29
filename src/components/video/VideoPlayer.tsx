import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { DownloadVerificationDialog } from './DownloadVerificationDialog';

interface AudioTrackInfo {
  id: string;
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

// Helper to detect direct video file URLs that can be played natively
const isDirectVideoUrl = (url: string | null): boolean => {
  if (!url) return false;
  
  // Direct video file extensions
  const videoExtensions = /\.(mp4|webm|mkv|avi|mov|m4v|ogg|ogv|m3u8|mpd)(\?.*)?$/i;
  
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

// Helper to check if URL might work as direct video (for fallback attempts)
const couldBeDirectVideo = (url: string | null): boolean => {
  if (!url) return false;
  // If it's not clearly an embed URL, try it as direct first
  return !isEmbeddableUrl(url) || isDirectVideoUrl(url);
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
  const [currentAudioTrack, setCurrentAudioTrack] = useState<string>('');
  
  
  // Download verification dialog state
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  
  // Double-tap state for mobile seek
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  
  const features = serverConfigs[activeServer].features;
  
  // Get any available URL for playback - prefer videoUrl, fallback to externalUrl
  const anyVideoUrl = videoUrl || externalUrl;
  
  // ALWAYS try native video player first for all URLs
  // Only fall back to iframe if user explicitly requests it via the fallback button
  const effectiveVideoUrl = anyVideoUrl;
  
  // Only use iframe when user explicitly triggers fallback
  const shouldUseIframe = useIframeFallback;
  
  useEffect(() => {
    setVideoError(false);
    setUseIframeFallback(false);
    setAudioTracks([]);
    setCurrentAudioTrack('');
  }, [videoUrl, externalUrl]);

  // Audio tracks detection
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const detectAudioTracks = () => {
      const tracks: AudioTrackInfo[] = [];
      
      // Check HTML5 audioTracks API
      const htmlAudioTracks = (video as any).audioTracks;
      if (htmlAudioTracks && htmlAudioTracks.length > 0) {
        for (let i = 0; i < htmlAudioTracks.length; i++) {
          const track = htmlAudioTracks[i];
          tracks.push({
            id: track.id || `track-${i}`,
            label: track.label || `Audio ${i + 1}`,
            language: track.language || 'Unknown',
            enabled: track.enabled,
          });
          if (track.enabled) {
            setCurrentAudioTrack(track.id || `track-${i}`);
          }
        }
      }
      
      setAudioTracks(tracks);
    };

    video.addEventListener('loadedmetadata', detectAudioTracks);
    video.addEventListener('canplay', detectAudioTracks);

    return () => {
      video.removeEventListener('loadedmetadata', detectAudioTracks);
      video.removeEventListener('canplay', detectAudioTracks);
    };
  }, [effectiveVideoUrl]);

  const switchAudioTrack = (trackId: string) => {
    const video = videoRef.current;
    if (!video) return;

    const htmlAudioTracks = (video as any).audioTracks;
    if (htmlAudioTracks) {
      for (let i = 0; i < htmlAudioTracks.length; i++) {
        const track = htmlAudioTracks[i];
        const id = track.id || `track-${i}`;
        track.enabled = id === trackId;
      }
      setCurrentAudioTrack(trackId);
      toast.success('Audio track changed');
    }
  };

  // CRITICAL: Cleanup video on unmount to stop audio when navigating away
  useEffect(() => {
    const video = videoRef.current;
    
    return () => {
      if (video) {
        video.pause();
        video.src = '';
        video.load();
      }
    };
  }, []);


  // Handle fullscreen changes (including webkit for iOS)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFS);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Auto-hide controls and cursor when playing
  useEffect(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2000);
    } else {
      // Always show controls when paused
      setShowControls(true);
    }
    
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2000);
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

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    
    if (!container) return;

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    try {
      // Check if already in fullscreen
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (isCurrentlyFullscreen) {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      } else {
        // For iOS, use native video fullscreen (triggers iOS's built-in player)
        if (isIOS && video) {
          if ((video as any).webkitEnterFullscreen) {
            (video as any).webkitEnterFullscreen();
            return;
          } else if ((video as any).webkitRequestFullscreen) {
            (video as any).webkitRequestFullscreen();
            return;
          }
        }
        
        // For non-iOS, use container fullscreen to show our custom controls
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          (container as any).msRequestFullscreen();
        } else {
          // Fallback: manually toggle fullscreen state for CSS-based fullscreen
          setIsFullscreen(true);
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
      // Fallback: manually toggle fullscreen state for CSS-based fullscreen
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

  // Picture-in-Picture toggle with iOS/Android support
  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    // Detect platform
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        toast.success('Exited Picture-in-Picture');
      } else if (isIOS) {
        // iOS Safari uses webkitSetPresentationMode
        if ((video as any).webkitSupportsPresentationMode && 
            typeof (video as any).webkitSetPresentationMode === 'function') {
          (video as any).webkitSetPresentationMode('picture-in-picture');
          toast.success('Now playing in Picture-in-Picture mode');
        } else {
          toast.error('Picture-in-Picture is not supported on this iOS device');
        }
      } else if (isAndroid || document.pictureInPictureEnabled) {
        // Android and desktop use standard API
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
      // Only handle if not typing in an input
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, togglePiP, skipForward, skipBackward]);

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
      // Double tap detected
      e.preventDefault();
      const side = x < containerWidth / 2 ? 'left' : 'right';
      
      if (side === 'left') {
        skipBackward();
        setDoubleTapSide('left');
      } else {
        skipForward();
        setDoubleTapSide('right');
      }
      
      // Clear the animation after showing
      setTimeout(() => setDoubleTapSide(null), 500);
      
      // Reset last tap
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      // Single tap - record it
      lastTapRef.current = { time: now, x };
    }
  }, [skipForward, skipBackward]);

  // Universal click/tap handler for play/pause - works on all platforms
  const handleVideoAreaClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (videoError) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Don't toggle when user interacts with controls/inputs/menus
    const interactiveSelector =
      'button, a, input, textarea, select, [role="menuitem"], [role="option"], [data-radix-collection-item]';

    if (target.closest(interactiveSelector)) return;

    // Prevent default to avoid double-firing on touch devices
    e.preventDefault();
    togglePlay();
  }, [togglePlay, videoError]);

  // Separate touch handler for double-tap detection
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    const touch = e.changedTouches[0];
    const x = touch.clientX;
    const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
    
    const timeSinceLastTap = now - lastTapRef.current.time;
    const distanceFromLastTap = Math.abs(x - lastTapRef.current.x);
    
    if (timeSinceLastTap < 300 && distanceFromLastTap < 50) {
      // Double tap detected
      e.preventDefault();
      const side = x < containerWidth / 2 ? 'left' : 'right';
      
      if (side === 'left') {
        skipBackward();
        setDoubleTapSide('left');
      } else {
        skipForward();
        setDoubleTapSide('right');
      }
      
      // Clear the animation after showing
      setTimeout(() => setDoubleTapSide(null), 500);
      
      // Reset last tap
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      // Single tap - record it and toggle play after short delay to check for double tap
      lastTapRef.current = { time: now, x };
      
      // Only toggle play if it's a single tap (not part of double tap)
      setTimeout(() => {
        if (lastTapRef.current.time === now) {
          // Still the same tap, means no double tap followed
          const target = e.target as HTMLElement;
          const interactiveSelector = 'button, a, input, textarea, select, [role="menuitem"]';
          if (!target.closest(interactiveSelector)) {
            togglePlay();
          }
        }
      }, 300);
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

  // External URL player (iframe) - only when user explicitly triggers fallback
  if (shouldUseIframe && anyVideoUrl) {
    return (
      <div 
        ref={containerRef} 
        className={`relative bg-black w-full ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
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

  // No video available at all
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

  // Native video player for all servers
  return (
    <div 
      ref={containerRef} 
      className={`relative bg-black w-full touch-manipulation ${
        isFullscreen 
          ? 'fixed inset-0 z-[9999]' 
          : ''
      } ${!showControls ? 'cursor-none' : ''}`}
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
      onTouchEnd={handleTouchEnd}
      onTouchStart={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Double-tap seek indicators */}
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
        src={effectiveVideoUrl || anyVideoUrl || undefined}
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
      
      {/* Video Error - Show as popup modal */}
      {videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
          <div className="bg-card border border-border rounded-xl p-5 max-w-xs mx-4 shadow-2xl animate-scale-in">
            <h3 className="text-foreground font-semibold text-center mb-2">Video Playback Issue</h3>
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
                variant="outline"
                className="w-full"
              >
                Retry Playback
              </Button>
              <Button
                onClick={() => setUseIframeFallback(true)}
                className="anime-button w-full"
              >
                Try Embed Player
              </Button>
              {anyVideoUrl && (
                <Button
                  onClick={() => {
                    // Open external player page with video URL
                    const params = new URLSearchParams({
                      url: anyVideoUrl,
                      title: `${animeTitle} - Episode ${episodeNumber}: ${title}`,
                    });
                    window.open(`/external-player?${params.toString()}`, '_blank');
                  }}
                  variant="secondary"
                  className="w-full"
                >
                  Open External Player
                </Button>
              )}
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

      {/* Custom Controls - Same as PremiumVideoPlayer */}
      <div 
        className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 z-20 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ pointerEvents: showControls ? 'auto' : 'none' }}
      >
        {/* Top gradient - allow click through */}
        <div className="h-24 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

        {/* Center Play/Pause Button */}
        {!isPlaying && showControls && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div 
              className="player-btn-primary cursor-pointer" 
              onClick={togglePlay}
              style={{ pointerEvents: 'auto' }}
            >
              <Play className="w-8 h-8 text-white fill-current ml-1" />
            </div>
          </div>
        )}

        {/* Bottom controls */}
        <div 
          className="bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-16 pb-4 px-4"
          style={{ pointerEvents: 'auto' }}
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
                  className="w-full h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer 
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                    [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                  style={{
                    background: `linear-gradient(to right, hsl(var(--primary)) ${progress}%, rgba(255,255,255,0.3) ${progress}%)`,
                    touchAction: 'none',
                  }}
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
                className="player-btn w-10 h-10 text-white" 
                onClick={(e) => { e.stopPropagation(); skipBackward(); }} 
                title="Skip back 10s"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              {/* Play/Pause */}
              <button 
                className="player-btn w-12 h-12 text-white" 
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              >
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 fill-current ml-0.5" />}
              </button>

              {/* Skip forward */}
              <button 
                className="player-btn w-10 h-10 text-white" 
                onClick={(e) => { e.stopPropagation(); skipForward(); }} 
                title="Skip forward 10s"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              {/* Volume */}
              <button 
                className="player-btn w-10 h-10 text-white" 
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
              {/* Audio Track Selector - always visible icon */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="player-btn w-10 h-10 text-white"
                    onClick={(e) => e.stopPropagation()}
                    title="Audio Track"
                  >
                    <Headphones className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="bg-background/95 backdrop-blur-xl border-border/50 z-[99999]"
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-2">
                    <Headphones className="w-3 h-3" />
                    Audio Track
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {audioTracks.length > 0 ? (
                    audioTracks.map((track) => (
                      <DropdownMenuItem
                        key={track.id}
                        onClick={() => switchAudioTrack(track.id)}
                        className={`${currentAudioTrack === track.id ? 'bg-primary/20' : ''} flex items-center justify-between gap-4`}
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
                    <DropdownMenuItem disabled className="text-muted-foreground text-sm">
                      No multiple audio tracks detected
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Quality selector */}
              {features.includes('quality') && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="player-btn w-10 h-10 text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="bg-background/95 backdrop-blur-xl border-border/50 z-[99999]"
                    sideOffset={8}
                  >
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Quality</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(['1080p', '720p', '480p', '360p'] as const).map((q) => (
                      <DropdownMenuItem
                        key={q}
                        onClick={() => setQuality(q)}
                        className={`${quality === q ? 'bg-primary/20' : ''} flex items-center justify-between gap-4`}
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
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Download */}
              {features.includes('download') && (
                <button 
                  className="player-btn w-10 h-10 text-white" 
                  onClick={(e) => { e.stopPropagation(); handleDownload(); }} 
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </button>
              )}

              {/* PiP */}
              <button 
                className="player-btn w-10 h-10 text-white" 
                onClick={(e) => { e.stopPropagation(); togglePiP(); }} 
                title="Picture-in-Picture"
              >
                <PictureInPicture2 className="w-5 h-5" />
              </button>

              {/* Fullscreen */}
              <button 
                className="player-btn w-10 h-10 text-white" 
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} 
                title="Fullscreen"
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
