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
      if (newSet.has(episodeId)) {
        newSet.delete(episodeId);
      } else {
        newSet.add(episodeId);
      }
      return newSet;
    });
  }, []);

  const startDownload = useCallback(async () => {
    if (selectedEpisodes.size === 0) {
      toast.error('Please select at least one episode');
      return;
    }

    const episodesToDownload = downloadableEpisodes.filter(ep => selectedEpisodes.has(ep.id));
    
    setDownloadQueue(episodesToDownload.map(ep => ({
      episode: ep,
      status: 'pending',
      progress: 0,
    })));
    
    setIsDownloading(true);

    // Process downloads one by one
    for (let i = 0; i < episodesToDownload.length; i++) {
      const episode = episodesToDownload[i];
      const videoUrl = episode.video_url || episode.external_url;
      
      if (!videoUrl) continue;

      // Update status to downloading
      setDownloadQueue(prev => prev.map((item, idx) => 
        idx === i ? { ...item, status: 'downloading' } : item
      ));

      try {
        // Simulate download progress (actual download via browser)
        for (let progress = 0; progress <= 100; progress += 20) {
          await new Promise(resolve => setTimeout(resolve, 200));
          setDownloadQueue(prev => prev.map((item, idx) => 
            idx === i ? { ...item, progress } : item
          ));
        }

        // Create download link
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `${animeTitle} - Episode ${episode.episode_number}.mp4`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Mark as completed
        setDownloadQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'completed', progress: 100 } : item
        ));

        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        setDownloadQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'failed' } : item
        ));
      }
    }

    setIsDownloading(false);
    toast.success('Download queue completed!');
  }, [selectedEpisodes, downloadableEpisodes, animeTitle]);

  const resetDownload = useCallback(() => {
    setDownloadQueue([]);
    setSelectedEpisodes(new Set());
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
            {/* Episode Selection */}
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
                      <p className="text-sm font-medium truncate">
                        Episode {episode.episode_number}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {episode.title}
                      </p>
                    </div>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </label>
                ))}
              </div>
            </ScrollArea>

            <Button 
              onClick={startDownload} 
              disabled={selectedEpisodes.size === 0}
              className="w-full gap-2"
            >
              <Download className="h-4 w-4" />
              Download {selectedEpisodes.size} Episode{selectedEpisodes.size !== 1 ? 's' : ''}
            </Button>
          </>
        ) : (
          <>
            {/* Download Progress */}
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {downloadQueue.map((item, idx) => (
                  <div key={item.episode.id} className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        Episode {item.episode.episode_number}
                      </span>
                      {item.status === 'pending' && (
                        <span className="text-xs text-muted-foreground">Waiting...</span>
                      )}
                      {item.status === 'downloading' && (
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      )}
                      {item.status === 'completed' && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                      {item.status === 'failed' && (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <Progress value={item.progress} className="h-1.5" />
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={resetDownload}
                disabled={isDownloading}
                className="flex-1"
              >
                {isDownloading ? 'Downloading...' : 'Download More'}
              </Button>
              <Button 
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
