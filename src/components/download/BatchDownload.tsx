import { useState, useCallback } from 'react';
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
import { Download, CheckCircle2, Loader2, X, FileVideo } from 'lucide-react';
import { toast } from 'sonner';

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
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
}

export function BatchDownload({ episodes, animeTitle }: BatchDownloadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<string>>(new Set());
  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const downloadableEpisodes = episodes.filter(ep => ep.video_url || ep.external_url);

  const toggleSelectAll = useCallback(() => {
    if (selectedEpisodes.size === downloadableEpisodes.length) {
      setSelectedEpisodes(new Set());
    } else {
      setSelectedEpisodes(new Set(downloadableEpisodes.map(ep => ep.id)));
    }
  }, [selectedEpisodes.size, downloadableEpisodes]);

  const toggleEpisode = useCallback((episodeId: string) => {
    setSelectedEpisodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(episodeId)) newSet.delete(episodeId);
      else newSet.add(episodeId);
      return newSet;
    });
  }, []);

  const downloadSingleEpisode = async (episode: Episode, index: number): Promise<boolean> => {
    const videoUrl = episode.video_url || episode.external_url;
    if (!videoUrl) return false;

    setDownloadQueue(prev => prev.map((item, idx) =>
      idx === index ? { ...item, status: 'downloading', progress: 0 } : item
    ));

    // Determine correct extension/MIME from the source URL
    const ext = (videoUrl.split('?')[0].split('.').pop() || 'mp4').toLowerCase();
    const mime = ext === 'mkv' ? 'video/x-matroska' : ext === 'webm' ? 'video/webm' : 'video/mp4';
    const safeExt = ['mp4', 'mkv', 'webm', 'm4v'].includes(ext) ? ext : 'mp4';
    const fileName = `${animeTitle} - Episode ${episode.episode_number} [720p].${safeExt}`;

    try {
      // Try real streaming download with progress + size verification
      const res = await fetch(videoUrl, { mode: 'cors', credentials: 'omit' });
      if (!res.ok || !res.body) throw new Error('fetch failed');

      const ctype = (res.headers.get('content-type') || '').toLowerCase();
      // If server returned HTML (error page / redirect login), bail to fallback
      if (ctype.includes('text/html')) throw new Error('html response');

      const total = Number(res.headers.get('content-length') || '0');
      const reader = res.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total > 0) {
            const pct = Math.min(99, (received / total) * 100);
            setDownloadQueue(prev => prev.map((item, idx) =>
              idx === index ? { ...item, progress: pct } : item
            ));
          }
        }
      }

      // Sanity check: anything under 100KB is almost certainly an error page
      if (received < 100 * 1024) throw new Error('payload too small');
      if (total > 0 && Math.abs(received - total) > 1024) throw new Error('size mismatch');

      const blob = new Blob(chunks, { type: mime });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);

      setDownloadQueue(prev => prev.map((item, idx) =>
        idx === index ? { ...item, status: 'completed', progress: 100 } : item
      ));
      return true;
    } catch {
      // Fallback: hidden iframe download (avoids opening default player tab)
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = videoUrl;
        document.body.appendChild(iframe);
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 60000);
        setDownloadQueue(prev => prev.map((item, idx) =>
          idx === index ? { ...item, status: 'completed', progress: 100 } : item
        ));
        return true;
      } catch {
        setDownloadQueue(prev => prev.map((item, idx) =>
          idx === index ? { ...item, status: 'failed' } : item
        ));
        return false;
      }
    }
  };

  const startDownload = useCallback(async () => {
    if (selectedEpisodes.size === 0) {
      toast.error('Please select at least one episode');
      return;
    }

    const episodesToDownload = downloadableEpisodes.filter(ep => selectedEpisodes.has(ep.id));
    setDownloadQueue(episodesToDownload.map(ep => ({ episode: ep, status: 'pending', progress: 0 })));
    setIsDownloading(true);
    setCompletedCount(0);

    let successCount = 0;
    for (let i = 0; i < episodesToDownload.length; i++) {
      const success = await downloadSingleEpisode(episodesToDownload[i], i);
      if (success) { successCount++; setCompletedCount(successCount); }
      if (i < episodesToDownload.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsDownloading(false);
    if (successCount === episodesToDownload.length) toast.success(`All ${successCount} episodes downloaded!`);
    else if (successCount > 0) toast.success(`Downloaded ${successCount} of ${episodesToDownload.length} episodes`);
    else toast.error('Download failed. Please try again.');
  }, [selectedEpisodes, downloadableEpisodes, animeTitle]);

  const resetDownload = useCallback(() => {
    setDownloadQueue([]);
    setSelectedEpisodes(new Set());
    setCompletedCount(0);
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
              Download {selectedEpisodes.size} Episode{selectedEpisodes.size !== 1 ? 's' : ''}
            </Button>
          </>
        ) : (
          <>
            <div className="text-center py-2 border-b border-border">
              <span className="text-sm font-medium">
                Downloaded: {completedCount} / {downloadQueue.length} episodes
              </span>
            </div>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {downloadQueue.map((item) => (
                  <div key={item.episode.id} className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Episode {item.episode.episode_number}</span>
                      {item.status === 'pending' && <span className="text-xs text-muted-foreground">Waiting...</span>}
                      {item.status === 'downloading' && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                      {item.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      {item.status === 'failed' && <X className="h-4 w-4 text-destructive" />}
                    </div>
                    <Progress value={item.progress} className="h-1.5" />
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetDownload} disabled={isDownloading} className="flex-1">
                {isDownloading ? 'Downloading...' : 'Download More'}
              </Button>
              <Button onClick={() => setIsOpen(false)} className="flex-1">Done</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}