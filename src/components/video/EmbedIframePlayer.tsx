import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bug, CheckCircle2, ExternalLink, Pause, Play, RefreshCw, Timer, WifiOff } from 'lucide-react';

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
  onError?: (details: {
    url: string;
    reason: string;
    browserReason?: string;
    debug?: {
      iframeUrl: string;
      iframeOrigin: string;
      allow: string;
      sandbox: string;
      recentEvents: Array<{ direction: string; type: string; origin: string; note?: string; timestamp: number }>;
    };
  }) => void;
  onRequestNativeFullscreen?: () => void;
  fallbackMessage?: string;
}

const HANDSHAKE_TIMEOUT_MS = 6500;
const TEST_TIMEOUT_MS = 3000;
const RECENT_EVENTS_LIMIT = 14;
const IFRAME_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';

// Origins for embeds that we control and that speak our postMessage protocol.
// Anything else is treated as a third-party embed where we don't require a handshake.
const TRUSTED_BRIDGE_HOSTS = [
  'animesavi.lovable.app',
  'crunchysavi.lovable.app',
  'shadow-arise.lovable.app',
  'id-preview--33d3090e-95de-4730-92ea-a67c07f853e0.lovable.app',
  '33d3090e-95de-4730-92ea-a67c07f853e0.lovableproject.com',
];

function isTrustedBridgeOrigin(origin: string, hostname: string) {
  if (!origin || origin === '*') return false;
  if (origin === window.location.origin) return true;
  return TRUSTED_BRIDGE_HOSTS.some((host) => hostname === host || hostname.endsWith('.' + host));
}

type HandshakeState = 'loading' | 'ready' | 'limited' | 'failed';
type EmbedEventDirection = 'incoming' | 'outgoing' | 'system';

interface EmbedDebugEvent {
  id: number;
  direction: EmbedEventDirection;
  type: string;
  origin: string;
  note?: string;
  timestamp: number;
}

interface EmbedTestResult {
  id: 'load' | 'handshake' | 'autoplay' | 'fullscreen';
  label: string;
  status: 'pass' | 'fail';
  detail: string;
}

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
  fallbackMessage,
}: EmbedIframePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const handshakeTimerRef = useRef<number | null>(null);
  const eventIdRef = useRef(0);
  const iframeLoadedRef = useRef(false);
  const handshakeStateRef = useRef<HandshakeState>('loading');
  const remoteStateRef = useRef<EmbedRemotePlaybackState>({
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isMuted: true,
    isFullscreen: false,
  });
  const recentEventsRef = useRef<EmbedDebugEvent[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const [handshakeState, setHandshakeState] = useState<HandshakeState>('loading');
  const [remoteState, setRemoteState] = useState<EmbedRemotePlaybackState>({
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isMuted: true,
    isFullscreen: false,
  });
  const [friendlyError, setFriendlyError] = useState<{ reason: string; browserReason?: string } | null>(null);
  const [recentEvents, setRecentEvents] = useState<EmbedDebugEvent[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<EmbedTestResult[]>([]);

  const instanceId = useMemo(() => `embed-${Math.random().toString(36).slice(2, 10)}`, []);
  const iframeUrl = useMemo(
    () => buildEmbedIframeUrl(url, {
      autoplay: 1,
      parentOrigin: window.location.origin,
      embedInstanceId: instanceId,
      embedReloadToken: reloadToken,
    }),
    [instanceId, reloadToken, url],
  );
  const iframeMeta = useMemo(() => getEmbedUrlMeta(iframeUrl), [iframeUrl]);
  const isTrustedBridge = useMemo(
    () => isTrustedBridgeOrigin(iframeMeta.origin, iframeMeta.host),
    [iframeMeta.host, iframeMeta.origin],
  );
  const deviceLabel = useMemo(() => {
    if (typeof window === 'undefined') return 'Unknown';
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    return 'Desktop';
  }, []);

  useEffect(() => {
    iframeLoadedRef.current = isIframeLoaded;
  }, [isIframeLoaded]);

  useEffect(() => {
    handshakeStateRef.current = handshakeState;
  }, [handshakeState]);

  useEffect(() => {
    remoteStateRef.current = remoteState;
  }, [remoteState]);

  const pushDebugEvent = useCallback((direction: EmbedEventDirection, type: string, options: { origin?: string; note?: string } = {}) => {
    const nextEvent: EmbedDebugEvent = {
      id: eventIdRef.current += 1,
      direction,
      type,
      origin: options.origin ?? iframeMeta.origin,
      note: options.note,
      timestamp: Date.now(),
    };

    setRecentEvents((current) => {
      const next = [nextEvent, ...current].slice(0, RECENT_EVENTS_LIMIT);
      recentEventsRef.current = next;
      return next;
    });
  }, [iframeMeta.origin]);

  const reportError = useCallback((reason: string, browserReason?: string, isFatal = true) => {
    const payload = { reason, browserReason };
    pushDebugEvent('system', 'error', {
      note: browserReason ? `${reason} — ${browserReason}` : reason,
    });

    console.error('[EmbedIframePlayer] iframe failure', {
      iframeUrl: iframeMeta.href,
      iframeOrigin: iframeMeta.origin,
      allow: IFRAME_ALLOW,
      sandbox: 'removed',
      reason,
      browserReason,
      title,
      userAgent: navigator.userAgent,
      recentEvents: recentEventsRef.current,
    });

    if (!isFatal) return;

    setFriendlyError(payload);
    setDebugOpen(true);
    onError?.({
      url: iframeMeta.href,
      reason,
      browserReason,
      debug: {
        iframeUrl: iframeMeta.href,
        iframeOrigin: iframeMeta.origin,
        allow: IFRAME_ALLOW,
        sandbox: 'removed',
        recentEvents: recentEventsRef.current.map(({ direction, type, origin, note, timestamp }) => ({
          direction,
          type,
          origin,
          note,
          timestamp,
        })),
      },
    });
  }, [iframeMeta.href, iframeMeta.origin, onError, pushDebugEvent, title]);

  const sendCommand = useCallback((type: Parameters<typeof postEmbedMessage>[1], payload: Record<string, unknown> = {}, note?: string) => {
    const contentWindow = iframeRef.current?.contentWindow ?? null;

    if (!contentWindow) {
      pushDebugEvent('system', `${type}-skipped`, {
        note: 'Iframe window is not ready yet.',
      });
      return;
    }

    pushDebugEvent('outgoing', type, {
      origin: iframeMeta.origin,
      note,
    });

    postEmbedMessage(contentWindow, type, payload, {
      instanceId,
      targetOrigin: iframeMeta.origin,
    });
  }, [iframeMeta.origin, instanceId, pushDebugEvent]);

  const waitFor = useCallback((predicate: () => boolean, timeoutMs = TEST_TIMEOUT_MS) => (
    new Promise<boolean>((resolve) => {
      const startedAt = Date.now();

      const check = () => {
        if (predicate()) {
          resolve(true);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          resolve(false);
          return;
        }

        window.setTimeout(check, 150);
      };

      check();
    })
  ), []);

  useEffect(() => {
    setIsIframeLoaded(false);
    setHandshakeState('loading');
    setFriendlyError(null);
    setDebugOpen(false);
    setTestResults([]);
    recentEventsRef.current = [];
    setRecentEvents([]);
    pushDebugEvent('system', 'iframe-init', {
      note: `Preparing ${iframeMeta.href}`,
    });

    if (handshakeTimerRef.current) {
      window.clearTimeout(handshakeTimerRef.current);
    }

    handshakeTimerRef.current = window.setTimeout(() => {
      setHandshakeState((current) => {
        if (current === 'ready') return current;

        if (iframeLoadedRef.current) {
          if (!isTrustedBridge) {
            // Third-party providers (UPNShare, Filemoon, Streamtape, etc.) don't
            // implement our handshake. As long as the iframe loaded, treat it as
            // a working embed instead of surfacing a fake failure to the user.
            pushDebugEvent('system', 'third-party-embed', {
              note: 'Third-party embed loaded successfully without our trusted control bridge.',
            });
            onReady?.();
            return 'limited';
          }

          pushDebugEvent('system', 'handshake-unavailable', {
            note: 'Iframe loaded, but the embedded player does not expose the trusted control bridge.',
          });
          return 'limited';
        }

        reportError(
          'The embedded player did not finish loading.',
          'The iframe load event never fired, so the player could not be initialized.',
        );
        return 'failed';
      });
    }, HANDSHAKE_TIMEOUT_MS);

    return () => {
      if (handshakeTimerRef.current) {
        window.clearTimeout(handshakeTimerRef.current);
        handshakeTimerRef.current = null;
      }
    };
  }, [iframeMeta.href, isTrustedBridge, onReady, pushDebugEvent, reportError]);

  useEffect(() => {
    remoteStateRef.current = remoteState;

    const handleMessage = (event: MessageEvent) => {
      // Validate origin first for any incoming message (security).
      const fromExpectedOriginGlobal = iframeMeta.origin === '*' || event.origin === iframeMeta.origin;
      const fromExpectedSource = !iframeRef.current?.contentWindow || event.source === iframeRef.current.contentWindow;

      // ---- Third-party player API (e.g. UPNShare/RPMShare style) ----
      // These players send plain objects like:
      //   { playerStatus: 'Ready' } | { currentTime: 12.3 } | { duration: 600 }
      // They are NOT wrapped in our namespaced envelope.
      if (fromExpectedOriginGlobal && fromExpectedSource && event.data && typeof event.data === 'object' && !isEmbedMessage(event.data)) {
        const data = event.data as Record<string, unknown>;
        let handledThirdParty = false;

        if (data.playerStatus === 'Ready') {
          handledThirdParty = true;
          pushDebugEvent('incoming', 'third-party:Ready', { origin: event.origin });
          if (handshakeTimerRef.current) {
            window.clearTimeout(handshakeTimerRef.current);
            handshakeTimerRef.current = null;
          }
          setHandshakeState('ready');
          setFriendlyError(null);
          onReady?.();
          // Ask for time/duration on ready.
          try {
            iframeRef.current?.contentWindow?.postMessage({ command: 'getTime' }, iframeMeta.origin);
            iframeRef.current?.contentWindow?.postMessage({ command: 'getDuration' }, iframeMeta.origin);
            pushDebugEvent('outgoing', 'third-party:getTime', { origin: iframeMeta.origin });
          } catch {
            // ignore
          }
        }

        if (typeof data.currentTime === 'number' || typeof data.duration === 'number') {
          handledThirdParty = true;
          const nextCurrent = typeof data.currentTime === 'number' ? data.currentTime : remoteStateRef.current.currentTime;
          const nextDuration = typeof data.duration === 'number' ? data.duration : remoteStateRef.current.duration;
          const nextState: EmbedRemotePlaybackState = {
            ...remoteStateRef.current,
            currentTime: nextCurrent,
            duration: nextDuration,
          };
          remoteStateRef.current = nextState;
          setRemoteState(nextState);
          onPlaybackStateChange?.(nextState);
          onTimeUpdate?.(nextCurrent, nextDuration);
          pushDebugEvent('incoming', 'third-party:time', {
            origin: event.origin,
            note: `t=${nextCurrent.toFixed(2)}s / dur=${nextDuration.toFixed(2)}s`,
          });
        }

        if (handledThirdParty) return;
      }

      if (!isEmbedMessage(event.data)) return;
      if (instanceId && event.data.instanceId !== instanceId) {
        pushDebugEvent('system', 'rejected-instance', {
          origin: event.origin,
          note: `Ignored ${event.data.type} because the instance id did not match.`,
        });
        return;
      }

      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) {
        pushDebugEvent('system', 'rejected-source', {
          origin: event.origin,
          note: `Ignored ${event.data.type} because it came from a different window.`,
        });
        return;
      }

      const fromExpectedOrigin = iframeMeta.origin === '*' || event.origin === iframeMeta.origin;
      if (!fromExpectedOrigin) {
        pushDebugEvent('system', 'rejected-origin', {
          origin: event.origin,
          note: `Ignored ${event.data.type} because ${event.origin} is not the trusted iframe origin.`,
        });
        return;
      }

      pushDebugEvent('incoming', event.data.type, { origin: event.origin });

      switch (event.data.type) {
        case 'handshake-ack': {
          if (handshakeTimerRef.current) {
            window.clearTimeout(handshakeTimerRef.current);
            handshakeTimerRef.current = null;
          }

          setHandshakeState('ready');
          setFriendlyError(null);
          onReady?.();
          sendCommand('request-state', {}, 'Handshake acknowledged; requesting initial playback state.');
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

          remoteStateRef.current = nextState;
          setRemoteState(nextState);
          onPlaybackStateChange?.(nextState);
          onTimeUpdate?.(nextState.currentTime, nextState.duration);
          break;
        }
        case 'error': {
          setHandshakeState('failed');
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
  }, [iframeMeta.origin, instanceId, onPlaybackStateChange, onReady, onTimeUpdate, pushDebugEvent, reportError, sendCommand]);

  const handleIframeLoad = () => {
    setIsIframeLoaded(true);
    pushDebugEvent('system', 'iframe-load', {
      note: 'Iframe load event fired successfully.',
    });

    if (isTrustedBridge) {
      sendCommand('handshake-request', { title }, 'Starting trusted postMessage handshake.');
      sendCommand('ping', { title }, 'Checking whether the embed responds to control probes.');
      return;
    }

    // Third-party embed (UPNShare, Filemoon, etc.) — they handle their own
    // playback, so we just mark the source as working and clear the spinner.
    if (handshakeTimerRef.current) {
      window.clearTimeout(handshakeTimerRef.current);
      handshakeTimerRef.current = null;
    }
    setHandshakeState('limited');
    setFriendlyError(null);
    onReady?.();
  };

  const handleIframeError = () => {
    setHandshakeState('failed');
    reportError(
      'The embedded player could not be opened.',
      'The browser reported an iframe loading error.',
    );
  };

  const runEmbedTest = useCallback(async () => {
    setDebugOpen(true);
    setIsTestRunning(true);
    setTestResults([]);
    pushDebugEvent('system', 'embed-test-start', {
      note: `Running autoplay/fullscreen checks on ${deviceLabel}.`,
    });

    const results: EmbedTestResult[] = [
      {
        id: 'load',
        label: 'Iframe load',
        status: iframeLoadedRef.current ? 'pass' : 'fail',
        detail: iframeLoadedRef.current
          ? 'The iframe fired its load event.'
          : 'The iframe has not finished loading yet.',
      },
    ];

    let handshakePassed = handshakeStateRef.current === 'ready';
    if (!handshakePassed) {
      sendCommand('handshake-request', { title, source: 'embed-test' }, 'Embed Test requested a fresh handshake.');
      handshakePassed = await waitFor(() => handshakeStateRef.current === 'ready', 1800);
    }

    results.push({
      id: 'handshake',
      label: 'Trusted handshake',
      status: handshakePassed ? 'pass' : 'fail',
      detail: handshakePassed
        ? 'The player acknowledged the trusted postMessage handshake.'
        : 'No trusted handshake acknowledgement was received from the embedded player.',
    });

    if (handshakePassed) {
      const initialTime = remoteStateRef.current.currentTime;
      sendCommand('play', { source: 'embed-test' }, 'Embed Test requested autoplay.');
      const autoplayPassed = await waitFor(
        () => remoteStateRef.current.isPlaying || remoteStateRef.current.currentTime > initialTime + 0.35,
        TEST_TIMEOUT_MS,
      );

      results.push({
        id: 'autoplay',
        label: 'Autoplay / play',
        status: autoplayPassed ? 'pass' : 'fail',
        detail: autoplayPassed
          ? 'Playback started and time updates are flowing.'
          : 'Playback did not start after the controlled play command.',
      });

      sendCommand('fullscreen', { source: 'embed-test' }, 'Embed Test requested fullscreen.');
      const fullscreenPassed = await waitFor(
        () => remoteStateRef.current.isFullscreen || Boolean(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement),
        2600,
      );

      results.push({
        id: 'fullscreen',
        label: 'Fullscreen',
        status: fullscreenPassed ? 'pass' : 'fail',
        detail: fullscreenPassed
          ? 'The player entered fullscreen or reported fullscreen state.'
          : 'The embed did not confirm fullscreen during the test window.',
      });

      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if ((document as Document & { webkitExitFullscreen?: () => void }).webkitExitFullscreen) {
          (document as Document & { webkitExitFullscreen?: () => void }).webkitExitFullscreen?.();
        }
      } catch {
        pushDebugEvent('system', 'fullscreen-exit-failed', {
          note: 'The browser stayed in fullscreen after the Embed Test.',
        });
      }
    } else {
      results.push(
        {
          id: 'autoplay',
          label: 'Autoplay / play',
          status: 'fail',
          detail: 'Skipped because the player did not establish the trusted handshake required for remote controls.',
        },
        {
          id: 'fullscreen',
          label: 'Fullscreen',
          status: 'fail',
          detail: 'Skipped because the player did not establish the trusted handshake required for fullscreen checks.',
        },
      );
    }

    setTestResults(results);
    setIsTestRunning(false);
    pushDebugEvent('system', 'embed-test-complete', {
      note: results.map((item) => `${item.label}: ${item.status}`).join(' • '),
    });
  }, [deviceLabel, pushDebugEvent, sendCommand, title, waitFor]);

  const showDebugPanel = debugOpen || Boolean(friendlyError) || testResults.length > 0;

  return (
    <div className={containerClassName}>
      <div className="absolute left-3 right-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs text-foreground backdrop-blur-sm">
            {handshakeState === 'ready' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-primary" />
                Player connected
              </>
            ) : handshakeState === 'limited' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-accent" />
                {isTrustedBridge ? 'Player loaded • limited remote controls' : 'Third-party player loaded'}
              </>
            ) : handshakeState === 'failed' ? (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                Embed failed
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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-border/80 bg-background/80 text-xs backdrop-blur-sm"
            onClick={runEmbedTest}
            disabled={isTestRunning}
          >
            {isTestRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Embed Test
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-border/80 bg-background/80 text-xs backdrop-blur-sm"
            onClick={() => setDebugOpen((value) => !value)}
          >
            <Bug className="h-3.5 w-3.5" />
            {showDebugPanel ? 'Hide debug' : 'Debug panel'}
          </Button>
        </div>
      </div>

      {showDebugPanel && (
        <div className="absolute inset-x-4 top-14 z-20 max-h-[44vh] overflow-hidden rounded-md border border-border/80 bg-background/90 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Embed diagnostics</p>
              <p className="text-[11px] text-muted-foreground">{deviceLabel} • trusted origin {iframeMeta.origin}</p>
            </div>
            {(friendlyError || handshakeState === 'limited') && (
              <div className="rounded-full border border-border/80 bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                {friendlyError ? 'Failure snapshot recorded' : 'Handshake unavailable'}
              </div>
            )}
          </div>

          <div className="max-h-[calc(44vh-53px)] space-y-4 overflow-y-auto px-3 py-3 text-xs">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="font-medium text-foreground">Iframe src</p>
                <p className="break-all text-muted-foreground">{iframeMeta.href}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">Allow attributes</p>
                <p className="break-all text-muted-foreground">{IFRAME_ALLOW}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">Sandbox</p>
                <p className="text-muted-foreground">Removed for third-party player compatibility.</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">Browser reason</p>
                <p className="text-muted-foreground">{friendlyError?.browserReason ?? 'No browser error reported by the iframe yet.'}</p>
              </div>
            </div>

            {testResults.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-foreground">Embed Test results</p>
                <div className="space-y-2">
                  {testResults.map((result) => (
                    <div key={result.id} className="rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-foreground">{result.label}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${result.status === 'pass' ? 'border-primary/50 text-foreground' : 'border-destructive/50 text-foreground'}`}>
                          {result.status === 'pass' ? 'Pass' : 'Fail'}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{result.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="font-medium text-foreground">Recent postMessage activity</p>
              <div className="space-y-2">
                {recentEvents.length > 0 ? recentEvents.map((event) => (
                  <div key={event.id} className="rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-foreground">
                        <span className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] uppercase tracking-wide">
                          {event.direction}
                        </span>
                        <span className="font-medium">{event.type}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="mt-1 break-all text-muted-foreground">{event.origin}</p>
                    {event.note && <p className="mt-1 text-muted-foreground">{event.note}</p>}
                  </div>
                )) : (
                  <div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-muted-foreground">
                    No diagnostic events have been captured yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <iframe
        key={iframeUrl}
        ref={iframeRef}
        src={iframeUrl}
        className={className}
        allow={IFRAME_ALLOW}
        allowFullScreen
        title={title}
        style={{ border: 'none' }}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
      />

      {handshakeState === 'ready' && (
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-full border border-border/80 bg-background/80 p-1.5 backdrop-blur-sm">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full"
            onClick={() => sendCommand(remoteState.isPlaying ? 'pause' : 'play', {}, remoteState.isPlaying ? 'Pause requested from parent controls.' : 'Play requested from parent controls.')}
          >
            {remoteState.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full"
            onClick={() => sendCommand('fullscreen', {}, 'Fullscreen requested from parent controls.')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      )}

      {(friendlyError || handshakeState === 'failed') && (
        <div className="absolute inset-x-4 bottom-4 z-30">
          <Alert variant="destructive" className="border-destructive/60 bg-background/95 backdrop-blur-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Embed player needs attention</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{friendlyError?.reason ?? 'The embedded player could not be controlled from this page.'}</p>
              <p className="text-sm text-muted-foreground">
                {fallbackMessage ?? 'Retry this source, or switch to another source/server from the player picker if the embed still fails.'}
              </p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p><strong className="text-foreground">Iframe URL:</strong> {iframeMeta.href}</p>
                <p><strong className="text-foreground">Allow:</strong> {IFRAME_ALLOW}</p>
                <p><strong className="text-foreground">Sandbox:</strong> removed</p>
                {friendlyError?.browserReason && (
                  <p><strong className="text-foreground">Browser reason:</strong> {friendlyError.browserReason}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setReloadToken((value) => value + 1)}>
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