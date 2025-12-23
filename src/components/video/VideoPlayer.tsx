import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Download,
  Settings,
  Share2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

type ServerType = 'PLAY' | 'SHORT' | 'Zex';

interface VideoPlayerProps {
  videoUrl: string | null;
  externalUrl: string | null;
  title: string;
  animeTitle: string;
  episodeNumber: number;
  episodeId: string;
  poster?: string;
  isMovie?: boolean;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

const serverConfigs: Record<ServerType, { name: string; features: string[] }> = {
  PLAY: { name: 'PLAY', features: ['watch', 'share'] },
  SHORT: { name: 'SHORT', features: ['watch', 'quality', 'share'] },
  Zex: { name: 'Zex', features: ['watch', 'quality', 'download', 'share'] },
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
  onTimeUpdate,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeServer, setActiveServer] = useState<ServerType>('PLAY');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState<'auto' | '1080p' | '720p' | '480p' | '360p'>('auto');

  const features = serverConfigs[activeServer].features;

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

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/watch/${episodeId}`;
    const shareText = `Watch "${animeTitle}" - Episode ${episodeNumber}: ${title}`;

    if (navigator.share) {
      navigator.share({
        title: `${animeTitle} - Episode ${episodeNumber}`,
        text: shareText,
        url: shareUrl,
      }).catch(() => {
        navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
    }
  };

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

  // External URL player with autoplay
  if (externalUrl && activeServer === 'PLAY') {
    return (
      <div className="relative bg-black">
        {/* Server Selection */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {(Object.keys(serverConfigs) as ServerType[]).map((server) => (
            <Button
              key={server}
              size="sm"
              variant={activeServer === server ? 'default' : 'outline'}
              onClick={() => setActiveServer(server)}
              className={activeServer === server ? 'anime-button' : 'bg-black/50 text-white border-white/30 hover:bg-white/20'}
            >
              {serverConfigs[server].name}
            </Button>
          ))}
        </div>

        <div className="aspect-video w-full max-h-[70vh] bg-black">
          <iframe
            src={`${externalUrl}${externalUrl.includes('?') ? '&' : '?'}autoplay=1`}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title={`${animeTitle} - Episode ${episodeNumber}`}
            style={{ border: 'none' }}
          />
        </div>

        {/* Share button for external videos */}
        <div className="absolute bottom-4 right-4 z-10">
          <Button
            size="sm"
            variant="outline"
            onClick={handleShare}
            className="bg-black/50 text-white border-white/30 hover:bg-white/20"
          >
            <Share2 className="h-4 w-4 mr-1" />
            Share
          </Button>
        </div>
      </div>
    );
  }

  // No video available
  if (!videoUrl && !externalUrl) {
    return (
      <div className="aspect-video w-full max-h-[70vh] flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">Video not available</p>
      </div>
    );
  }

  // Native video player for all servers
  return (
    <div className="relative bg-black">
      {/* Server Selection */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {(Object.keys(serverConfigs) as ServerType[]).map((server) => (
          <Button
            key={server}
            size="sm"
            variant={activeServer === server ? 'default' : 'outline'}
            onClick={() => setActiveServer(server)}
            className={activeServer === server ? 'anime-button' : 'bg-black/50 text-white border-white/30 hover:bg-white/20'}
          >
            {serverConfigs[server].name}
          </Button>
        ))}
      </div>

      <div className="relative aspect-video w-full max-h-[70vh] group">
        <video
          ref={videoRef}
          src={videoUrl || externalUrl || undefined}
          className="w-full h-full"
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
        />

        {/* Custom Controls */}
        <div className="absolute inset-0 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/80 via-transparent to-transparent">
          {/* Progress Bar with Time */}
          <div className="px-4 mb-2">
            <div className="flex items-center gap-2 text-white text-sm mb-1">
              <span>{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleSeek}
                className="flex-1 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between px-4 pb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="text-white hover:bg-white/20"
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>

              <span className="text-white text-sm">
                Episode {episodeNumber}: {title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Quality Control (SHORT and Zex only) */}
              {features.includes('quality') && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                    >
                      <Settings className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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

              {/* Share (all servers) */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="text-white hover:bg-white/20"
              >
                <Share2 className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20"
              >
                <Maximize className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
