import { ServerType, SERVER_CONFIGS } from '@/hooks/useServerAutoSelect';
import { Wifi, WifiOff, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ServerStatusIndicatorProps {
  activeServer: ServerType;
  failedServers: Set<ServerType>;
  isServerLoading: boolean;
  fallbackOccurred: boolean;
  fallbackFrom?: ServerType | null;
}

export function ServerStatusIndicator({
  activeServer,
  failedServers,
  isServerLoading,
  fallbackOccurred,
  fallbackFrom,
}: ServerStatusIndicatorProps) {
  const config = SERVER_CONFIGS[activeServer];
  const hasFailed = failedServers.size > 0;

  return (
    <div className="flex items-center gap-2 text-sm">
      {/* Active server badge */}
      <Badge
        variant="outline"
        className={cn(
          'gap-1 px-2 py-0.5 text-xs font-medium transition-all',
          isServerLoading
            ? 'border-yellow-500/50 text-yellow-400 animate-pulse'
            : fallbackOccurred
              ? 'border-orange-500/50 text-orange-400'
              : 'border-green-500/50 text-green-400'
        )}
      >
        {isServerLoading ? (
          <Wifi className="h-3 w-3 animate-pulse" />
        ) : fallbackOccurred ? (
          <ArrowRightLeft className="h-3 w-3" />
        ) : (
          <CheckCircle2 className="h-3 w-3" />
        )}
        {config.name}
        {isServerLoading && ' …'}
      </Badge>

      {/* Fallback info */}
      {fallbackOccurred && fallbackFrom && !isServerLoading && (
        <span className="text-xs text-orange-400/80">
          ← {SERVER_CONFIGS[fallbackFrom]?.name || fallbackFrom} timed out
        </span>
      )}

      {/* Failed servers */}
      {hasFailed && !isServerLoading && (
        <div className="flex items-center gap-1">
          {Array.from(failedServers).map((server) => (
            <Badge
              key={server}
              variant="outline"
              className="gap-1 px-1.5 py-0.5 text-[10px] border-red-500/30 text-red-400/70"
            >
              <WifiOff className="h-2.5 w-2.5" />
              {SERVER_CONFIGS[server]?.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
