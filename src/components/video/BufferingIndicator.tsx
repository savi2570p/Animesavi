import { useState, useEffect } from 'react';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface BufferingIndicatorProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isVisible: boolean;
  className?: string;
}

export function BufferingIndicator({ videoRef, isVisible, className }: BufferingIndicatorProps) {
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [networkType, setNetworkType] = useState<string>('unknown');
  const [showIndicator, setShowIndicator] = useState(false);
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    let bufferingTimeout: NodeJS.Timeout;
    let wasPlaying = false;
    
    const handleWaiting = () => {
      wasPlaying = !video.paused;
      // Only show buffering indicator after a short delay to avoid flashing
      bufferingTimeout = setTimeout(() => {
        if (wasPlaying) {
          setIsBuffering(true);
          setShowIndicator(true);
        }
      }, 500);
    };
    
    const handlePlaying = () => {
      clearTimeout(bufferingTimeout);
      setIsBuffering(false);
      // Keep indicator visible briefly to show recovery
      setTimeout(() => setShowIndicator(false), 300);
    };
    
    const handleCanPlay = () => {
      clearTimeout(bufferingTimeout);
      setIsBuffering(false);
    };
    
    const handleProgress = () => {
      if (video.buffered.length > 0 && video.duration > 0) {
        const currentTime = video.currentTime;
        let bufferedEnd = 0;
        
        // Find the buffered range that contains current time
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= currentTime && video.buffered.end(i) >= currentTime) {
            bufferedEnd = video.buffered.end(i);
            break;
          }
        }
        
        // Calculate how much is buffered ahead of current time
        const bufferedAhead = bufferedEnd - currentTime;
        const bufferTarget = 30; // Target 30 seconds of buffer
        const progress = Math.min(100, (bufferedAhead / bufferTarget) * 100);
        setBufferProgress(progress);
      }
    };
    
    // Detect network type
    const updateNetworkType = () => {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;
      if (connection) {
        const type = connection.effectiveType || connection.type || 'unknown';
        setNetworkType(type);
      }
    };
    
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('progress', handleProgress);
    
    updateNetworkType();
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateNetworkType);
    }
    
    return () => {
      clearTimeout(bufferingTimeout);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('progress', handleProgress);
      if (connection) {
        connection.removeEventListener('change', updateNetworkType);
      }
    };
  }, [videoRef]);
  
  // Don't render if not visible or not buffering
  if (!isVisible && !showIndicator) return null;
  
  const isSlowNetwork = ['slow-2g', '2g'].includes(networkType);
  
  return (
    <div 
      className={cn(
        "absolute inset-0 flex items-center justify-center pointer-events-none z-30 transition-opacity duration-300",
        showIndicator && isBuffering ? "opacity-100" : "opacity-0",
        className
      )}
    >
      <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-black/70 backdrop-blur-sm">
        <div className="relative">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            {isSlowNetwork ? (
              <WifiOff className="h-5 w-5 text-yellow-400" />
            ) : (
              <Wifi className="h-5 w-5 text-white/80" />
            )}
          </div>
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-white">Buffering...</p>
          
          <div className="w-32">
            <Progress value={bufferProgress} className="h-1.5 bg-white/20" />
          </div>
          
          <p className="text-xs text-white/70">
            {Math.round(bufferProgress)}% buffered
          </p>
          
          {isSlowNetwork && (
            <p className="text-xs text-yellow-400">
              Slow network detected
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
