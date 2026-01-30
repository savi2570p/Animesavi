import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Smartphone, Monitor, Tablet, Film, Info, Zap, Radio } from 'lucide-react';

interface VideoFormatIndicatorProps {
  servedFormat: 'original' | 'ios_ready' | 'hls';
  device: string;
  conversionStatus?: string;
  isHLS?: boolean;
  currentQuality?: string;
  className?: string;
}

export function VideoFormatIndicator({
  servedFormat,
  device,
  conversionStatus = 'none',
  isHLS = false,
  currentQuality = 'Auto',
  className = '',
}: VideoFormatIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getDeviceIcon = () => {
    switch (device) {
      case 'ios':
        return <Smartphone className="h-3 w-3" />;
      case 'android':
        return <Tablet className="h-3 w-3" />;
      case 'windows':
      case 'mac':
        return <Monitor className="h-3 w-3" />;
      default:
        return <Film className="h-3 w-3" />;
    }
  };

  const getFormatLabel = () => {
    if (isHLS) return 'HLS Adaptive';
    if (servedFormat === 'ios_ready') return 'iOS Optimized';
    return 'Original';
  };

  const getFormatColor = () => {
    if (isHLS) return 'bg-purple-500/80 hover:bg-purple-500';
    if (servedFormat === 'ios_ready') return 'bg-blue-500/80 hover:bg-blue-500';
    return 'bg-green-500/80 hover:bg-green-500';
  };

  const getStatusInfo = () => {
    switch (conversionStatus) {
      case 'pending':
        return { label: 'Conversion Pending', color: 'text-yellow-400' };
      case 'processing':
        return { label: 'Converting...', color: 'text-blue-400' };
      case 'completed':
        return { label: 'Optimized', color: 'text-green-400' };
      case 'failed':
        return { label: 'Conversion Failed', color: 'text-red-400' };
      default:
        return { label: 'Standard', color: 'text-muted-foreground' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${getFormatColor()} text-white border-0 cursor-pointer flex items-center gap-1 px-2 py-0.5 text-xs font-medium ${className}`}
            onClick={() => setShowDetails(!showDetails)}
          >
            {getDeviceIcon()}
            <span>{getFormatLabel()}</span>
            {isHLS && <Zap className="h-2.5 w-2.5" />}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px]">
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Device:</span>
              <span className="capitalize font-medium">{device}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Format:</span>
              <span className="font-medium">{getFormatLabel()}</span>
            </div>
            {isHLS && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Quality:</span>
                <span className="font-medium">{currentQuality}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className={statusInfo.color}>{statusInfo.label}</span>
            </div>
            {device === 'ios' && servedFormat === 'original' && conversionStatus === 'pending' && (
              <p className="text-yellow-400 text-[10px] pt-1 border-t border-border/50">
                ⚠️ iOS optimized version is being prepared
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
