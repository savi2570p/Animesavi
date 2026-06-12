import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [isPreparing, setIsPreparing] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);

  const handlePrepare = () => {
    if (!videoUrl) {
      toast.error('No video available for download');
      return;
    }
    if (!selectedQuality) {
      toast.error('Please select a quality');
      return;
    }

    setIsPreparing(true);

    // Parse episode number from label, e.g. "Season 1 - Episode 5" → "05"
    let epNum = '01';
    if (episodeLabel) {
      const m = episodeLabel.match(/Episode\s*(\d+)/i);
      if (m) epNum = m[1].padStart(2, '0');
      else if (/movie/i.test(episodeLabel)) epNum = 'Movie';
    }

    const params = new URLSearchParams({
      quality: selectedQuality,
      anime: animeTitle || 'AnimeSavi',
      ep: epNum,
      url: videoUrl,
    });

    onOpenChange(false);
    setSelectedQuality(null);
    setIsPreparing(false);
    navigate(`/Shadow-Arise?${params.toString()}`);
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
            onClick={handlePrepare}
            disabled={isPreparing || !selectedQuality}
            className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
          >
            {isPreparing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isPreparing ? 'Preparing…' : selectedQuality ? `Prepare ${selectedQuality}` : 'Select Quality'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
