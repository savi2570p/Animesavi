import { useMemo, useState } from 'react';
import { AlertCircle, RefreshCw, ShieldAlert } from 'lucide-react';
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

  return (
    <div
      className="relative w-full bg-black overflow-hidden"
      style={{ aspectRatio: '16 / 9' }}
    >
      {!hasError ? (
        <iframe
          key={`${cleanUrl}-${reloadKey}`}
          src={cleanUrl}
          title={title}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; accelerometer; gyroscope"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          onError={() => setHasError(true)}
        />
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
