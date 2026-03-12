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
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface DownloadVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  fileName: string;
  animeTitle?: string;
  episodeLabel?: string;
}

export function DownloadVerificationDialog({
  open,
  onOpenChange,
  videoUrl,
  fileName,
  animeTitle,
  episodeLabel,
}: DownloadVerificationDialogProps) {

  const handleDownload = async () => {
    if (!videoUrl) {
      toast.error('No video available for download');
      return;
    }

    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isMobile = isIOS || isAndroid;

      if (isMobile) {
        toast.info('Preparing download...');
        try {
          const response = await fetch(videoUrl, { mode: 'cors' });
          if (!response.ok) throw new Error('Download failed');
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          toast.success('Download started! Check your downloads or gallery.');
        } catch {
          window.open(videoUrl, '_blank');
          toast.info('Video opened in new tab. Long press to save to gallery.');
        }
      } else {
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Download started! Check your file manager.');
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to start download. Please try again.');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-destructive" />
            Download Confirmation
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 pt-2">
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
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
          <AlertDialogCancel className="flex-1 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive mt-0">
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={handleDownload}
            className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
