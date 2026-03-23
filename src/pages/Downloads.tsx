import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Trash2, Play, HardDrive, WifiOff, AlertCircle, X, ArrowLeft, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

function OfflinePlayer({ entry, onClose }: { entry: OfflineVideoEntry; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let url: string | null = null;
    (async () => {
      try {
        if (!('caches' in window)) { setError('Cache API not supported'); return; }
        const cache = await caches.open(OFFLINE_CACHE_NAME);
        const response = await cache.match(entry.videoUrl);
        if (!response) { setError('Video file not available offline'); return; }
        const blob = await response.blob();
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch { setError('Failed to load offline video'); }
    })();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [entry.videoUrl]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current.requestFullscreen?.();
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-foreground font-medium">{error}</p>
        <Button variant="outline" size="sm" onClick={onClose}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading offline video…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {/* Top bar */}
      <div className={`absolute top-0 left-0 right-0 z-10 flex items-center gap-2 p-2 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-white hover:bg-white/10">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium truncate">{entry.episodeTitle}</p>
          <p className="text-white/60 text-[10px] truncate">{entry.animeTitle}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8 text-white hover:bg-white/10">
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </Button>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        src={blobUrl}
        autoPlay
        controls
        playsInline
        className="w-full h-full object-contain"
        onPlay={resetHideTimer}
      />

      {/* Offline badge */}
      <div className={`absolute bottom-16 left-2 bg-black/60 rounded px-1.5 py-0.5 flex items-center gap-1 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <WifiOff className="w-3 h-3 text-yellow-400" />
        <span className="text-[10px] text-yellow-400 font-medium">Offline</span>
      </div>
    </div>
  );
}

export default function Downloads() {
  const navigate = useNavigate();
  const [downloads, setDownloads] = useState<OfflineVideoEntry[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [totalSize, setTotalSize] = useState(0);
  const [playingEntry, setPlayingEntry] = useState<OfflineVideoEntry | null>(null);

  const loadDownloads = useCallback(async () => {
    try {
      const stored = localStorage.getItem(OFFLINE_INDEX_KEY);
      const index: OfflineVideoEntry[] = stored ? JSON.parse(stored) : [];
      if (!('caches' in window)) {
        setDownloads(index);
        setTotalSize(index.reduce((s, e) => s + e.size, 0));
        return;
      }
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const validEntries: OfflineVideoEntry[] = [];
      for (const entry of index) {
        const response = await cache.match(entry.videoUrl);
        if (response) validEntries.push(entry);
      }
      if (validEntries.length !== index.length) {
        localStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(validEntries));
      }
      setDownloads(validEntries);
      setTotalSize(validEntries.reduce((s, e) => s + e.size, 0));
    } catch {
      const stored = localStorage.getItem(OFFLINE_INDEX_KEY);
      const index: OfflineVideoEntry[] = stored ? JSON.parse(stored) : [];
      setDownloads(index);
      setTotalSize(index.reduce((s, e) => s + e.size, 0));
    }
  }, []);

  useEffect(() => { loadDownloads(); }, [loadDownloads]);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const deleteDownload = async (entry: OfflineVideoEntry) => {
    try {
      if ('caches' in window) {
        const cache = await caches.open(OFFLINE_CACHE_NAME);
        await cache.delete(entry.videoUrl);
      }
      const updated = downloads.filter(d => d.episodeId !== entry.episodeId);
      localStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(updated));
      setDownloads(updated);
      setTotalSize(updated.reduce((s, e) => s + e.size, 0));
      toast.success(`Deleted: ${entry.episodeTitle}`);
    } catch { toast.error('Failed to delete'); }
  };

  const deleteAll = async () => {
    try {
      if ('caches' in window) await caches.delete(OFFLINE_CACHE_NAME);
      localStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify([]));
      setDownloads([]);
      setTotalSize(0);
      toast.success('All downloads deleted');
    } catch { toast.error('Failed to delete all'); }
  };

  // If playing, show the inline player
  if (playingEntry) {
    return <OfflinePlayer entry={playingEntry} onClose={() => setPlayingEntry(null)} />;
  }

  return (
    <div className="container max-w-3xl py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Download className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Downloads
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {downloads.length} video{downloads.length !== 1 ? 's' : ''} • {formatBytes(totalSize)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="flex items-center gap-1 text-xs text-yellow-500">
              <WifiOff className="w-3.5 h-3.5" /> Offline
            </span>
          )}
          {downloads.length > 0 && (
            <Button variant="ghost" size="sm" onClick={deleteAll} className="text-destructive hover:text-destructive text-xs">
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear All
            </Button>
          )}
        </div>
      </div>

      {downloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <HardDrive className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No Downloads Yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Save episodes for offline viewing by tapping the "Save Offline" button on any episode page.
          </p>
          <Button onClick={() => navigate('/browse')} className="mt-6" size="sm">Browse Anime</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {downloads.map((entry) => (
            <div key={entry.episodeId} className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-card border border-border/40 hover:border-primary/20 transition-all">
              <button
                onClick={() => setPlayingEntry(entry)}
                className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
              >
                <Play className="w-5 h-5 sm:w-6 sm:h-6 text-primary fill-primary" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{entry.episodeTitle}</p>
                <p className="text-xs text-muted-foreground truncate">{entry.animeTitle}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {formatBytes(entry.size)} • {new Date(entry.cachedAt).toLocaleDateString()}
                  {entry.isIOSOptimized && ' • iOS'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteDownload(entry)}
                className="shrink-0 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!('caches' in window) && (
        <div className="mt-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Offline Storage Not Supported</p>
            <p className="text-xs text-muted-foreground mt-1">Your browser doesn't support the Cache API needed for offline downloads.</p>
          </div>
        </div>
      )}
    </div>
  );
}
