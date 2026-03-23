import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  SkipForward, 
  SkipBack, 
  Loader2, 
  AlertTriangle,
  RefreshCw,
  Settings,
  Check,
  Download
} from 'lucide-react';
import Hls from 'hls.js';

// Detect device/browser type
function detectDeviceInfo() {
  if (typeof window === 'undefined') {
    return { isMobile: false, isIOS: false, isAndroid: false, isSafari: false };
  }
  
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || isAndroid || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  
  return { isMobile, isIOS, isAndroid, isSafari };
}

// Check if URL is HLS
function isHlsUrl(url: string | null): boolean {
  if (!url) return false;
  return /\.m3u8(\?.*)?$/i.test(url) || url.includes('.m3u8');
}

export default function EmbedPlayer() {
  const { episodeId } = useParams();
  const [searchParams] = useSearchParams();
  const startTime = parseFloat(searchParams.get('t') || '0');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [episodeData, setEpisodeData] = useState<{ title: string; videoUrl: string | null } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  // Playback state
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

  // Fetch episode data
  useEffect(() => {
    const fetchEpisode = async () => {
      if (!episodeId) {
        setFetchError('No episode ID provided');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('episodes')
          .select('video_url, external_url, title')
          .eq('id', episodeId)
          .single();

        if (error || !data) {
          setFetchError('Episode not found');
          return;
        }

        const url = data.video_url || data.external_url;
        if (!url) {
          setFetchError('No video available');
          return;
        }

        setEpisodeData({ title: data.title, videoUrl: url });
      } catch (err) {
        console.error('[EmbedPlayer] Fetch error:', err);
        setFetchError('Failed to load episode');
      }
    };

    fetchEpisode();
  }, [episodeId]);

  // Video playback setup - plays ANY format
  useEffect(() => {
    const video = videoRef.current;
    const videoUrl = episodeData?.videoUrl;
    
    if (!video || !videoUrl) return;
    
    setIsLoading(true);
    setError(null);
    
    // Cleanup previous HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    // Start muted for autoplay
    video.muted = true;
    setIsMuted(true);
    
    if (isHlsUrl(videoUrl)) {
      // HLS playback
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari)
        video.src = videoUrl;
      } else if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          startLevel: 0,
          maxBufferLength: 10,
        });
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          setIsHlsActive(true);
          if (data.levels?.length > 0) {
            const levels = data.levels.map((level, idx) => ({
              id: idx,
              height: level.height,
              label: level.height >= 2160 ? '4K' : level.height >= 1080 ? '1080p' : level.height >= 720 ? '720p' : `${level.height}p`
            }));
            setHlsLevels(levels);
          }
          video.play().catch(() => {});
        });
        
        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          setCurrentLevel(data.level);
        });
        
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setError('Playback error - please retry');
          }
        });
      }
    } else {
      // Direct video playback - try ANY format
      video.src = videoUrl;
    }
    
    const handleCanPlay = () => {
      setIsLoading(false);
      if (startTime > 0) video.currentTime = startTime;
      video.play().catch(() => {});
    };
    
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
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(video.buffered.length - 1);
        setBufferedProgress(video.duration ? (buffered / video.duration) * 100 : 0);
      }
    };
    
    const handleError = () => {
      setIsLoading(false);
      setError('Video failed to load - please try again');
    };
    
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
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [episodeData?.videoUrl, startTime]);

  // Controls
  const play = () => videoRef.current?.play();
  const pause = () => videoRef.current?.pause();
  const togglePlay = () => isPlaying ? pause() : play();
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };
  const seek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(time, duration));
    }
  };
  const seekPercent = (percent: number) => {
    if (videoRef.current && duration) {
      videoRef.current.currentTime = (percent / 100) * duration;
    }
  };
  const setQualityLevel = (level: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      setCurrentLevel(level);
    }
  };
  const retry = () => {
    setError(null);
    setIsLoading(true);
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFS);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Auto-hide controls
  useEffect(() => {
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowQualityMenu(false);
      }, 3000);
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showControls]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowQualityMenu(false);
      }, 3000);
    }
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekPercent(parseFloat(e.target.value));
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    
    if (!container) return;

    try {
      const isCurrentlyFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);

      if (isCurrentlyFullscreen) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      } else {
        // iOS Safari needs video fullscreen
        if (deviceInfo.isIOS && video) {
          if ((video as any).webkitEnterFullscreen) {
            (video as any).webkitEnterFullscreen();
            return;
          }
        }
        
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
        }
      }
    } catch (err) {
      console.error('[EmbedPlayer] Fullscreen error:', err);
    }
  };

  const skipForward = useCallback(() => {
    seek(currentTime + 10);
  }, [currentTime]);

  const skipBackward = useCallback(() => {
    seek(currentTime - 10);
  }, [currentTime]);

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
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    // Don't toggle play if clicking on controls
    if ((e.target as HTMLElement).closest('.controls-area')) return;
    togglePlay();
  };

  // Fetch error state
  if (fetchError) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 p-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <p className="text-white text-lg text-center">{fetchError}</p>
      </div>
    );
  }

  // Loading episode data
  if (!episodeData) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  // Playback error with retry
  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive" />
        <h2 className="text-white text-xl font-bold">Playback Error</h2>
        <p className="text-white/80 max-w-md">{error}</p>
        <button 
          onClick={retry}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black"
      onMouseMove={handleMouseMove}
      onTouchStart={(e) => {
        setShowControls(true);
        handleDoubleTap(e);
      }}
      onClick={handleContainerClick}
    >
      {/* Loading indicator */}
      {(isLoading || isBuffering) && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            {isBuffering && (
              <span className="text-white/70 text-sm">Buffering...</span>
            )}
          </div>
        </div>
      )}

      {/* Double-tap indicators */}
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

      {/* Video element with mobile-specific attributes and fast preloading */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        poster={undefined}
        autoPlay
        playsInline
        webkit-playsinline="true"
        x5-video-player-type="h5"
        x5-video-player-fullscreen="true"
        x5-video-orientation="landscape"
        preload="auto"
        controlsList="nodownload noremoteplayback"
        muted
      />

      {/* Controls overlay */}
      <div 
        className={`controls-area absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <h1 className="text-white font-medium truncate">{episodeData.title}</h1>
        </div>

        {/* Center play button */}
        {!isPlaying && showControls && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button 
              className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center cursor-pointer pointer-events-auto shadow-xl hover:bg-primary transition-colors"
              onClick={() => play()}
            >
              <Play className="w-10 h-10 text-primary-foreground fill-current ml-1" />
            </button>
          </div>
        )}

        {/* Bottom controls */}
        <div className="bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-16 pb-4 px-4">
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center gap-3">
              <span className="text-white/90 text-sm font-mono min-w-[45px]">
                {formatTime(currentTime)}
              </span>
              <div className="flex-1 relative">
                {/* Buffered progress */}
                <div 
                  className="absolute inset-0 h-1.5 bg-white/20 rounded-full pointer-events-none"
                  style={{ width: `${bufferedProgress}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer relative z-10
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                    [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, hsl(var(--primary)) ${progress}%, rgba(255,255,255,0.3) ${progress}%)`
                  }}
                />
              </div>
              <span className="text-white/90 text-sm font-mono min-w-[45px]">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={skipBackward}
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button 
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={() => togglePlay()}
              >
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 fill-current ml-0.5" />}
              </button>
              <button 
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={skipForward}
              >
                <SkipForward className="w-5 h-5" />
              </button>
              <button 
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Quality selector (if HLS with multiple levels) */}
              {isHlsActive && hlsLevels.length > 1 && (
                <div className="relative">
                  <button 
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                  
                  {showQualityMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-sm rounded-lg py-2 min-w-[120px] shadow-xl">
                      <button
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center justify-between ${
                          currentLevel === -1 ? 'text-primary' : 'text-white'
                        }`}
                        onClick={() => {
                          setQualityLevel(-1);
                          setShowQualityMenu(false);
                        }}
                      >
                        Auto
                        {currentLevel === -1 && <Check className="w-4 h-4" />}
                      </button>
                      {hlsLevels.map((level) => (
                        <button
                          key={level.id}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center justify-between ${
                            currentLevel === level.id ? 'text-primary' : 'text-white'
                          }`}
                          onClick={() => {
                            setQualityLevel(level.id);
                            setShowQualityMenu(false);
                          }}
                        >
                          {level.label}
                          {currentLevel === level.id && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Download button */}
              <button 
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={async (e) => {
                  e.stopPropagation();
                  const url = episodeData?.videoUrl;
                  if (!url) return;
                  try {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = `AnimeSavi_${episodeData?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'video'}.mp4`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                  } catch {
                    // Fallback: direct link download
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `AnimeSavi_${episodeData?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'video'}.mp4`;
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                }}
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>

              <button 
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" 
                onClick={toggleFullscreen}
              >
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
