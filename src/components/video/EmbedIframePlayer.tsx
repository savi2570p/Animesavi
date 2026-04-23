import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, Pause, Play, RefreshCw, Timer, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  buildEmbedIframeUrl,
  getEmbedUrlMeta,
  isEmbedMessage,
  normalizeEmbedErrorReason,
  postEmbedMessage,
  type EmbedRemotePlaybackState,
} from '@/lib/embedMessaging';

interface EmbedIframePlayerProps {
  url: string;
  title: string;
  className?: string;
  containerClassName?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlaybackStateChange?: (state: Partial<EmbedRemotePlaybackState>) => void;
  onReady?: () => void;
  onError?: (details: { url: string; reason: string; browserReason?: string }) => void;
  onRequestNativeFullscreen?: () => void;
}

const HANDSHAKE_TIMEOUT_MS = 6500;

export function EmbedIframePlayer({
  url,
  title,
  className,
  containerClassName,
  onTimeUpdate,
  onPlaybackStateChange,
  onReady,
  onError,
  onRequestNativeFullscreen,
}: EmbedIframePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const handshakeTimerRef = useRef<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const [handshakeState, setHandshakeState] = useState<'loading' | 'ready' | 'timeout'>('loading');
  const [remoteState, setRemoteState] = useState<EmbedRemotePlaybackState>({
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isMuted: true,
    isFullscreen: false,
  });
  const [friendlyError, setFriendlyError] = useState<{ reason: string; browserReason?: string } | null>(null);

  const instanceId = useMemo(() => `embed-${Math.random().toString(36).slice(2, 10)}`, []);
  const iframeUrl = useMemo(
    () => buildEmbedIframeUrl(url, { autoplay: 1, parentOrigin: window.location.origin, embedInstanceId: instanceId }),
    [instanceId, url, reloadToken],
  );
  const iframeMeta = useMemo(() => getEmbedUrlMeta(iframeUrl), [iframeUrl]);

  const reportError = (reason: string, browserReason?: string) => {
    const payload = { reason, browserReason };
    console.error('[EmbedIframePlayer] iframe failure', {
      iframeUrl: iframeMeta.href,
      iframeOrigin: iframeMeta.origin,
      reason,
      browserReason,
      title,
      userAgent: navigator.userAgent,
    });
    setFriendlyError(payload);
    onError?.({ url: iframeMeta.href, reason, browserReason });
  };

  useEffect(() => {
    setIsIframeLoaded(false);
    setHandshakeState('loading');
    setFriendlyError(null);

    if (handshakeTimerRef.current) {
      window.clearTimeout(handshakeTimerRef.current);
    }

    handshakeTimerRef.current = window.setTimeout(() => {
      setHandshakeState(current => {
        if (current === 'ready') return current;
        reportError(
          'The embedded player did not respond in time.',
          'No postMessage handshake acknowledgement received from iframe.',
        );
        return 'timeout';
      });
    }, HANDSHAKE_TIMEOUT_MS);

    return () => {
      if (handshakeTimerRef.current) {
        window.clearTimeout(handshakeTimerRef.current);
        handshakeTimerRef.current = null;
      }
    };
  }, [iframeMeta.href]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isEmbedMessage(event.data)) return;
      if (event.data.instanceId && event.data.instanceId !== instanceId) return;

      const fromExpectedOrigin = iframeMeta.origin === '*' || event.origin === iframeMeta.origin;
      if (!fromExpectedOrigin) return;

      switch (event.data.type) {
        case 'handshake-ack': {
          if (handshakeTimerRef.current) {
            window.clearTimeout(handshakeTimerRef.current);
            handshakeTimerRef.current = null;
          }

          setHandshakeState('ready');
          setFriendlyError(null);
          onReady?.();
          postEmbedMessage(iframeRef.current?.contentWindow ?? null, 'request-state', {}, { instanceId, targetOrigin: iframeMeta.origin });
          break;
        }
        case 'state-update': {
          const nextState: EmbedRemotePlaybackState = {
            currentTime: Number(event.data.payload?.currentTime ?? 0),
            duration: Number(event.data.payload?.duration ?? 0),
            isPlaying: Boolean(event.data.payload?.isPlaying),
            isMuted: Boolean(event.data.payload?.isMuted),
            isFullscreen: Boolean(event.data.payload?.isFullscreen),
            readyState: Number(event.data.payload?.readyState ?? 0),
          };

          setRemoteState(nextState);
          onPlaybackStateChange?.(nextState);
          onTimeUpdate?.(nextState.currentTime, nextState.duration);
          break;
        }
        case 'error': {
          reportError(
            normalizeEmbedErrorReason(event.data.payload?.reason),
            typeof event.data.payload?.browserReason === 'string' ? event.data.payload.browserReason : undefined,
          );
          break;
        }
        case 'pong':
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [iframeMeta.origin, instanceId, onPlaybackStateChange, onReady, onTimeUpdate]);

  const sendCommand = (type: Parameters<typeof postEmbedMessage>[1], payload: Record<string, unknown> = {}) => {
    postEmbedMessage(iframeRef.current?.contentWindow ?? null, type, payload, {
      instanceId,
      targetOrigin: iframeMeta.origin,
    });
  };

  const handleIframeLoad = () => {
    setIsIframeLoaded(true);
    sendCommand('handshake-request', { title });
  };

  return (
    <div className={containerClassName}>
      <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs text-foreground backdrop-blur-sm">
          {handshakeState === 'ready' ? (
            <>
              <span className="h-2 w-2 rounded-full bg-primary" />
              Remote controls connected
            </>
          ) : handshakeState === 'timeout' ? (
            <>
              <WifiOff className="h-3.5 w-3.5" />
              Embed not responding
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Connecting player…
            </>
          )}
        </div>

        {handshakeState === 'ready' && (
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs text-foreground backdrop-blur-sm">
            <Timer className="h-3.5 w-3.5" />
            {Math.floor(remoteState.currentTime)}s / {Math.floor(remoteState.duration || 0)}s
          </div>
        )}
      </div>

      <iframe
        key={iframeUrl}
        ref={iframeRef}
        src={iframeUrl}
        className={className}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        title={title}
        style={{ border: 'none' }}
        onLoad={handleIframeLoad}
      />

      {handshakeState === 'ready' && (
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-full border border-border/80 bg-background/80 p-1.5 backdrop-blur-sm">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full"
            onClick={() => sendCommand(remoteState.isPlaying ? 'pause' : 'play')}
          >
            {remoteState.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full"
            onClick={() => sendCommand('fullscreen')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      )}

      {(friendlyError || handshakeState === 'timeout') && (
        <div className="absolute inset-x-4 bottom-4 z-30">
          <Alert variant="destructive" className="border-destructive/60 bg-background/95 backdrop-blur-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Embed player needs attention</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{friendlyError?.reason ?? 'The embedded player could not be controlled from this page.'}</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p><strong className="text-foreground">Iframe URL:</strong> {iframeMeta.href}</p>
                {friendlyError?.browserReason && (
                  <p><strong className="text-foreground">Browser reason:</strong> {friendlyError.browserReason}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setReloadToken(value => value + 1)}>
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => window.open(iframeMeta.href, '_blank', 'noopener,noreferrer')}>
                  <ExternalLink className="h-4 w-4" /> Open player directly
                </Button>
                {onRequestNativeFullscreen && (
                  <Button type="button" size="sm" onClick={onRequestNativeFullscreen}>
                    Fullscreen
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {!isIframeLoaded && handshakeState === 'loading' && (
        <div className="absolute inset-0 z-10 bg-black/20" aria-hidden="true" />
      )}
    </div>
  );
}