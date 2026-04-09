import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Wifi, Monitor, Tv, Loader2, Cast, CheckCircle2, AlertCircle, Airplay } from 'lucide-react';
import { toast } from 'sonner';

interface ScreenMirroringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type MirrorStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

export function ScreenMirroringDialog({ open, onOpenChange }: ScreenMirroringDialogProps) {
  const [status, setStatus] = useState<MirrorStatus>('idle');

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent);

  useEffect(() => {
    if (open) {
      setStatus('idle');
    }
  }, [open]);

  const handleMirror = useCallback(async () => {
    // Try Presentation API first (Chrome / Edge)
    if ('presentation' in navigator && (navigator as any).presentation) {
      try {
        setStatus('scanning');
        const request = new (window as any).PresentationRequest([window.location.href]);
        const connection = await request.start();
        setStatus('connected');
        toast.success('Casting mode enabled — video will play natively on your TV');
        
        connection.addEventListener('close', () => {
          setStatus('idle');
          toast.info('Screen mirroring ended');
        });
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.message?.includes('cancelled')) {
          setStatus('idle');
        } else {
          setStatus('error');
        }
      }
      return;
    }

    // For iOS: Guide to use AirPlay
    if (isIOS) {
      setStatus('connected');
      toast.success('Use the AirPlay icon in Control Center to mirror to your TV');
      // Try to trigger AirPlay picker on the video element
      const video = document.querySelector('video');
      if (video && (video as any).webkitShowPlaybackTargetPicker) {
        (video as any).webkitShowPlaybackTargetPicker();
      }
      return;
    }

    // For Android: Try Remote Playback API
    if (isAndroid) {
      const video = document.querySelector('video');
      if (video && (video as any).remote) {
        try {
          setStatus('scanning');
          await (video as any).remote.prompt();
          setStatus('connected');
          toast.success('Casting mode enabled');
        } catch {
          setStatus('error');
        }
        return;
      }
    }

    // Fallback: Chrome Cast API
    if ((window as any).chrome?.cast) {
      toast.info('Use the Cast icon in your browser toolbar to select a device');
      setStatus('idle');
    } else {
      setStatus('error');
    }
  }, [isIOS, isAndroid]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cast className="h-5 w-5 text-primary" />
            Screen Mirroring
          </DialogTitle>
          <DialogDescription>
            Cast this video to your TV or another display
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Wi-Fi notice */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Wifi className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              Make sure both your device and TV are connected to the <strong>same Wi-Fi network</strong> for mirroring to work.
            </p>
          </div>

          {/* Smart casting info */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            <div className="text-sm text-foreground">
              <strong>Smart Casting:</strong> When casting is detected, the player automatically switches to native mode — no overlays, no restrictions, just smooth playback on your TV.
            </div>
          </div>

          {status === 'idle' && (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Monitor className="h-10 w-10 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Your Device</span>
                </div>
                <div className="flex items-center">
                  <div className="w-12 border-t-2 border-dashed border-muted-foreground/50" />
                  <Cast className="h-5 w-5 text-muted-foreground mx-1" />
                  <div className="w-12 border-t-2 border-dashed border-muted-foreground/50" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Tv className="h-10 w-10 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">TV / Display</span>
                </div>
              </div>

              <div className="space-y-2">
                <Button onClick={handleMirror} className="w-full gap-2">
                  <Cast className="h-4 w-4" />
                  {isIOS ? 'Start AirPlay' : isAndroid ? 'Cast to TV' : 'Mirror Screen'}
                </Button>
                {isIOS && (
                  <p className="text-xs text-muted-foreground">
                    You can also swipe down from top-right and tap the AirPlay / Screen Mirroring icon.
                  </p>
                )}
              </div>
            </div>
          )}

          {status === 'scanning' && (
            <div className="text-center space-y-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Searching for available devices...</p>
            </div>
          )}

          {status === 'connected' && (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
              <p className="text-sm font-medium text-foreground">Casting mode enabled!</p>
              <p className="text-xs text-muted-foreground">
                Video is playing in native mode for smooth TV playback. All overlays and restrictions are disabled.
              </p>
              <Button variant="outline" onClick={() => { setStatus('idle'); onOpenChange(false); }}>
                Done
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-3 py-4">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No devices found</p>
                <p className="text-xs text-muted-foreground">
                  Make sure your TV supports screen mirroring (Chromecast, AirPlay, Miracast) and both devices are on the same Wi-Fi.
                </p>
              </div>
              <Button variant="outline" onClick={handleMirror} className="gap-2">
                <Cast className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
