import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Download, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface DownloadVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  fileName: string;
  animeTitle?: string;
  episodeLabel?: string;
}

const QUALITY_OPTIONS = [
  { label: '480p', tag: 'SD' },
  { label: '720p', tag: 'HD' },
  { label: '1080p', tag: 'FHD' },
  { label: '2160p', tag: '4K' },
];

export function DownloadVerificationDialog({
  open,
  onOpenChange,
  videoUrl,
  fileName,
  animeTitle,
  episodeLabel,
}: DownloadVerificationDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!videoUrl) {
      toast.error('No video available for download');
      return;
    }
    if (!selectedQuality) {
      toast.error('Please select a quality');
      return;
    }

    setIsDownloading(true);

    // Build filename with quality
    const base = fileName.replace(/\.mp4$/i, '');
    const qualityFileName = `${base}_${selectedQuality}.mp4`;

    try {
      toast.info('Preparing download...');

      try {
        const response = await fetch(videoUrl, { mode: 'cors' });
        if (!response.ok) throw new Error('Fetch failed');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = qualityFileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        toast.success('Download started! Check your downloads.');
      } catch {
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = qualityFileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Download started!');
      }

      onOpenChange(false);
      setSelectedQuality(null);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to start download. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelectedQuality(null); }}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-destructive" />
            Download Confirmation
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">You are downloading:</p>
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                {animeTitle && (
                  <p className="text-sm font-semibold text-foreground">{animeTitle}</p>
                )}
                {episodeLabel && (
                  <p className="text-sm text-muted-foreground">{episodeLabel}</p>
                )}
                <p className="text-xs font-medium text-primary">AnimeSavi</p>
              </div>

              {/* Quality Selection */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Select Quality:</p>
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
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
          <AlertDialogCancel className="flex-1 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive mt-0">
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={handleDownload}
            disabled={isDownloading || !selectedQuality}
            className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isDownloading ? 'Downloading...' : selectedQuality ? `Download ${selectedQuality}` : 'Select Quality'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
