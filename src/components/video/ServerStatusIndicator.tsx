import { useState } from 'react';
import { ServerType, SERVER_CONFIGS } from '@/hooks/useServerAutoSelect';
import { Wifi, WifiOff, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ServerStatusIndicatorProps {
  activeServer: ServerType;
  failedServers: Set<ServerType>;
  isServerLoading: boolean;
  fallbackOccurred: boolean;
  fallbackFrom?: ServerType | null;
  onFailedServerClick?: (server: ServerType) => void;
}

export function ServerStatusIndicator({
  activeServer,
  failedServers,
  isServerLoading,
  fallbackOccurred,
  fallbackFrom,
  onFailedServerClick,
}: ServerStatusIndicatorProps) {
  const config = SERVER_CONFIGS[activeServer];
  const hasFailed = failedServers.size > 0;
  const [maintenanceServer, setMaintenanceServer] = useState<string | null>(null);

  const handleFailedClick = (server: ServerType) => {
    setMaintenanceServer(SERVER_CONFIGS[server]?.name || server);
  };

  return (
    <>
      <div className="flex items-center gap-1 text-sm">
        {/* Active server badge */}
        <Badge
          variant="outline"
          className={cn(
            'gap-0.5 px-1 py-0 text-[7px] md:text-[9px] font-medium transition-all duration-300',
            isServerLoading
              ? 'border-yellow-500/40 text-yellow-400 animate-pulse'
              : fallbackOccurred
                ? 'border-orange-500/40 text-orange-400'
                : 'border-green-500/40 text-green-400'
          )}
        >
          {isServerLoading ? (
            <Wifi className="h-1 w-1 md:h-1.5 md:w-1.5 animate-pulse" />
          ) : fallbackOccurred ? (
            <ArrowRightLeft className="h-1 w-1 md:h-1.5 md:w-1.5" />
          ) : (
            <CheckCircle2 className="h-1 w-1 md:h-1.5 md:w-1.5" />
          )}
          {config.name}
          {isServerLoading && ' …'}
        </Badge>

        {/* Failed servers - clickable, no auto popup */}
        {hasFailed && !isServerLoading && (
          <div className="flex items-center gap-0.5">
            {Array.from(failedServers).map((server) => (
              <Badge
                key={server}
                variant="outline"
                className="gap-0.5 px-0.5 py-0 text-[6px] md:text-[8px] border-red-500/25 text-red-400/60 cursor-pointer hover:border-red-500/50 transition-colors"
                onClick={(e) => { e.stopPropagation(); handleFailedClick(server); }}
              >
                <WifiOff className="h-1 w-1 md:h-1.5 md:w-1.5" />
                {SERVER_CONFIGS[server]?.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Server maintenance dialog */}
      <AlertDialog open={!!maintenanceServer} onOpenChange={() => setMaintenanceServer(null)}>
        <AlertDialogContent className="bg-black/95 border-white/10 max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-sm">Server Under Maintenance</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60 text-xs">
              {maintenanceServer} is currently under maintenance. Please try another server or come back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/90 text-white text-xs px-4 py-1.5"
              onClick={() => setMaintenanceServer(null)}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
