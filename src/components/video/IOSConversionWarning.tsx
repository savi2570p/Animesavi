import { AlertTriangle, Loader2, X, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { isIOSDevice } from '@/lib/deviceUtils';

interface IOSConversionWarningProps {
  conversionStatus: string;
  servedFormat: 'original' | 'ios_ready' | 'hls';
  onDismiss?: () => void;
}

/**
 * Prominent banner notification for iOS users when video is not yet converted.
 * Warns about potential playback issues with MKV/HEVC formats.
 */
export function IOSConversionWarning({
  conversionStatus,
  servedFormat,
  onDismiss,
}: IOSConversionWarningProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Only show on iOS devices
  if (!isIOSDevice()) return null;

  // Don't show if video is already converted
  if (servedFormat === 'ios_ready' || servedFormat === 'hls') return null;

  // Don't show if dismissed
  if (isDismissed) return null;

  // Don't show if status is completed or skipped
  if (conversionStatus === 'completed' || conversionStatus === 'skipped') return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const isProcessing = conversionStatus === 'processing';
  const isPending = conversionStatus === 'pending';
  const isFailed = conversionStatus === 'failed';

  return (
    <div className="w-full bg-gradient-to-r from-orange-600/95 via-amber-500/95 to-yellow-500/95 text-primary-foreground px-4 py-3 relative">
      <div className="container flex items-start sm:items-center gap-3">
        <div className="shrink-0 mt-0.5 sm:mt-0">
          {isProcessing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Smartphone className="h-4 w-4" />
            <span className="font-semibold text-sm">iOS Playback Notice</span>
          </div>
          
          <p className="text-sm text-white/90 leading-snug">
            {isProcessing && (
              <>
                This video is currently being converted for iOS. 
                Playback may be limited until conversion completes.
              </>
            )}
            {isPending && (
              <>
                This video format may not play smoothly on your iOS device. 
                An optimized version is queued for conversion.
              </>
            )}
            {isFailed && (
              <>
                Video conversion failed. Playback may not work on your iOS device. 
                Please try another server or report this issue.
              </>
            )}
            {!isProcessing && !isPending && !isFailed && (
              <>
                This video format may not be fully compatible with iOS. 
                If playback issues occur, try switching to another server.
              </>
            )}
          </p>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-8 w-8 text-white hover:text-white hover:bg-white/20 rounded-full"
          onClick={handleDismiss}
          aria-label="Dismiss warning"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
