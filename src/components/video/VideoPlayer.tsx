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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

const serverConfigs: Record<ServerType, { name: string; features: string[]; playerStyle: string }> = {
  PLAY: { 
    name: 'PLAY', 
    features: ['watch'],
    playerStyle: 'basic'
  },
  SHORT: { 
    name: 'SHORT', 
    features: ['watch', 'quality'],
    playerStyle: 'standard'
  },
  Zex: { 
    name: 'Zex', 
    features: ['watch', 'quality', 'download'],
    playerStyle: 'advanced'
  },
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
  const [quality, setQuality] = useState<'auto' | '1080p' | '720p' | '480p' | '360p'>('auto');
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  const features = serverConfigs[activeServer].features;

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
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
    if (!containerRef.current) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

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
  }, [togglePlay, toggleFullscreen, skipForward, skipBackward]);

  const handleDownload = async () => {
    if (!videoUrl) {
      toast.error('No video available for download');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = videoUrl;
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

  const handleVideoClick = (e: React.MouseEvent) => {
    // Prevent triggering when clicking on controls
    if ((e.target as HTMLElement).closest('.video-controls')) {
      return;
    }
    togglePlay();
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
          <p className="text-white text-lg">Loading {activeServer} server...</p>
        </div>
      </div>
    );
  }

  // External URL player (iframe) for PLAY server
  if (externalUrl && activeServer === 'PLAY') {
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
          src={`${externalUrl}${externalUrl.includes('?') ? '&' : '?'}autoplay=1`}
          className="w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          title={`${animeTitle} - Episode ${episodeNumber}`}
          style={{ border: 'none' }}
        />
      </div>
    );
  }

  // No video available
  if (!videoUrl && !externalUrl) {
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
      className={`relative bg-black w-full ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
      style={{ 
        aspectRatio: isFullscreen ? undefined : '16/9', 
        maxHeight: isFullscreen ? '100vh' : '70vh',
        height: isFullscreen ? '100vh' : undefined,
        width: isFullscreen ? '100vw' : undefined,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={videoUrl || externalUrl || undefined}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
          }
        }}
        poster={poster}
        autoPlay
        playsInline
        onClick={handleVideoClick}
      />

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
        <div className="flex items-center justify-between px-4 pb-4">
          <div className="flex items-center gap-2">
            {/* Skip Backward */}
            <Button
              variant="ghost"
              size="icon"
              onClick={skipBackward}
              className="text-white hover:bg-white/20"
              title="Skip back 10 seconds (←)"
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="text-white hover:bg-white/20"
              title="Play/Pause (Space)"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
            </Button>

            {/* Skip Forward */}
            <Button
              variant="ghost"
              size="icon"
              onClick={skipForward}
              className="text-white hover:bg-white/20"
              title="Skip forward 10 seconds (→)"
            >
              <SkipForward className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="text-white hover:bg-white/20"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>

            <span className="text-white text-sm hidden sm:inline ml-2">
              Episode {episodeNumber}: {title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quality Control (SHORT and Zex only) */}
            {features.includes('quality') && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
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
                  {(['auto', '1080p', '720p', '480p', '360p'] as const).map((q) => (
                    <DropdownMenuItem
                      key={q}
                      onClick={() => setQuality(q)}
                      className={quality === q ? 'bg-primary/20' : ''}
                    >
                      {q === 'auto' ? 'Auto' : q}
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
                className="text-white hover:bg-white/20"
              >
                <Download className="h-5 w-5" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20"
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
