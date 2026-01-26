import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  Gauge, 
  Wifi, 
  WifiOff, 
  Signal, 
  SignalLow, 
  SignalMedium, 
  SignalHigh,
  ChevronUp,
  ChevronDown,
  Zap,
  Activity
} from 'lucide-react';
import { getStoredNetworkSpeed } from '@/hooks/useNetworkSpeed';

interface QualityLevel {
  id: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
}

interface QualityOverlayProps {
  currentBitrate: number;
  estimatedBandwidth: number;
  qualityLevels: QualityLevel[];
  currentQualityLevel: number;
  isAutoQuality: boolean;
  onQualityChange: (levelId: number) => void;
  isVisible?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function QualityOverlay({
  currentBitrate,
  estimatedBandwidth,
  qualityLevels,
  currentQualityLevel,
  isAutoQuality,
  onQualityChange,
  isVisible = true,
  position = 'top-right',
}: QualityOverlayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [networkSpeed, setNetworkSpeed] = useState<ReturnType<typeof getStoredNetworkSpeed>>(null);

  useEffect(() => {
    // Get stored network speed
    const speed = getStoredNetworkSpeed();
    setNetworkSpeed(speed);
  }, []);

  const formatBitrate = (bitrate: number): string => {
    if (bitrate >= 1000000) {
      return `${(bitrate / 1000000).toFixed(1)} Mbps`;
    }
    return `${Math.round(bitrate / 1000)} Kbps`;
  };

  const formatBandwidth = (bandwidth: number): string => {
    if (bandwidth >= 1000000) {
      return `${(bandwidth / 1000000).toFixed(1)} Mbps`;
    }
    return `${Math.round(bandwidth / 1000)} Kbps`;
  };

  const getQualityIcon = () => {
    if (!currentBitrate) return <SignalLow className="h-3 w-3" />;
    
    const currentLevel = qualityLevels.find(l => l.id === currentQualityLevel);
    const height = currentLevel?.height || 0;
    
    if (height >= 1080) return <SignalHigh className="h-3 w-3 text-green-400" />;
    if (height >= 720) return <SignalMedium className="h-3 w-3 text-primary" />;
    if (height >= 480) return <SignalLow className="h-3 w-3 text-yellow-400" />;
    return <SignalLow className="h-3 w-3 text-red-400" />;
  };

  const getCurrentQualityLabel = (): string => {
    if (isAutoQuality) {
      const currentLevel = qualityLevels.find(l => l.bitrate === currentBitrate);
      if (currentLevel) {
        return `Auto (${currentLevel.height}p)`;
      }
      return 'Auto';
    }
    const level = qualityLevels.find(l => l.id === currentQualityLevel);
    return level ? `${level.height}p` : 'Unknown';
  };

  const positionClasses = {
    'top-left': 'top-3 left-3',
    'top-right': 'top-3 right-3',
    'bottom-left': 'bottom-20 left-3',
    'bottom-right': 'bottom-20 right-3',
  };

  if (!isVisible || qualityLevels.length === 0) return null;

  return (
    <div 
      className={cn(
        'absolute z-30 transition-all duration-300',
        positionClasses[position]
      )}
    >
      {/* Compact indicator */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg',
          'bg-black/70 backdrop-blur-md border border-white/10',
          'text-white text-xs font-medium',
          'hover:bg-black/80 transition-all duration-200',
          'shadow-lg'
        )}
      >
        {getQualityIcon()}
        <span>{getCurrentQualityLabel()}</span>
        {currentBitrate > 0 && (
          <>
            <span className="text-white/50">•</span>
            <span className="text-white/70">{formatBitrate(currentBitrate)}</span>
          </>
        )}
        {isExpanded ? (
          <ChevronUp className="h-3 w-3 text-white/50" />
        ) : (
          <ChevronDown className="h-3 w-3 text-white/50" />
        )}
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div className={cn(
          'mt-2 rounded-xl overflow-hidden',
          'bg-black/90 backdrop-blur-xl border border-white/10',
          'shadow-2xl min-w-[200px]'
        )}>
          {/* Network stats header */}
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-xs text-white/70 mb-2">
              <Activity className="h-3 w-3" />
              <span>Network Stats</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/50">Bandwidth:</span>
                <span className="text-white font-medium">
                  {estimatedBandwidth > 0 ? formatBandwidth(estimatedBandwidth) : '---'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50">Bitrate:</span>
                <span className="text-white font-medium">
                  {currentBitrate > 0 ? formatBitrate(currentBitrate) : '---'}
                </span>
              </div>
              {networkSpeed && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Speed:</span>
                    <span className="text-white font-medium">{networkSpeed.downloadSpeed} Mbps</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Type:</span>
                    <span className="text-white font-medium capitalize">
                      {networkSpeed.isCellular ? '📶 Cellular' : '📡 WiFi'}
                    </span>
                  </div>
                </>
              )}
            </div>
            {networkSpeed && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <Zap className="h-3 w-3 text-primary" />
                <span className="text-white/70">Recommended:</span>
                <span className="text-primary font-semibold">{networkSpeed.recommendedQuality}</span>
              </div>
            )}
          </div>

          {/* Quality levels */}
          <div className="p-2">
            <div className="text-xs text-white/50 px-2 py-1 mb-1">Quality</div>
            
            {/* Auto option */}
            <button
              onClick={() => onQualityChange(-1)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg',
                'text-sm transition-colors',
                isAutoQuality
                  ? 'bg-primary/20 text-primary'
                  : 'text-white/80 hover:bg-white/10'
              )}
            >
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                <span>Auto</span>
              </div>
              {isAutoQuality && (
                <span className="text-xs bg-primary/30 px-2 py-0.5 rounded">
                  Active
                </span>
              )}
            </button>

            {/* Quality levels sorted by resolution */}
            {[...qualityLevels]
              .sort((a, b) => b.height - a.height)
              .map((level) => {
                const isActive = !isAutoQuality && currentQualityLevel === level.id;
                const isRecommended = networkSpeed?.recommendedQuality === `${level.height}p`;
                
                return (
                  <button
                    key={level.id}
                    onClick={() => onQualityChange(level.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg',
                      'text-sm transition-colors',
                      isActive
                        ? 'bg-primary/20 text-primary'
                        : 'text-white/80 hover:bg-white/10'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {level.height >= 1080 && (
                        <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                          HD
                        </span>
                      )}
                      {level.height >= 2160 && (
                        <span className="text-[10px] font-bold bg-gradient-to-r from-violet-500 to-purple-500 text-white px-1.5 py-0.5 rounded">
                          4K
                        </span>
                      )}
                      <span>{level.height}p</span>
                      <span className="text-white/40 text-xs">
                        {formatBitrate(level.bitrate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isRecommended && !isActive && (
                        <span className="text-[10px] text-green-400">Recommended</span>
                      )}
                      {isActive && (
                        <span className="text-xs bg-primary/30 px-2 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
