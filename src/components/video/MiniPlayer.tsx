import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMiniPlayer } from '@/contexts/MiniPlayerContext';
import { Button } from '@/components/ui/button';
import { Play, Pause, X, Maximize2, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import Hls from 'hls.js';
import { getHLSConfig } from '@/lib/videoUtils';

export function MiniPlayer() {
  const navigate = useNavigate();
  const { video, isActive, isMinimized, stopMiniPlayer, maximizeMiniPlayer } = useMiniPlayer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Initialize video
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !video?.videoUrl) return;

    const isHls = video.videoUrl.includes('.m3u8');

    if (isHls && Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      
      const hls = new Hls({
        ...(getHLSConfig() as any),
        maxBufferLength: 8,
        maxMaxBufferLength: 16,
      });
      
      hls.loadSource(video.videoUrl);
      hls.attachMedia(videoEl);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (video.currentTime) {
          videoEl.currentTime = video.currentTime;
        }
        videoEl.play().catch(() => {});
      });
      
      hlsRef.current = hls;
    } else {
      videoEl.src = video.videoUrl;
      if (video.currentTime) {
        videoEl.currentTime = video.currentTime;
      }
      videoEl.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [video?.videoUrl, video?.currentTime]);

  // Update playing state on video events
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    videoEl.addEventListener('play', onPlay);
    videoEl.addEventListener('pause', onPause);

    return () => {
      videoEl.removeEventListener('play', onPlay);
      videoEl.removeEventListener('pause', onPause);
    };
  }, []);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    
    // Keep within viewport bounds
    const maxX = window.innerWidth - 320;
    const maxY = window.innerHeight - 180;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const touch = e.touches[0];
    setIsDragging(true);
    dragStart.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    };
  }, [position]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    
    const newX = touch.clientX - dragStart.current.x;
    const newY = touch.clientY - dragStart.current.y;
    
    const maxX = window.innerWidth - 320;
    const maxY = window.innerHeight - 180;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleTouchMove, handleTouchEnd]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleMaximize = () => {
    if (video) {
      const currentTime = videoRef.current?.currentTime || 0;
      stopMiniPlayer();
      navigate(`/watch/${video.episodeId}?t=${Math.floor(currentTime)}`);
    }
  };

  const handleClose = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    stopMiniPlayer();
  };

  if (!isActive || !isMinimized || !video) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed z-50 w-80 rounded-xl overflow-hidden shadow-2xl bg-black border border-border/50",
        "transition-shadow hover:shadow-3xl",
        isDragging && "cursor-grabbing"
      )}
      style={{
        right: position.x,
        bottom: position.y,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Video */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          poster={video.poster}
          playsInline
          muted={isMuted}
        />
        
        {/* Controls overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-0 hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white truncate max-w-[60%] font-medium">
              {video.animeTitle}
            </span>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={handleMaximize}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={handleClose}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="flex items-center justify-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={toggleMute}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 text-white hover:bg-white/20"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Title bar */}
      <div className="px-3 py-2 bg-card">
        <p className="text-xs text-muted-foreground truncate">
          EP {video.episodeNumber}: {video.title}
        </p>
      </div>
    </div>
  );
}
