import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, CheckCircle2, Download, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface DownloadVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  fileName: string;
}

type VerificationStep = 'verify' | 'verifying' | 'verified';

export function DownloadVerificationDialog({
  open,
  onOpenChange,
  videoUrl,
  fileName,
}: DownloadVerificationDialogProps) {
  const [step, setStep] = useState<VerificationStep>('verify');
  const [progress, setProgress] = useState(0);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('verify');
      setProgress(0);
    }
  }, [open]);

  // Handle verification loading animation
  useEffect(() => {
    if (step === 'verifying') {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 2; // 100% / 50 intervals = 2% per 100ms = 5 seconds total
        });
      }, 100);

      const timeout = setTimeout(() => {
        setStep('verified');
        toast.success('Successfully Verified!');
      }, 5000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [step]);

  const handleVerify = () => {
    setStep('verifying');
  };

  const handleDownload = async () => {
    if (!videoUrl) {
      toast.error('No video available for download');
      return;
    }

    try {
      // Detect platform
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isMobile = isIOS || isAndroid;

      if (isMobile) {
        // For mobile devices, use fetch to download and trigger save
        toast.info('Preparing download...');
        
        try {
          const response = await fetch(videoUrl, { mode: 'cors' });
          
          if (!response.ok) {
            throw new Error('Download failed');
          }
          
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up blob URL after a delay
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          
          toast.success('Download started! Check your downloads or gallery.');
        } catch (fetchError) {
          // Fallback: Open in new tab for mobile (user can save from there)
          window.open(videoUrl, '_blank');
          toast.info('Video opened in new tab. Long press to save to gallery.');
        }
      } else {
        // For PC/Laptop - use standard download
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'verify' && (
              <>
                <ShieldCheck className="w-5 h-5 text-primary" />
                Verification Required
              </>
            )}
            {step === 'verifying' && (
              <>
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                Verifying...
              </>
            )}
            {step === 'verified' && (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Successfully Verified
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 'verify' && 'You need to verify to download this content.'}
            {step === 'verifying' && 'Please wait while we verify your request...'}
            {step === 'verified' && 'Your verification is complete. You can now download the content.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {step === 'verify' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-10 h-10 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Click verify to confirm you are authorized to download this anime.
              </p>
              <Button onClick={handleVerify} className="w-full anime-button">
                Verify
              </Button>
            </div>
          )}

          {step === 'verifying' && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-muted"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray={276.46}
                    strokeDashoffset={276.46 * (1 - progress / 100)}
                    strokeLinecap="round"
                    className="text-primary transition-all duration-100"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-semibold">{Math.round(progress)}%</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center animate-pulse">
                Verifying your request...
              </p>
            </div>
          )}

          {step === 'verified' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center animate-scale-in">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Ready to download: <span className="font-medium text-foreground">{fileName}</span>
              </p>
              <Button onClick={handleDownload} className="w-full anime-button gap-2">
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
