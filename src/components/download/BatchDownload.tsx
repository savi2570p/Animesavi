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
import { Download, CheckCircle2, Loader2, X, FileVideo, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { TelegramUnlockDialog, isDownloadUnlocked } from './TelegramUnlockDialog';

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
  const [showTelegramDialog, setShowTelegramDialog] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(() => isDownloadUnlocked());
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<string>>(new Set());
  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const downloadableEpisodes = episodes.filter(ep => ep.video_url || ep.external_url);

  const handleButtonClick = () => {
    if (!isUnlocked) {
      setShowTelegramDialog(true);
    } else {
      setIsOpen(true);
    }
  };

  const handleUnlock = () => {
    setIsUnlocked(true);
    setIsOpen(true);
  };

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

  const downloadSingleEpisode = async (episode: Episode, index: number): Promise<boolean> => {
    const videoUrl = episode.video_url || episode.external_url;
    
    if (!videoUrl) return false;

    // Update status to downloading
    setDownloadQueue(prev => prev.map((item, idx) => 
      idx === index ? { ...item, status: 'downloading' } : item
    ));

    try {
      // Simulate download progress
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise(resolve => setTimeout(resolve, 150));
        setDownloadQueue(prev => prev.map((item, idx) => 
          idx === index ? { ...item, progress } : item
        ));
      }

      // Create download link - Use fetch to get the file for proper download
      try {
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${animeTitle} - Episode ${episode.episode_number}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch {
        // Fallback to direct link if fetch fails
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `${animeTitle} - Episode ${episode.episode_number}.mp4`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Mark as completed
      setDownloadQueue(prev => prev.map((item, idx) => 
        idx === index ? { ...item, status: 'completed', progress: 100 } : item
      ));

      return true;
    } catch (error) {
      setDownloadQueue(prev => prev.map((item, idx) => 
        idx === index ? { ...item, status: 'failed' } : item
      ));
      return false;
    }
  };

  const startDownload = useCallback(async () => {
    if (selectedEpisodes.size === 0) {
      toast.error('Please select at least one episode');
      return;
    }

    const episodesToDownload = downloadableEpisodes.filter(ep => selectedEpisodes.has(ep.id));
    
    // Initialize download queue with all selected episodes
    setDownloadQueue(episodesToDownload.map(ep => ({
      episode: ep,
      status: 'pending',
      progress: 0,
    })));
    
    setIsDownloading(true);
    setCompletedCount(0);

    let successCount = 0;

    // Process downloads one by one sequentially
    for (let i = 0; i < episodesToDownload.length; i++) {
      const episode = episodesToDownload[i];
      
      const success = await downloadSingleEpisode(episode, i);
      
      if (success) {
        successCount++;
        setCompletedCount(successCount);
      }

      // Delay between downloads to prevent browser blocking
      if (i < episodesToDownload.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setIsDownloading(false);
    
    if (successCount === episodesToDownload.length) {
      toast.success(`All ${successCount} episodes downloaded successfully!`);
    } else if (successCount > 0) {
      toast.success(`Downloaded ${successCount} of ${episodesToDownload.length} episodes`);
    } else {
      toast.error('Download failed. Please try again.');
    }
  }, [selectedEpisodes, downloadableEpisodes, animeTitle]);

  const resetDownload = useCallback(() => {
    setDownloadQueue([]);
    setSelectedEpisodes(new Set());
    setCompletedCount(0);
  }, []);

  if (downloadableEpisodes.length === 0) return null;

  return (
    <>
      <TelegramUnlockDialog 
        isOpen={showTelegramDialog}
        onOpenChange={setShowTelegramDialog}
        onUnlock={handleUnlock}
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={(e) => {
              if (!isUnlocked) {
                e.preventDefault();
                handleButtonClick();
              }
            }}
          >
            {isUnlocked ? (
              <Download className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
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
              <div className="text-center py-2 border-b border-border">
                <span className="text-sm font-medium">
                  Downloaded: {completedCount} / {downloadQueue.length} episodes
                </span>
              </div>
              
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
    </>
  );
}
