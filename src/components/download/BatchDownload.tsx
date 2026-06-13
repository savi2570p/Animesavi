import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, CheckCircle2, Loader2, X, FileVideo, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { streamDownload, saveBlob, fmtSpeed, fmtEta, fmtSize } from '@/lib/downloadUtils';

interface Episode {
  id: string;
  episode_number: number;
  title: string;
  video_url: string | null;
  external_url: string | null;
}

interface BatchDownloadProps {
  episodes: Episode[];
  animeTitle: string;
}

interface DownloadItem {
  episode: Episode;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  speed: number;
  etaSec: number;
  received: number;
  total: number;
}

const QUALITY_OPTIONS = ['480p', '720p', '1080p', '2160p'] as const;

export function BatchDownload({ episodes, animeTitle }: BatchDownloadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<string>>(new Set());
  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [quality, setQuality] = useState<typeof QUALITY_OPTIONS[number]>('2160p');
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const downloadableEpisodes = episodes.filter(ep => ep.video_url || ep.external_url);

  const toggleSelectAll = useCallback(() => {
    if (selectedEpisodes.size === downloadableEpisodes.length) setSelectedEpisodes(new Set());
    else setSelectedEpisodes(new Set(downloadableEpisodes.map(ep => ep.id)));
  }, [selectedEpisodes.size, downloadableEpisodes]);

  const toggleEpisode = useCallback((episodeId: string) => {
    setSelectedEpisodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(episodeId)) newSet.delete(episodeId);
      else newSet.add(episodeId);
      return newSet;
    });
  }, []);

  const updateItem = (index: number, patch: Partial<DownloadItem>) => {
    setDownloadQueue(prev => prev.map((item, idx) => idx === index ? { ...item, ...patch } : item));
  };

  const downloadSingleEpisode = async (episode: Episode, index: number): Promise<boolean> => {
    const videoUrl = episode.video_url || episode.external_url;
    if (!videoUrl) return false;

    const ext = (videoUrl.split('?')[0].split('.').pop() || 'mp4').toLowerCase();
    const safeExt = ['mp4', 'mkv', 'webm', 'm4v'].includes(ext) ? ext : 'mp4';
    const fileName = `${animeTitle} - Episode ${episode.episode_number} [${quality}].${safeExt}`;

    updateItem(index, { status: 'downloading', progress: 0, speed: 0, etaSec: 0, received: 0, total: 0 });

    abortRef.current = new AbortController();
    const onProgress = (p: { received: number; total: number; pct: number; speed: number; etaSec: number }) => {
      updateItem(index, { progress: p.pct, speed: p.speed, etaSec: p.etaSec, received: p.received, total: p.total });
    };

    // Try direct stream first, then same-origin proxy fallback on CORS failure
    for (const useProxy of [false, true]) {
      try {
        const { chunks, total, received, mime } = await streamDownload({
          url: videoUrl,
          filename: fileName,
          signal: abortRef.current.signal,
          onProgress,
          useProxy,
        });
        if (cancelledRef.current) { updateItem(index, { status: 'cancelled' }); return false; }
        if (received < 100 * 1024) throw new Error('payload too small');
        if (total > 0 && Math.abs(received - total) > 1024) throw new Error('size mismatch');
        saveBlob(chunks, mime, fileName);
        updateItem(index, { status: 'completed', progress: 100 });
        return true;
      } catch (e: any) {
        if (e?.name === 'AbortError' || cancelledRef.current) {
          updateItem(index, { status: 'cancelled' });
          return false;
        }
        if (useProxy) {
          updateItem(index, { status: 'failed' });
          return false;
        }
        // else loop and retry via proxy
      }
    }
    return false;
  };

  const startDownload = useCallback(async () => {
    if (selectedEpisodes.size === 0) { toast.error('Please select at least one episode'); return; }
    const episodesToDownload = downloadableEpisodes.filter(ep => selectedEpisodes.has(ep.id));
    setDownloadQueue(episodesToDownload.map(ep => ({
      episode: ep, status: 'pending', progress: 0, speed: 0, etaSec: 0, received: 0, total: 0,
    })));
    setIsDownloading(true);
    setCompletedCount(0);
    cancelledRef.current = false;

    let successCount = 0;
    for (let i = 0; i < episodesToDownload.length; i++) {
      if (cancelledRef.current) break;
      const ok = await downloadSingleEpisode(episodesToDownload[i], i);
      if (ok) { successCount++; setCompletedCount(successCount); }
    }

    setIsDownloading(false);
    if (cancelledRef.current) toast.message('Downloads cancelled');
    else if (successCount === episodesToDownload.length) toast.success(`All ${successCount} episodes downloaded!`);
    else if (successCount > 0) toast.success(`Downloaded ${successCount} of ${episodesToDownload.length} episodes`);
    else toast.error('Download failed. Please try again.');
  }, [selectedEpisodes, downloadableEpisodes, animeTitle, quality]);

  const cancelDownload = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setDownloadQueue(prev => prev.map(item =>
      item.status === 'downloading' || item.status === 'pending' ? { ...item, status: 'cancelled' } : item
    ));
  }, []);

  const resetDownload = useCallback(() => {
    setDownloadQueue([]);
    setSelectedEpisodes(new Set());
    setCompletedCount(0);
    cancelledRef.current = false;
  }, []);

  if (downloadableEpisodes.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download All
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileVideo className="h-5 w-5 text-primary" />
            Download Episodes
          </DialogTitle>
          <DialogDescription>
            Select episodes to download for offline viewing
          </DialogDescription>
        </DialogHeader>

        {downloadQueue.length === 0 ? (
          <>
            {/* Quality selector */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quality</p>
              <div className="grid grid-cols-4 gap-2">
                {QUALITY_OPTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={`py-2 rounded-md text-xs font-semibold border transition-all ${
                      quality === q
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border bg-muted/30 text-foreground hover:border-primary/40'
                    }`}
                  >
                    {q === '2160p' ? '4K' : q}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedEpisodes.size === downloadableEpisodes.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">
                  Select All ({downloadableEpisodes.length} episodes)
                </span>
              </label>
              <span className="text-sm text-muted-foreground">
                {selectedEpisodes.size} selected
              </span>
            </div>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {downloadableEpisodes.map(episode => (
                  <label
                    key={episode.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedEpisodes.has(episode.id)}
                      onCheckedChange={() => toggleEpisode(episode.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">Episode {episode.episode_number}</p>
                      <p className="text-xs text-muted-foreground truncate">{episode.title}</p>
                    </div>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </label>
                ))}
              </div>
            </ScrollArea>

            <Button onClick={startDownload} disabled={selectedEpisodes.size === 0} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Download {selectedEpisodes.size} {quality === '2160p' ? '4K' : quality} Episode{selectedEpisodes.size !== 1 ? 's' : ''}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm font-medium">
                Downloaded: {completedCount} / {downloadQueue.length}
              </span>
              {isDownloading && (
                <Button size="sm" variant="destructive" onClick={cancelDownload} className="h-7 gap-1">
                  <Ban className="h-3 w-3" />
                  Cancel
                </Button>
              )}
            </div>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {downloadQueue.map((item) => (
                  <div key={item.episode.id} className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Episode {item.episode.episode_number}</span>
                      {item.status === 'pending' && <span className="text-xs text-muted-foreground">Waiting…</span>}
                      {item.status === 'downloading' && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                      {item.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      {item.status === 'failed' && <X className="h-4 w-4 text-destructive" />}
                      {item.status === 'cancelled' && <Ban className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <Progress value={item.progress} className="h-1.5" />
                    {item.status === 'downloading' && (
                      <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground font-mono tabular-nums">
                        <span>{fmtSize(item.received)} / {fmtSize(item.total)}</span>
                        <span>{fmtSpeed(item.speed)} · ETA {fmtEta(item.etaSec)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetDownload} disabled={isDownloading} className="flex-1">
                {isDownloading ? 'Downloading…' : 'Download More'}
              </Button>
              <Button onClick={() => setIsOpen(false)} className="flex-1">Done</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
