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
  Subtitles,
  Languages,
  Check,
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
    features: ['watch', 'captions', 'language'],
    playerStyle: 'basic'
  },
  SHORT: { 
    name: 'SHORT', 
    features: ['watch', 'quality', 'captions', 'language'],
    playerStyle: 'standard'
  },
  Zex: { 
    name: 'Zex', 
    features: ['watch', 'quality', 'download', 'captions', 'language'],
    playerStyle: 'advanced'
  },
};

const languageOptions = [
  { value: 'japanese', label: 'Japanese', code: 'JP' },
  { value: 'english', label: 'English', code: 'EN' },
  { value: 'hindi', label: 'Hindi', code: 'HI' },
] as const;

type LanguageType = typeof languageOptions[number]['value'];

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
  
  // Language and captions state
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageType>((audioLanguage === 'original' ? 'japanese' : audioLanguage) as LanguageType || 'japanese');
  const [captionsEnabled, setCaptionsEnabled] = useState(true); // Always start with captions enabled

  const features = serverConfigs[activeServer].features;
  
  // Get any available URL for playback - prefer videoUrl, fallback to externalUrl
  const anyVideoUrl = videoUrl || externalUrl;
  
  // ALWAYS try native video player first for all URLs
  // Only fall back to iframe if user explicitly requests it via the fallback button
  const effectiveVideoUrl = anyVideoUrl;
  
  // Only use iframe when user explicitly triggers fallback
  const shouldUseIframe = useIframeFallback;
  
  // Reset error state when URLs change
  useEffect(() => {
    setVideoError(false);
    setUseIframeFallback(false);
  }, [videoUrl, externalUrl]);

  // Handle text track visibility based on captionsEnabled state
  useEffect(() => {
    const video = videoRef.current;
    if (video && video.textTracks.length > 0) {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = captionsEnabled ? 'showing' : 'hidden';
      }
    }
  }, [captionsEnabled]);

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

  // Auto-hide controls
  useEffect(() => {
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showControls]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

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
    const video = videoRef.current;
    const container = containerRef.current;
    
    if (!container && !video) return;

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
        // Enter fullscreen - try video element first for mobile (iOS Safari)
        if (video && (video as any).webkitEnterFullscreen) {
          // iOS Safari video fullscreen
          (video as any).webkitEnterFullscreen();
        } else if (video && (video as any).webkitRequestFullScreen) {
          (video as any).webkitRequestFullScreen();
        } else if (container?.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any)?.webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
        } else if ((container as any)?.mozRequestFullScreen) {
          (container as any).mozRequestFullScreen();
        } else if ((container as any)?.msRequestFullscreen) {
          (container as any).msRequestFullscreen();
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

  // Picture-in-Picture toggle
  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        toast.success('Exited Picture-in-Picture');
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        toast.success('Now playing in Picture-in-Picture mode');
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

  const handleDownload = async () => {
    if (!effectiveVideoUrl) {
      toast.error('No video available for download');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = effectiveVideoUrl;
      link.download = `${animeTitle} - Episode ${episodeNumber}.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Download started!');
    } catch {
      toast.error('Failed to start download');
    }
  };

  const handleVideoClick = useCallback((e: React.MouseEvent) => {
    if (videoError) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Don't toggle when user interacts with controls/inputs/menus
    const interactiveSelector =
      'button, a, input, textarea, select, [role="menuitem"], [role="option"], [data-radix-collection-item]';

    if (target.closest(interactiveSelector)) return;

    togglePlay();
  }, [togglePlay, videoError]);

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
          <p className="text-white text-lg">Loading {activeServer} server...</p>
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
      }`}
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
      onClickCapture={handleVideoClick}
      onMouseMove={handleMouseMove}
      onTouchStart={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Audio Language Badge */}
      {selectedLanguage !== 'japanese' && (
        <div className="absolute top-3 left-3 z-10 px-2 py-1 bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md uppercase tracking-wide">
          {languageOptions.find(l => l.value === selectedLanguage)?.code || selectedLanguage} DUB
        </div>
      )}

      {/* Captions indicator */}
      {captionsEnabled && (
        <div className="absolute top-3 right-3 z-10 px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs font-bold rounded-md flex items-center gap-1">
          <Subtitles className="w-3 h-3" />
          CC
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
            // Auto-enable captions for Japanese
            if (selectedLanguage === 'japanese') {
              setCaptionsEnabled(true);
            }
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
      >
        {/* Caption track */}
        {captionsUrl && (
          <track
            kind="subtitles"
            src={captionsUrl}
            srcLang="en"
            label="English"
            default={captionsEnabled}
          />
        )}
      </video>
      
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

      {/* Custom Controls */}
      <div 
        className={`video-controls absolute inset-0 flex flex-col justify-end transition-opacity duration-300 bg-gradient-to-t from-black/80 via-transparent to-transparent ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Center Play/Pause Button on Click Overlay */}
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ bottom: '100px' }}
        >
          {!isPlaying && showControls && (
            <div className="bg-black/50 rounded-full p-4">
              <Play className="h-12 w-12 text-white fill-current" />
            </div>
          )}
        </div>

        {/* Progress Bar with Time */}
        <div className="px-4 mb-2">
          <div className="flex items-center gap-2 text-white text-sm mb-1">
            <span className="min-w-[60px] text-center font-mono">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleSeek}
              className="flex-1 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
            />
            <span className="min-w-[60px] text-center font-mono">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-2 sm:px-4 pb-3 sm:pb-4">
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Skip Backward */}
            <Button
              variant="ghost"
              size="icon"
              onClick={skipBackward}
              className="text-white hover:bg-white/20 h-10 w-10 sm:h-9 sm:w-9 touch-manipulation active:scale-95 transition-transform"
              title="Skip back 10 seconds (←)"
            >
              <SkipBack className="h-5 w-5 sm:h-5 sm:w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="text-white hover:bg-white/20 h-12 w-12 sm:h-9 sm:w-9 touch-manipulation active:scale-95 transition-transform"
              title="Play/Pause (Space)"
            >
              {isPlaying ? <Pause className="h-7 w-7 sm:h-6 sm:w-6" /> : <Play className="h-7 w-7 sm:h-6 sm:w-6 fill-current" />}
            </Button>

            {/* Skip Forward */}
            <Button
              variant="ghost"
              size="icon"
              onClick={skipForward}
              className="text-white hover:bg-white/20 h-10 w-10 sm:h-9 sm:w-9 touch-manipulation active:scale-95 transition-transform"
              title="Skip forward 10 seconds (→)"
            >
              <SkipForward className="h-5 w-5 sm:h-5 sm:w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="text-white hover:bg-white/20 h-10 w-10 sm:h-9 sm:w-9 touch-manipulation active:scale-95 transition-transform"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>

            <span className="text-white text-xs sm:text-sm hidden md:inline ml-2 truncate max-w-[150px] lg:max-w-none">
              Episode {episodeNumber}: {title}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Captions toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setCaptionsEnabled(!captionsEnabled);
                toast.success(captionsEnabled ? 'Captions disabled' : 'Captions enabled');
              }}
              className={`hover:bg-white/20 h-10 w-10 sm:h-9 sm:w-9 touch-manipulation active:scale-95 transition-transform ${captionsEnabled ? 'text-primary' : 'text-white'}`}
              title="Toggle Captions (C)"
            >
              <Subtitles className="h-5 w-5" />
            </Button>

            {/* Language selector */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 h-10 w-10 sm:h-9 sm:w-9 touch-manipulation"
                  title="Audio Language"
                >
                  <Languages className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="bg-background z-[9999]"
                style={{ zIndex: 9999 }}
                sideOffset={8}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">Audio Language</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {languageOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => {
                      setSelectedLanguage(opt.value);
                      if (opt.value === 'japanese') {
                        setCaptionsEnabled(true);
                        toast.success('Switched to Japanese - Captions enabled');
                      } else {
                        setCaptionsEnabled(false);
                        toast.success(`Switched to ${opt.label}`);
                      }
                    }}
                    className={`${selectedLanguage === opt.value ? 'bg-primary/20' : ''} touch-manipulation py-3 flex items-center justify-between`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-6 text-center text-primary font-bold text-xs">{opt.code}</span>
                      {opt.label}
                    </span>
                    {selectedLanguage === opt.value && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Quality Control (SHORT and Zex only) */}
            {features.includes('quality') && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20 h-10 w-10 sm:h-9 sm:w-9 touch-manipulation"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="bg-background z-[9999]"
                  style={{ zIndex: 9999 }}
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Video Quality</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(['1080p', '720p', '480p', '360p'] as const).map((q) => (
                    <DropdownMenuItem
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`${quality === q ? 'bg-primary/20' : ''} touch-manipulation py-3 flex items-center justify-between`}
                    >
                      <span>{q}</span>
                      <span className="text-xs text-muted-foreground">
                        {q === '360p' && 'Low'} {q === '480p' && 'Medium'} {(q === '720p' || q === '1080p') && 'HD'}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Download (Zex only) */}
            {features.includes('download') && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="text-white hover:bg-white/20 h-10 w-10 sm:h-9 sm:w-9 touch-manipulation active:scale-95 transition-transform"
                title="Download"
              >
                <Download className="h-5 w-5" />
              </Button>
            )}

            {/* Picture-in-Picture */}
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePiP}
              className="text-white hover:bg-white/20 h-10 w-10 sm:h-9 sm:w-9 touch-manipulation active:scale-95 transition-transform"
              title="Picture-in-Picture (P)"
            >
              <PictureInPicture2 className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20 h-10 w-10 sm:h-9 sm:w-9 touch-manipulation active:scale-95 transition-transform"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
