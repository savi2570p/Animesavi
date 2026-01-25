import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  Download,
  Settings,
  SkipForward,
  SkipBack,
  PictureInPicture2,
  Check,
  MonitorPlay,
  Headphones,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DownloadVerificationDialog } from './DownloadVerificationDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AudioTrackInfo {
  id: string;
  label: string;
  language: string;
  enabled: boolean;
}

export type ServerType = 'PLAY' | 'SHORT' | 'Zex';

interface PremiumVideoPlayerProps {
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

const isEmbeddableUrl = (url: string | null): boolean => {
  if (!url) return false;
  const embedPatterns = [
    /youtube\.com/i, /youtu\.be/i, /vimeo\.com/i, /dailymotion\.com/i,
    /drive\.google\.com/i, /docs\.google\.com/i, /dropbox\.com/i,
    /streamable\.com/i, /ok\.ru/i, /rutube\.ru/i, /mega\.nz/i,
    /mediafire\.com/i, /streamtape/i, /doodstream/i, /filemoon/i,
    /vidoza/i, /mixdrop/i, /upstream/i, /fembed/i, /iframe/i,
    /embed/i, /player/i, /watch\?/i, /\/e\//i, /\/v\//i,
  ];
  return embedPatterns.some(pattern => pattern.test(url));
};

const qualityOptions = [
  { value: '1080p', label: '1080p', badge: 'HD' },
  { value: '720p', label: '720p', badge: 'HD' },
  { value: '480p', label: '480p', badge: null },
  { value: '360p', label: '360p', badge: null },
] as const;

type QualityType = typeof qualityOptions[number]['value'];

export function PremiumVideoPlayer({
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
}: PremiumVideoPlayerProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState<QualityType>('1080p');
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<string>('');
  const [isInWatchLater, setIsInWatchLater] = useState(false);
  const [watchLaterLoading, setWatchLaterLoading] = useState(false);
  
  
  // Download verification dialog state
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  
  // Double-tap state for mobile seek
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  const features = serverConfigs[activeServer].features;
  const anyVideoUrl = videoUrl || externalUrl;
  const effectiveVideoUrl = anyVideoUrl;
  const shouldUseIframe = useIframeFallback;

  // Check if episode is in watch later
  useEffect(() => {
    if (!user || !episodeId) return;
    
    const checkWatchLater = async () => {
      const { data } = await supabase
        .from('watch_later')
        .select('id')
        .eq('user_id', user.id)
        .eq('episode_id', episodeId)
        .maybeSingle();
      
      setIsInWatchLater(!!data);
    };
    
    checkWatchLater();
  }, [user, episodeId]);

  const toggleWatchLater = async () => {
    if (!user) {
      toast.error('Please sign in to save to Watch Later');
      return;
    }
    
    if (!episodeId) return;
    
    setWatchLaterLoading(true);
    
    try {
      if (isInWatchLater) {
        await supabase
          .from('watch_later')
          .delete()
          .eq('user_id', user.id)
          .eq('episode_id', episodeId);
        
        setIsInWatchLater(false);
        toast.success('Removed from Watch Later');
      } else {
        await supabase
          .from('watch_later')
          .insert({
            user_id: user.id,
            episode_id: episodeId
          });
        
        setIsInWatchLater(true);
        toast.success('Added to Watch Later');
      }
    } catch (error) {
      toast.error('Failed to update Watch Later');
    } finally {
      setWatchLaterLoading(false);
    }
  };

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

    // Detect on load
    video.addEventListener('loadedmetadata', detectAudioTracks);
    video.addEventListener('canplay', detectAudioTracks);

    // Clean up
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
    setShowAudioMenu(false);
  };


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
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Auto-hide controls and cursor when playing
  useEffect(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);
    } else {
      // Always show controls when paused
      setShowControls(true);
    }
    
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);
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
      setProgress((current / dur) * 100);
      setCurrentTime(current);
      setDuration(dur);
      onTimeUpdate?.(current, dur);

      // Update buffered
      if (videoRef.current.buffered.length > 0) {
        const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setBuffered((bufferedEnd / dur) * 100);
      }
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = percent * videoRef.current.duration;
    setProgress(percent * 100);
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    setHoverTime(percent * videoRef.current.duration);
    setHoverPosition(e.clientX - rect.left);
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

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  };

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    try {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (isCurrentlyFullscreen) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
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
        } else {
          setIsFullscreen(true);
        }
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

  const handleVideoClick = useCallback((e: React.MouseEvent) => {
    if (videoError) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, [role="menuitem"], input')) return;
    togglePlay();
  }, [togglePlay, videoError]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, togglePiP, skipForward, skipBackward, toggleMute]);

  // Loading state
  if (isLoading) {
    return (
      <div className="video-player-container aspect-video max-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <MonitorPlay className="w-6 h-6 text-primary" />
            </div>
          </div>
          <p className="text-foreground/80 font-medium">Loading {activeServer === 'SHORT' ? 'SAVI.IN' : activeServer} server...</p>
        </div>
      </div>
    );
  }

  // Iframe fallback
  if (shouldUseIframe && anyVideoUrl) {
    return (
      <div 
        ref={containerRef}
        className={cn(
          "video-player-container",
          isFullscreen ? "fixed inset-0 z-50 rounded-none" : "aspect-video max-h-[70vh]"
        )}
      >
        <iframe
          src={`${anyVideoUrl}${anyVideoUrl.includes('?') ? '&' : '?'}autoplay=1`}
          className="w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          title={`${animeTitle} - Episode ${episodeNumber}`}
          style={{ border: 'none' }}
        />
      </div>
    );
  }

  // No video
  if (!anyVideoUrl) {
    return (
      <div className="video-player-container aspect-video max-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <MonitorPlay className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">Video not available</p>
        </div>
      </div>
    );
  }

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div 
      ref={containerRef}
      className={cn(
        "video-player-container",
        isFullscreen ? "fixed inset-0 z-[9999] rounded-none" : "aspect-video max-h-[70vh]",
        !showControls && "cursor-none"
      )}
      onClick={handleVideoClick}
      onMouseMove={handleMouseMove}
      onTouchStart={(e) => {
        setShowControls(true);
        handleDoubleTap(e);
      }}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
        setShowQualityMenu(false);
        setShowVolumeSlider(false);
      }}
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
        src={effectiveVideoUrl || undefined}
        className={cn(
          "w-full h-full object-contain",
          videoError && "hidden"
        )}
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
            setVideoError(true);
          }
        }}
        poster={poster}
        autoPlay
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
      />
      
      {/* Error modal */}
      {videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="glass-card rounded-2xl p-6 max-w-sm mx-4 animate-scale-in">
            <h3 className="text-foreground font-bold text-lg text-center mb-2">Playback Issue</h3>
            <p className="text-muted-foreground text-sm text-center mb-5">
              This video couldn't be played directly.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setVideoError(false);
                  videoRef.current?.load();
                  videoRef.current?.play().catch(() => {});
                }}
                variant="outline"
                className="w-full"
              >
                Retry Playback
              </Button>
              <Button onClick={() => setUseIframeFallback(true)} className="anime-button w-full">
                Try Embed Player
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div className={cn(
        "absolute inset-0 flex flex-col justify-between transition-opacity duration-300",
        showControls ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {/* Top gradient */}
        <div className="h-24 bg-gradient-to-b from-black/70 to-transparent" />

        {/* Center play button */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="player-btn-primary pointer-events-auto cursor-pointer" onClick={togglePlay}>
              <Play className="w-8 h-8 text-white fill-current ml-1" />
            </div>
          </div>
        )}

        {/* Bottom controls */}
        <div className="bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-16 pb-4 px-4">
          {/* Progress bar */}
          <div className="mb-4 relative">
            {/* Hover time tooltip */}
            {hoverTime !== null && (
              <div 
                className="absolute -top-10 bg-background/90 backdrop-blur px-2 py-1 rounded text-xs font-mono transform -translate-x-1/2 pointer-events-none"
                style={{ left: hoverPosition }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
            
            <div
              ref={progressRef}
              className="premium-progress-track"
              onClick={handleProgressClick}
              onMouseMove={handleProgressHover}
              onMouseLeave={() => setHoverTime(null)}
            >
              {/* Buffered */}
              <div className="premium-progress-buffer" style={{ width: `${buffered}%` }} />
              {/* Progress */}
              <div className="premium-progress-fill" style={{ width: `${progress}%` }} />
              {/* Thumb */}
              <div 
                className="premium-progress-thumb" 
                style={{ left: `calc(${progress}% - 8px)` }} 
              />
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Skip back */}
              <button className="player-btn w-10 h-10 text-white" onClick={skipBackward} title="Skip back 10s">
                <SkipBack className="w-5 h-5" />
              </button>

              {/* Play/Pause */}
              <button className="player-btn w-12 h-12 text-white" onClick={togglePlay}>
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 fill-current ml-0.5" />}
              </button>

              {/* Skip forward */}
              <button className="player-btn w-10 h-10 text-white" onClick={skipForward} title="Skip forward 10s">
                <SkipForward className="w-5 h-5" />
              </button>

              {/* Volume */}
              <div className="relative">
                <button 
                  className="player-btn w-10 h-10 text-white" 
                  onClick={toggleMute}
                  onMouseEnter={() => setShowVolumeSlider(true)}
                >
                  <VolumeIcon className="w-5 h-5" />
                </button>
                
                {showVolumeSlider && (
                  <div 
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-background/95 backdrop-blur-xl rounded-lg p-3 border border-border/50 shadow-xl"
                    onMouseLeave={() => setShowVolumeSlider(false)}
                  >
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-24 h-1.5 rounded-full appearance-none cursor-pointer bg-white/30
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                        [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>
                )}
              </div>

              {/* Time display */}
              <span className="text-white/90 text-sm font-mono ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Episode title - desktop only */}
              <span className="text-white/70 text-sm hidden md:block ml-4 truncate max-w-[200px]">
                Episode {episodeNumber}: {title}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Quality selector */}
              {features.includes('quality') && (
                <div className="relative">
                  <button 
                    className="player-btn w-10 h-10 text-white"
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                  
                  {showQualityMenu && (
                    <div className="quality-menu absolute bottom-full right-0 mb-2 w-40">
                      <div className="px-3 py-2 text-xs text-muted-foreground font-semibold border-b border-border/50">
                        Quality
                      </div>
                      {qualityOptions.map((opt) => (
                        <div
                          key={opt.value}
                          className={cn("quality-option", quality === opt.value && "active")}
                          onClick={() => {
                            setQuality(opt.value);
                            setShowQualityMenu(false);
                          }}
                        >
                          <span className="text-sm font-medium">{opt.label}</span>
                          <div className="flex items-center gap-2">
                            {opt.badge && <span className="quality-badge">{opt.badge}</span>}
                            {quality === opt.value && <Check className="w-4 h-4 text-primary" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Audio Track Selector - always visible */}
              <div className="relative">
                <button 
                  className="player-btn w-10 h-10 text-white"
                  onClick={() => setShowAudioMenu(!showAudioMenu)}
                  title="Audio Track"
                >
                  <Headphones className="w-5 h-5" />
                </button>
                
                {showAudioMenu && (
                  <div className="quality-menu absolute bottom-full right-0 mb-2 w-48">
                    <div className="px-3 py-2 text-xs text-muted-foreground font-semibold border-b border-border/50 flex items-center gap-2">
                      <Headphones className="w-3 h-3" />
                      Audio Track
                    </div>
                    {audioTracks.length > 0 ? (
                      audioTracks.map((track) => (
                        <div
                          key={track.id}
                          className={cn("quality-option", currentAudioTrack === track.id && "active")}
                          onClick={() => switchAudioTrack(track.id)}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{track.label}</span>
                            {track.language !== 'Unknown' && (
                              <span className="text-xs text-muted-foreground">{track.language}</span>
                            )}
                          </div>
                          {currentAudioTrack === track.id && <Check className="w-4 h-4 text-primary" />}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                        No multiple audio tracks detected
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Watch Later */}
              <button 
                className={cn(
                  "player-btn w-10 h-10",
                  isInWatchLater ? "text-primary" : "text-white"
                )} 
                onClick={toggleWatchLater} 
                title={isInWatchLater ? "Remove from Watch Later" : "Add to Watch Later"}
                disabled={watchLaterLoading}
              >
                <Clock className={cn("w-5 h-5", isInWatchLater && "fill-primary")} />
              </button>

              {/* Download */}
              {features.includes('download') && (
                <button className="player-btn w-10 h-10 text-white" onClick={handleDownload} title="Download">
                  <Download className="w-5 h-5" />
                </button>
              )}

              {/* PiP */}
              <button className="player-btn w-10 h-10 text-white" onClick={togglePiP} title="Picture-in-Picture">
                <PictureInPicture2 className="w-5 h-5" />
              </button>

              {/* Fullscreen */}
              <button className="player-btn w-10 h-10 text-white" onClick={toggleFullscreen} title="Fullscreen">
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
