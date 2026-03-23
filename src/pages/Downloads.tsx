import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Trash2, Play, HardDrive, WifiOff, AlertCircle, ArrowLeft, Maximize, Minimize, Pause, RotateCw, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';

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

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatTime = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

function OfflinePlayer({ entry, onClose }: { entry: OfflineVideoEntry; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
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

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }, []);

  const skip = useCallback((sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(v.currentTime + sec, 0), v.duration || 0);
  }, []);

  const handleSeek = useCallback((val: number[]) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = val[0];
    setCurrentTime(val[0]);
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
      onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO') togglePlay(); }}
    >
      {/* Top bar */}
      <div className={`absolute top-0 left-0 right-0 z-20 flex items-center gap-2 p-2 sm:p-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 sm:h-8 sm:w-8 text-white hover:bg-white/10">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs sm:text-sm font-medium truncate">{entry.episodeTitle}</p>
          <p className="text-white/60 text-[10px] truncate">{entry.animeTitle}</p>
        </div>
        <div className="flex items-center gap-1 bg-black/40 rounded px-1.5 py-0.5">
          <WifiOff className="w-3 h-3 text-yellow-400" />
          <span className="text-[10px] text-yellow-400 font-medium">Offline</span>
        </div>
      </div>

      {/* Center play/pause */}
      {!isPlaying && showControls && (
        <button onClick={togglePlay} className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
            <Play className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground fill-primary-foreground ml-0.5" />
          </div>
        </button>
      )}

      {/* Video - no native controls */}
      <video
        ref={videoRef}
        src={blobUrl}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
        onPlay={() => { setIsPlaying(true); resetHideTimer(); }}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => { if (!isSeeking && videoRef.current) setCurrentTime(videoRef.current.currentTime); }}
        onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration); }}
      />

      {/* Bottom controls */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 to-transparent px-3 pb-3 pt-8 sm:px-4 sm:pb-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Progress bar */}
        <div className="mb-2">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 1}
            step={0.5}
            onValueChange={handleSeek}
            onPointerDown={() => setIsSeeking(true)}
            onPointerUp={() => setIsSeeking(false)}
            className="w-full [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-primary"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={togglePlay} className="h-7 w-7 text-white hover:bg-white/10">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => skip(10)} className="h-7 w-7 text-white hover:bg-white/10">
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setIsMuted(!isMuted); } }} className="h-7 w-7 text-white hover:bg-white/10">
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </Button>
            <span className="text-[10px] sm:text-xs text-white/70 ml-1 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-7 w-7 text-white hover:bg-white/10">
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </Button>
        </div>
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
  const [activeDownloads, setActiveDownloads] = useState<{ title: string; progress: number }[]>([]);

  // Listen for download progress events from OfflineDownloadButton
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { title, progress: pct, done } = e.detail;
      setActiveDownloads(prev => {
        if (done) return prev.filter(d => d.title !== title);
        const existing = prev.find(d => d.title === title);
        if (existing) return prev.map(d => d.title === title ? { ...d, progress: pct } : d);
        return [...prev, { title, progress: pct }];
      });
      if (done) loadDownloads();
    };
    window.addEventListener('offline-download-progress', handler as EventListener);
    return () => window.removeEventListener('offline-download-progress', handler as EventListener);
  }, []);

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

      {/* Active downloads progress */}
      {activeDownloads.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {activeDownloads.map((dl) => (
            <div key={dl.title} className="p-3 rounded-xl bg-card border border-primary/20 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                <p className="text-xs font-medium text-foreground truncate flex-1">{dl.title}</p>
                <span className="text-[10px] text-primary font-semibold">{Math.round(dl.progress)}%</span>
              </div>
              <Progress value={dl.progress} className="h-1.5" />
            </div>
          ))}
        </div>
      )}

      {downloads.length === 0 && activeDownloads.length === 0 ? (
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
            <div key={entry.episodeId} className="flex items-start gap-3 p-2 sm:p-3 rounded-xl bg-card border border-border/40 hover:border-primary/20 transition-all">
              {/* Thumbnail preview */}
              <button
                onClick={() => setPlayingEntry(entry)}
                className="shrink-0 relative w-28 sm:w-36 aspect-video rounded-lg overflow-hidden bg-muted group"
              >
                {entry.thumbnail ? (
                  <img src={entry.thumbnail} alt={entry.episodeTitle} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/5 flex items-center justify-center">
                    <Play className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-primary/90 flex items-center justify-center">
                    <Play className="w-4 h-4 text-primary-foreground fill-primary-foreground ml-0.5" />
                  </div>
                </div>
              </button>
              <div className="flex-1 min-w-0 py-0.5">
                <p className="text-sm font-semibold text-foreground truncate">{entry.episodeTitle}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.animeTitle}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {formatBytes(entry.size)} • {new Date(entry.cachedAt).toLocaleDateString()}
                  {entry.isIOSOptimized && ' • iOS'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteDownload(entry)}
                className="shrink-0 h-7 w-7 mt-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
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
