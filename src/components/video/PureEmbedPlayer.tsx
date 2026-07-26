import { useMemo, useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isEmbedUrlAllowed, getHostname } from '@/lib/embedAllowlist';

interface PureEmbedPlayerProps {
  url: string;
  title: string;
  onSwitchServer?: () => void;
}

/**
 * Extracts a clean embed URL from raw user input. Accepts:
 *  - A plain URL: "https://host/embed/abc"
 *  - Full <iframe ...> markup pasted by uploaders.
 * Trims spaces and surrounding quotes.
 */
export function extractEmbedSrc(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim().replace(/^["']|["']$/g, '');

  // If the input looks like an <iframe ... src="..."> block, pull out the src.
  const iframeMatch = trimmed.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  if (iframeMatch?.[1]) return iframeMatch[1].trim();

  // Generic src="..." extraction in case only the attribute was pasted.
  const srcAttrMatch = trimmed.match(/\ssrc\s*=\s*["']([^"']+)["']/i);
  if (srcAttrMatch?.[1]) return srcAttrMatch[1].trim();

  return trimmed;
}

/**
 * Heuristic: is this URL an external embed link (vs. a direct file/storage URL)?
 * Used to auto-assign the EMBED server when an episode only has an external_url.
 */
export function isEmbedLikeUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const url = extractEmbedSrc(raw);
  if (!url) return false;

  // Pasted iframe markup is always an embed.
  if (/<iframe[\s>]/i.test(raw)) return true;

  // Direct video files / HLS / storage URLs are NOT embeds.
  if (/\.(mp4|mkv|webm|avi|m3u8|m4v|mov)(\?.*)?$/i.test(url)) return false;
  if (/supabase.*storage|blob\.core\.windows|s3\.amazonaws|cloudfront\.net|r2\.cloudflarestorage|storage\.googleapis/i.test(url)) return false;

  // YouTube has its own dedicated embed handler in VideoPlayer.
  if (/(?:youtube\.com|youtu\.be)/i.test(url)) return false;

  // Common embed indicators: /embed/, /e/, /play/, ?v=, known hosts.
  if (/\/(embed|e|play|stream|iframe)\//i.test(url)) return true;
  if (/(upnshare|rpmshare|doodstream|dood\.|streamtape|filemoon|vidplay|streamwish|mixdrop|vidcloud|vidsrc|2embed|streamhg|streamlare|voe\.sx|hydrax)/i.test(url)) return true;

  // Fallback: any non-direct http(s) URL is treated as a possible embed.
  return /^https?:\/\//i.test(url);
}

/**
 * Pure iframe embed player — no custom controls, no postMessage handshake,
 * no sandbox. Used by the "Embed" server for external hosts (UPNShare,
 * RPMShare, Doodstream, Streamtape, etc.).
 */
export function PureEmbedPlayer({ url, title, onSwitchServer }: PureEmbedPlayerProps) {
  const cleanUrl = useMemo(() => extractEmbedSrc(url), [url]);
  const [reloadKey, setReloadKey] = useState(0);
  const [hasError, setHasError] = useState(false);

  const allowed = useMemo(() => (cleanUrl ? isEmbedUrlAllowed(cleanUrl) : true), [cleanUrl]);
  const blockedHost = useMemo(() => (cleanUrl ? getHostname(cleanUrl) : null), [cleanUrl]);

  if (!cleanUrl) {
    return (
      <div
        className="relative w-full bg-black flex items-center justify-center"
        style={{ aspectRatio: '16 / 9' }}
      >
        <div className="text-center text-white/80 px-6">
          <AlertCircle className="h-8 w-8 mx-auto mb-3 text-amber-400" />
          <p className="text-sm font-semibold">No embed URL provided.</p>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div
        className="relative w-full bg-black flex items-center justify-center"
        style={{ aspectRatio: '16 / 9' }}
      >
        <div className="text-center text-white/80 px-6 max-w-md">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-amber-400" />
          <p className="text-white font-semibold mb-1">Embed host not on allowlist</p>
          <p className="text-white/60 text-sm mb-4">
            {blockedHost ? <><span className="font-mono">{blockedHost}</span> is not in the </> : 'This source is not in the '}
            approved embed domains list. Ask an admin to add it, or switch to another server.
          </p>
          {onSwitchServer && (
            <Button size="sm" onClick={onSwitchServer}>
              Try Another Server
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Mandatory ad + redirect blocking layer for the Embed server.
  // Since sandbox is off (some hosts refuse to run inside one), we rely on
  // parent-side traps + a first-click shield to strip pop-under / redirect ads.
  //   1) window.open → no-op while embed is mounted (kills popup ads).
  //   2) beforeunload guard → blocks unexpected top-level redirects that ad
  //      scripts trigger via `top.location = ...` bridges.
  //   3) target=_blank hijack → any link opened in a new tab from anywhere on
  //      the page while embed is playing is cancelled (embed hosts inject
  //      hidden <a target=_blank> and auto-click them).
  //   4) One-shot click shield: the very first pointer event on the iframe is
  //      swallowed (that's the pop-under trigger). Real playback click lands
  //      on the second tap. This mirrors uBlock's popup-blocker heuristic.
  //   5) Visibility guard: if the tab loses focus within 400ms of a click on
  //      the iframe, we refocus the window (kills pop-unders that stole focus).
  // None of this can be disabled by users or embed hosts.
  useEffect(() => {
    if (hasError || !allowed || !cleanUrl) return;

    const originalOpen = window.open;
    (window as any).open = () => null;

    const blockUnload = (e: BeforeUnloadEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest('[data-user-nav="true"]')) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', blockUnload);

    // Neutralise target=_blank anchors added by ad scripts on the parent doc.
    const blockBlankClicks = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[target="_blank"]') as HTMLAnchorElement | null;
      if (!a) return;
      if (a.closest('[data-user-nav="true"]')) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('click', blockBlankClicks, true);
    document.addEventListener('auxclick', blockBlankClicks, true);

    // Refocus if a pop-under steals focus right after an iframe click.
    let lastIframeClick = 0;
    const markClick = () => { lastIframeClick = Date.now(); };
    const onBlur = () => {
      if (Date.now() - lastIframeClick < 400) {
        setTimeout(() => window.focus(), 0);
      }
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('pointerdown', markClick, true);

    return () => {
      window.open = originalOpen;
      window.removeEventListener('beforeunload', blockUnload);
      document.removeEventListener('click', blockBlankClicks, true);
      document.removeEventListener('auxclick', blockBlankClicks, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerdown', markClick, true);
    };
  }, [cleanUrl, allowed, hasError]);

  // First-click shield state: swallow the very first pointer event on the
  // iframe overlay, then get out of the way so playback controls work.
  const [shieldArmed, setShieldArmed] = useState(true);
  useEffect(() => { setShieldArmed(true); }, [cleanUrl, reloadKey]);

  return (
    <div
      className="embed-player relative w-full bg-black overflow-hidden"
      style={{ aspectRatio: '16 / 9' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {!hasError ? (
        <>
        <iframe
          key={`${cleanUrl}-${reloadKey}`}
          src={cleanUrl}
          title={title}
          className="embed-frame absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
          allowFullScreen
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' } as React.CSSProperties}
        />
        {shieldArmed && (
          <div
            className="absolute inset-0 z-20 cursor-pointer"
            aria-label="Tap to start"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShieldArmed(false);
            }}
          />
        )}
        <div className="embed-frame-shield" aria-hidden="true" onContextMenu={(e) => e.preventDefault()} />
        <div
          className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-emerald-300 pointer-events-none select-none"
          aria-label="Ad blocker active"
        >
          <ShieldCheck className="h-3 w-3" />
          Ad-Block On
        </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-black">
          <AlertCircle className="h-10 w-10 text-amber-400 mb-3" />
          <p className="text-white font-semibold mb-1">Embed source not supported or blocked</p>
          <p className="text-white/60 text-sm mb-4 max-w-md">
            The external host refused to load inside this player. Try reloading or switch to another server.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setHasError(false);
                setReloadKey((k) => k + 1);
              }}
              className="text-white border-white/30 hover:bg-white/10"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
            {onSwitchServer && (
              <Button size="sm" onClick={onSwitchServer}>
                Try Another Server
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
