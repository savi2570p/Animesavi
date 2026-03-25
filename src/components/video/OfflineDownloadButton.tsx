import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  CheckCircle2, 
  Trash2, 
  Loader2, 
  HardDrive,
  WifiOff,
  Smartphone,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

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

const QUALITY_OPTIONS = [
  { label: '480p', tag: 'SD' },
  { label: '720p', tag: 'HD' },
  { label: '1080p', tag: 'FHD' },
  { label: '2160p', tag: '4K' },
];

interface OfflineVideoEntry {
  episodeId: string;
  episodeTitle: string;
  animeTitle: string;
  videoUrl: string;
  cachedAt: string;
  size: number;
  isIOSOptimized?: boolean;
  thumbnail?: string;
  quality?: string;
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
  const [showQualityDialog, setShowQualityDialog] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);

  const effectiveVideoUrl = (isIOSDevice && iosVideoUrl) ? iosVideoUrl : videoUrl;

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
            removeFromIndex(episodeId);
          }
        }
      } catch (error) {
        console.error('Error checking cache:', error);
      }
    };
    checkCache();
  }, [episodeId, effectiveVideoUrl]);

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

  const downloadForOffline = useCallback(async (quality: string) => {
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

    setShowQualityDialog(false);
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const response = await fetch(urlToDownload);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      if (!response.body) throw new Error('Response body is not available');

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        if (total > 0) {
          const pct = Math.round((receivedLength / total) * 100);
          setDownloadProgress(pct);
          window.dispatchEvent(new CustomEvent('offline-download-progress', { detail: { title: episodeTitle, progress: pct, done: false } }));
        }
      }

      const allChunks = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }
      const blob = new Blob([allChunks.buffer]);

      const cacheResponse = new Response(blob, {
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
          'Content-Length': receivedLength.toString(),
        },
      });

      await cache.put(urlToDownload, cacheResponse);

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
        quality,
      });

      setIsCached(true);
      setCacheSize(formatBytes(receivedLength));
      setIsIOSOptimized(isOptimized);

      window.dispatchEvent(new CustomEvent('offline-download-progress', { detail: { title: episodeTitle, progress: 100, done: true } }));
      toast.success(`Saved offline in ${quality}!`, {
        description: `${episodeTitle} (${formatBytes(receivedLength)})`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download video for offline viewing');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
      setSelectedQuality(null);
    }
  }, [effectiveVideoUrl, iosVideoUrl, episodeId, episodeTitle, animeTitle, isOnline, isIOSDevice, thumbnail]);

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

  if (!('caches' in window)) return null;

  if (isDownloading) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Downloading... {downloadProgress}%</span>
        </div>
        <Progress value={downloadProgress} className="h-2" />
      </div>
    );
  }

  if (isCached) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button variant="outline" size="sm" className="gap-2 text-primary border-primary/30 bg-primary/10" disabled>
          <CheckCircle2 className="h-4 w-4" />
          Saved Offline
          {isIOSOptimized && <Smartphone className="h-3 w-3" />}
          {cacheSize && <span className="text-xs opacity-70">({cacheSize})</span>}
        </Button>
        <Button variant="ghost" size="sm" onClick={removeOfflineVideo} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowQualityDialog(true)}
        disabled={!isOnline || !effectiveVideoUrl}
        className={cn("gap-2", className)}
      >
        {isOnline ? (
          <>
            <HardDrive className="h-4 w-4" />
            Save Offline
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            Offline
          </>
        )}
      </Button>

      <AlertDialog open={showQualityDialog} onOpenChange={(v) => { setShowQualityDialog(v); if (!v) setSelectedQuality(null); }}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-primary" />
              Save Offline
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p className="text-sm text-muted-foreground">Select quality for offline download:</p>
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <p className="text-sm font-semibold text-foreground">{animeTitle}</p>
                  <p className="text-sm text-muted-foreground">{episodeTitle}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {QUALITY_OPTIONS.map((q) => (
                    <button
                      key={q.label}
                      onClick={() => setSelectedQuality(q.label)}
                      className={`relative flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        selectedQuality === q.label
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-muted/30 text-foreground hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <span>{q.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        selectedQuality === q.label ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>{q.tag}</span>
                      {selectedQuality === q.label && (
                        <Check className="absolute -top-1 -right-1 w-4 h-4 text-primary-foreground bg-primary rounded-full p-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
            <AlertDialogCancel className="flex-1 mt-0">Cancel</AlertDialogCancel>
            <Button
              onClick={() => selectedQuality && downloadForOffline(selectedQuality)}
              disabled={!selectedQuality}
              className="flex-1 gap-2"
            >
              <Download className="w-4 h-4" />
              {selectedQuality ? `Save ${selectedQuality}` : 'Select Quality'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
