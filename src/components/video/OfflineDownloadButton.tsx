import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  CheckCircle2, 
  Trash2, 
  Loader2, 
  HardDrive,
  Wifi,
  WifiOff,
  Smartphone 
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface OfflineDownloadButtonProps {
  videoUrl: string | null;
  iosVideoUrl?: string | null;
  episodeId: string;
  episodeTitle: string;
  animeTitle: string;
  thumbnail?: string | null;
  className?: string;
  isIOSDevice?: boolean;
}

const OFFLINE_CACHE_NAME = 'anime-offline-videos';
const OFFLINE_INDEX_KEY = 'offline_video_index';

interface OfflineVideoEntry {
  episodeId: string;
  episodeTitle: string;
  animeTitle: string;
  videoUrl: string;
  cachedAt: string;
  size: number;
  isIOSOptimized?: boolean;
  thumbnail?: string;
}

export function OfflineDownloadButton({
  videoUrl,
  iosVideoUrl,
  episodeId,
  episodeTitle,
  animeTitle,
  thumbnail,
  className,
  isIOSDevice = false,
}: OfflineDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isCached, setIsCached] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheSize, setCacheSize] = useState<string>('');
  const [isIOSOptimized, setIsIOSOptimized] = useState(false);

  // Determine the best video URL to download (prefer iOS-optimized on iOS devices)
  const effectiveVideoUrl = (isIOSDevice && iosVideoUrl) ? iosVideoUrl : videoUrl;

  // Check if video is already cached
  useEffect(() => {
    const checkCache = async () => {
      if (!('caches' in window)) return;

      try {
        const cache = await caches.open(OFFLINE_CACHE_NAME);
        const index = getOfflineIndex();
        const entry = index.find(e => e.episodeId === episodeId);
        
        if (entry) {
          const response = await cache.match(entry.videoUrl);
          if (response) {
            setIsCached(true);
            setCacheSize(formatBytes(entry.size));
            setIsIOSOptimized(entry.isIOSOptimized || false);
          } else {
            // Entry exists but video is not cached - clean up
            removeFromIndex(episodeId);
          }
        }
      } catch (error) {
        console.error('Error checking cache:', error);
      }
    };

    checkCache();
  }, [episodeId, effectiveVideoUrl]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getOfflineIndex = (): OfflineVideoEntry[] => {
    try {
      const stored = localStorage.getItem(OFFLINE_INDEX_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveToIndex = (entry: OfflineVideoEntry) => {
    const index = getOfflineIndex();
    const existing = index.findIndex(e => e.episodeId === entry.episodeId);
    if (existing >= 0) {
      index[existing] = entry;
    } else {
      index.push(entry);
    }
    localStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(index));
  };

  const removeFromIndex = (epId: string) => {
    const index = getOfflineIndex().filter(e => e.episodeId !== epId);
    localStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(index));
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadForOffline = useCallback(async () => {
    const urlToDownload = effectiveVideoUrl;
    
    if (!urlToDownload) {
      toast.error('No video URL available');
      return;
    }

    if (!('caches' in window)) {
      toast.error('Offline caching is not supported on this device');
      return;
    }

    if (!isOnline) {
      toast.error('You need to be online to download');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);

      // Fetch with progress tracking
      const response = await fetch(urlToDownload);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      if (!response.body) {
        throw new Error('Response body is not available');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        if (total > 0) {
          setDownloadProgress(Math.round((receivedLength / total) * 100));
        }
      }

      // Create blob from chunks - convert Uint8Array to ArrayBuffer
      const allChunks = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }
      const blob = new Blob([allChunks.buffer]);
      
      // Store in cache
      const cacheResponse = new Response(blob, {
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
          'Content-Length': receivedLength.toString(),
        },
      });

      await cache.put(urlToDownload, cacheResponse);

      // Save to index with iOS optimization flag
      const isOptimized = isIOSDevice && iosVideoUrl === urlToDownload;
      saveToIndex({
        episodeId,
        episodeTitle,
        animeTitle,
        videoUrl: urlToDownload,
        cachedAt: new Date().toISOString(),
        size: receivedLength,
        isIOSOptimized: isOptimized,
        thumbnail: thumbnail || undefined,
      });

      setIsCached(true);
      setCacheSize(formatBytes(receivedLength));
      setIsIOSOptimized(isOptimized);
      
      const formatLabel = isOptimized ? ' (iOS Optimized)' : '';
      toast.success(`Video saved for offline viewing!${formatLabel}`, {
        description: `${episodeTitle} (${formatBytes(receivedLength)})`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download video for offline viewing');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, [effectiveVideoUrl, iosVideoUrl, episodeId, episodeTitle, animeTitle, isOnline, isIOSDevice]);

  const removeOfflineVideo = useCallback(async () => {
    if (!effectiveVideoUrl) return;

    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      await cache.delete(effectiveVideoUrl);
      removeFromIndex(episodeId);
      setIsCached(false);
      setCacheSize('');
      setIsIOSOptimized(false);
      toast.success('Offline video removed');
    } catch (error) {
      console.error('Error removing cached video:', error);
      toast.error('Failed to remove offline video');
    }
  }, [effectiveVideoUrl, episodeId]);

  if (!('caches' in window)) {
    return null; // Don't show button if caching isn't supported
  }

  if (isDownloading) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Downloading... {downloadProgress}%</span>
          {isIOSDevice && iosVideoUrl && (
            <span className="text-xs text-primary">(iOS Optimized)</span>
          )}
        </div>
        <Progress value={downloadProgress} className="h-2" />
      </div>
    );
  }

  if (isCached) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-primary border-primary/30 bg-primary/10"
          disabled
        >
          <CheckCircle2 className="h-4 w-4" />
          Saved Offline
          {isIOSOptimized && <Smartphone className="h-3 w-3" />}
          {cacheSize && <span className="text-xs opacity-70">({cacheSize})</span>}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={removeOfflineVideo}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={downloadForOffline}
      disabled={!isOnline || !effectiveVideoUrl}
      className={cn("gap-2", className)}
    >
      {isOnline ? (
        <>
          {isIOSDevice && iosVideoUrl ? (
            <>
              <Smartphone className="h-4 w-4" />
              Save Offline (iOS)
            </>
          ) : (
            <>
              <HardDrive className="h-4 w-4" />
              Save Offline
            </>
          )}
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          Offline
        </>
      )}
    </Button>
  );
}
