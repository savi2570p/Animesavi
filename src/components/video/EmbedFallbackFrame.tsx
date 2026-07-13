import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';

interface EmbedFallbackFrameProps {
  primaryUrl: string;
  alternateUrl: string | null;
  title: string;
  onBackToNative: () => void;
  isFullscreen: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}

const AUTO_RETRY_TIMEOUT_MS = 6000;
const MAX_AUTO_RETRIES = 3;

function buildEmbedHtml(url: string): string {
  const safeUrl = url.replace(/"/g, '&quot;');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}video{width:100%;height:100%;object-fit:contain;background:#000}</style></head><body><video id="v" src="${safeUrl}" controls autoplay playsinline crossorigin="anonymous"></video><script>(function(){var v=document.getElementById('v');var reported=false;function report(reason){if(reported)return;reported=true;try{parent.postMessage({type:'embed-fallback-error',reason:reason},'*');}catch(e){}}v.addEventListener('error',function(){report('video-error');});v.addEventListener('loadedmetadata',function(){try{parent.postMessage({type:'embed-fallback-ready'},'*');}catch(e){}});setTimeout(function(){if(!v.readyState){report('load-timeout');}},5000);})();</script></body></html>`;
}

export function EmbedFallbackFrame({
  primaryUrl,
  alternateUrl,
  title,
  onBackToNative,
  isFullscreen,
  containerRef,
}: EmbedFallbackFrameProps) {
  const [currentUrl, setCurrentUrl] = useState(primaryUrl);
  const [reloadKey, setReloadKey] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'retrying' | 'failed'>('loading');
  const [lastReason, setLastReason] = useState<string | null>(null);
  const readyRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  const clearWatchdog = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const triggerRetry = useCallback(
    (reason: string) => {
      if (readyRef.current) return;
      setLastReason(reason);
      setAttempt((prev) => {
        const next = prev + 1;
        if (next > MAX_AUTO_RETRIES) {
          setStatus('failed');
          clearWatchdog();
          console.warn('[EmbedFallback] gave up after retries', { reason, currentUrl });
          return prev;
        }
        setStatus('retrying');
        console.warn('[EmbedFallback] auto-retry', { reason, next, currentUrl });
        if (next === 1 || !alternateUrl) {
          setReloadKey((k) => k + 1);
        } else {
          setCurrentUrl((u) => (u === primaryUrl && alternateUrl ? alternateUrl : primaryUrl));
          setReloadKey((k) => k + 1);
        }
        return next;
      });
    },
    [alternateUrl, clearWatchdog, currentUrl, primaryUrl],
  );

  const manualReload = useCallback(() => {
    readyRef.current = false;
    setAttempt(0);
    setStatus('loading');
    setLastReason(null);
    setCurrentUrl(primaryUrl);
    setReloadKey((k) => k + 1);
  }, [primaryUrl]);

  useEffect(() => {
    if (status === 'failed') return;
    readyRef.current = false;
    setStatus((s) => (s === 'retrying' ? 'retrying' : 'loading'));
    clearWatchdog();
    timeoutRef.current = window.setTimeout(() => {
      if (!readyRef.current) triggerRetry('load-timeout');
    }, AUTO_RETRY_TIMEOUT_MS);
    return clearWatchdog;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl, reloadKey]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as { type?: string; reason?: string } | undefined;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'embed-fallback-ready') {
        readyRef.current = true;
        clearWatchdog();
        setStatus('ready');
      } else if (data.type === 'embed-fallback-error') {
        triggerRetry(data.reason || 'error');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [clearWatchdog, triggerRetry]);

  const bustedUrl =
    reloadKey > 0
      ? `${currentUrl}${currentUrl.includes('?') ? '&' : '?'}_r=${reloadKey}`
      : currentUrl;
  const embedDoc = buildEmbedHtml(bustedUrl);

  return (
    <div
      ref={containerRef}
      className={`relative bg-black w-full ${isFullscreen ? 'fixed inset-0 z-[9999]' : ''}`}
      style={{
        aspectRatio: isFullscreen ? undefined : '16/9',
        maxHeight: isFullscreen ? '100vh' : '70vh',
        height: isFullscreen ? '100vh' : undefined,
      }}
    >
      {status !== 'failed' && (
        <iframe
          key={`${currentUrl}-${reloadKey}`}
          srcDoc={embedDoc}
          title={title}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
      )}

      {status === 'retrying' && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 py-1.5 bg-black/70 text-white text-xs font-medium z-10">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Reloading embed player (attempt {attempt}/{MAX_AUTO_RETRIES})…
        </div>
      )}

      {status === 'failed' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 z-20">
          <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="text-white font-semibold mb-1">Embed player blocked</h3>
            <p className="text-white/70 text-xs mb-4">
              We couldn't load the embed after {MAX_AUTO_RETRIES} attempts
              {lastReason ? ` (${lastReason})` : ''}. Try again, open in a new tab, or go back to the native player.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={manualReload} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload embed player
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(primaryUrl, '_blank', 'noopener,noreferrer')}
                className="w-full text-white border-white/20 bg-white/5 hover:bg-white/10"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in new tab
              </Button>
              <Button
                variant="ghost"
                onClick={onBackToNative}
                className="w-full text-white/80 hover:text-white hover:bg-white/10"
              >
                Back to Native Player
              </Button>
            </div>
          </div>
        </div>
      )}

      {status !== 'failed' && (
        <div className="absolute top-2 right-2 z-10 flex gap-1.5">
          <Button
            onClick={manualReload}
            variant="outline"
            size="sm"
            className="text-white border-white/30 bg-black/50 hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Retry
          </Button>
          <Button
            onClick={onBackToNative}
            variant="outline"
            size="sm"
            className="text-white border-white/30 bg-black/50 hover:bg-white/10"
          >
            Back to Native
          </Button>
        </div>
      )}
    </div>
  );
}
