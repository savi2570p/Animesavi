import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

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
  const [status, setStatus] = useState<'loading' | 'ready' | 'retrying'>('loading');
  const readyRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  // Clear pending load-timeout when the iframe finishes loading or on unmount.
  const clearWatchdog = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    readyRef.current = false;
    setStatus('loading');
    clearWatchdog();
    timeoutRef.current = window.setTimeout(() => {
      if (!readyRef.current) triggerRetry('load-timeout');
    }, AUTO_RETRY_TIMEOUT_MS);
    return clearWatchdog;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl, reloadKey]);

  const triggerRetry = (reason: string) => {
    if (readyRef.current) return;
    if (attempt >= MAX_AUTO_RETRIES) return;
    setStatus('retrying');
    const next = attempt + 1;
    setAttempt(next);
    console.warn('[EmbedFallback] auto-retry', { reason, next, currentUrl });
    // Retry 1: cache-bust same URL. Retry 2+: swap to alternate if available.
    if (next === 1 || !alternateUrl) {
      setReloadKey((k) => k + 1);
    } else {
      setCurrentUrl((u) => (u === primaryUrl && alternateUrl ? alternateUrl : primaryUrl));
      setReloadKey((k) => k + 1);
    }
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, alternateUrl, primaryUrl, currentUrl]);

  const bustedUrl = reloadKey > 0
    ? `${currentUrl}${currentUrl.includes('?') ? '&' : '?'}_r=${reloadKey}`
    : currentUrl;
  const embedSrc = `data:text/html;charset=utf-8,${encodeURIComponent(buildEmbedHtml(bustedUrl))}`;

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
      <iframe
        key={`${currentUrl}-${reloadKey}`}
        src={embedSrc}
        title={title}
        className="absolute inset-0 w-full h-full border-0"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
      />
      {status === 'retrying' && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 py-1.5 bg-black/70 text-white text-xs font-medium">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Reloading embed player (attempt {attempt}/{MAX_AUTO_RETRIES})…
        </div>
      )}
      <div className="absolute top-2 right-2 z-10 flex gap-1.5">
        <Button
          onClick={() => {
            readyRef.current = false;
            setAttempt(0);
            setReloadKey((k) => k + 1);
          }}
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
    </div>
  );
}
