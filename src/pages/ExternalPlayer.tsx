import { useState, useRef, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
  ArrowLeft,
  SkipForward,
  SkipBack,
  PictureInPicture2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { DownloadVerificationDialog } from '@/components/video/DownloadVerificationDialog';

export default function ExternalPlayer() {
  const [searchParams] = useSearchParams();
  const videoUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'Video Player';

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
  const [useIframe, setUseIframe] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
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
    if (isNaN(seconds)) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
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
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const time = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = time;
      setProgress(parseFloat(e.target.value));
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = async () => {
    const video = videoRef.current;
    const container = containerRef.current;
    
    if (!container && !video) return;

    try {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );

      if (isCurrentlyFullscreen) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      } else {
        if (video && (video as any).webkitEnterFullscreen) {
          (video as any).webkitEnterFullscreen();
        } else if (container?.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any)?.webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
      setIsFullscreen(!isFullscreen);
    }
  };

  const skipForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, videoRef.current.duration);
    }
  };

  const skipBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
    }
  };

  const togglePiP = async () => {
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
  };

  const handleDownload = () => {
    if (!videoUrl) {
      toast.error('No video available for download');
      return;
    }
    setShowDownloadDialog(true);
  };

  const handleVideoClick = () => {
    if (!videoError) {
      togglePlay();
    }
  };

  if (!videoUrl) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <p className="text-white text-lg mb-4">No video URL provided</p>
        <Button asChild variant="outline">
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  // Iframe embed player mode
  if (useIframe) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="p-4 flex items-center gap-4 bg-black/80">
          <Button variant="ghost" size="icon" onClick={() => window.close()} className="text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-white font-semibold truncate flex-1">{title}</h1>
          <Button variant="outline" size="sm" onClick={() => setUseIframe(false)} className="text-white border-white/30">
            Switch to Video Player
          </Button>
        </div>
        <div className="flex-1 relative">
          <iframe
            src={`${videoUrl}${videoUrl.includes('?') ? '&' : '?'}autoplay=1`}
            className="w-full h-full absolute inset-0"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            title={title}
            style={{ border: 'none' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center gap-4 bg-black/80 z-10">
        <Button variant="ghost" size="icon" onClick={() => window.close()} className="text-white hover:bg-white/20">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-white font-semibold truncate flex-1">{title}</h1>
      </div>

      {/* Video Player */}
      <div 
        ref={containerRef}
        className={`flex-1 relative bg-black ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
        onMouseMove={handleMouseMove}
        onTouchStart={() => setShowControls(true)}
        onClick={handleVideoClick}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className={`w-full h-full object-contain ${videoError ? 'hidden' : ''}`}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              setVideoError(false);
            }
          }}
          onError={() => setVideoError(true)}
          autoPlay
          playsInline
        />

        {/* Video Error */}
        {videoError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-card border border-border rounded-xl p-5 max-w-xs mx-4 shadow-2xl">
              <h3 className="text-foreground font-semibold text-center mb-2">Playback Error</h3>
              <p className="text-muted-foreground text-sm text-center mb-4">
                Video couldn't be played. Try the embed player instead.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => { setVideoError(false); videoRef.current?.load(); }} variant="outline" className="w-full">
                  Retry
                </Button>
                <Button onClick={() => setUseIframe(true)} className="anime-button w-full">
                  Use Embed Player
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Controls Overlay - Same as other video players */}
        {!videoError && (
          <div 
            className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top gradient */}
            <div className="h-24 bg-gradient-to-b from-black/70 to-transparent" />

            {/* Center Play Button */}
            {!isPlaying && showControls && (
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
                        background: `linear-gradient(to right, hsl(var(--primary)) ${progress}%, rgba(255,255,255,0.3) ${progress}%)`
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
                  <button className="player-btn w-10 h-10 text-white" onClick={toggleMute}>
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {/* Quality */}
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button className="player-btn w-10 h-10 text-white">
                        <Settings className="w-5 h-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-xl border-border/50 z-[9999]">
                      {(['1080p', '720p', '480p', '360p'] as const).map((q) => (
                        <DropdownMenuItem
                          key={q}
                          onClick={() => setQuality(q)}
                          className={`${quality === q ? 'bg-primary/20' : ''} flex items-center justify-between gap-4`}
                        >
                          <span className="text-sm font-medium">{q}</span>
                          {(q === '720p' || q === '1080p') && (
                            <span className="text-[10px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded">HD</span>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Download */}
                  <button className="player-btn w-10 h-10 text-white" onClick={handleDownload} title="Download">
                    <Download className="w-5 h-5" />
                  </button>

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
        )}
      </div>
      
      {/* Download Verification Dialog */}
      <DownloadVerificationDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        videoUrl={videoUrl || ''}
        fileName={`${title}.mp4`}
      />
    </div>
  );
}