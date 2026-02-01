import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Smartphone, Monitor, Tablet, Film, Zap, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface VideoFormatIndicatorProps {
  servedFormat: 'original' | 'ios_ready' | 'hls';
  device: string;
  conversionStatus?: string;
  isHLS?: boolean;
  currentQuality?: string;
  className?: string;
  compact?: boolean;
}

export function VideoFormatIndicator({
  servedFormat,
  device,
  conversionStatus = 'none',
  isHLS = false,
  currentQuality = 'Auto',
  className = '',
  compact = false,
}: VideoFormatIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getDeviceIcon = () => {
    switch (device) {
      case 'ios':
        return <Smartphone className="h-3.5 w-3.5" />;
      case 'android':
        return <Tablet className="h-3.5 w-3.5" />;
      case 'windows':
      case 'mac':
        return <Monitor className="h-3.5 w-3.5" />;
      default:
        return <Film className="h-3.5 w-3.5" />;
    }
  };

  // Platform-based confirmation labels
  const getFormatLabel = () => {
    if (device === 'ios') {
      if (servedFormat === 'ios_ready' || isHLS) {
        return 'Converted for iOS';
      }
      if (conversionStatus === 'pending' || conversionStatus === 'processing') {
        return 'Converting...';
      }
      return 'iOS Pending';
    }
    // Android / Windows / Desktop
    return 'Original';
  };

  const getFormatColor = () => {
    if (device === 'ios') {
      if (servedFormat === 'ios_ready' || isHLS) {
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      }
      if (conversionStatus === 'processing') {
        return 'bg-amber-500 hover:bg-amber-600 text-white';
      }
      return 'bg-orange-500/80 hover:bg-orange-500 text-white';
    }
    // Android / Windows - Original format (green = good)
    return 'bg-green-500 hover:bg-green-600 text-white';
  };

  const getStatusIcon = () => {
    if (device === 'ios') {
      if (servedFormat === 'ios_ready' || isHLS) {
        return <CheckCircle className="h-3 w-3" />;
      }
      if (conversionStatus === 'processing') {
        return <Loader2 className="h-3 w-3 animate-spin" />;
      }
      if (conversionStatus === 'pending') {
        return <AlertTriangle className="h-3 w-3" />;
      }
    }
    if (isHLS) {
      return <Zap className="h-3 w-3" />;
    }
    return null;
  };

  const getStatusInfo = () => {
    switch (conversionStatus) {
      case 'pending':
        return { label: 'Conversion Pending', color: 'text-amber-400' };
      case 'processing':
        return { label: 'Converting to iOS format...', color: 'text-blue-400' };
      case 'completed':
        return { label: 'Successfully Converted', color: 'text-green-400' };
      case 'failed':
        return { label: 'Conversion Failed', color: 'text-red-400' };
      default:
        return { label: 'Standard', color: 'text-muted-foreground' };
    }
  };

  const getDeviceExplanation = () => {
    if (device === 'ios') {
      if (servedFormat === 'ios_ready' || isHLS) {
        return 'This video was automatically converted from MKV to iOS-compatible MP4 format for smooth playback on your device.';
      }
      return 'This video is being prepared for iOS. Conversion is in progress.';
    }
    return 'You are viewing the original high-quality video file. No conversion needed for your device.';
  };

  const statusInfo = getStatusInfo();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${getFormatColor()} border-0 cursor-pointer flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold shadow-sm transition-all duration-200 ${className}`}
            onClick={() => setShowDetails(!showDetails)}
          >
            {getDeviceIcon()}
            <span>{getFormatLabel()}</span>
            {getStatusIcon()}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px] p-3">
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-border/50">
              {getDeviceIcon()}
              <span className="font-semibold capitalize">{device} Device Detected</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Format Served:</span>
                <span className="font-semibold">{getFormatLabel()}</span>
              </div>
              
              {isHLS && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Stream Type:</span>
                  <span className="font-medium flex items-center gap-1">
                    <Zap className="h-3 w-3 text-purple-400" />
                    HLS Adaptive
                  </span>
                </div>
              )}
              
              {isHLS && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Quality:</span>
                  <span className="font-medium">{currentQuality}</span>
                </div>
              )}
              
              {device === 'ios' && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={statusInfo.color}>{statusInfo.label}</span>
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground pt-2 border-t border-border/50 leading-relaxed">
              {getDeviceExplanation()}
            </p>

            {device === 'ios' && servedFormat === 'original' && conversionStatus === 'pending' && (
              <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-amber-300">
                  iOS-optimized version is being prepared. Playback may be limited until conversion completes.
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
