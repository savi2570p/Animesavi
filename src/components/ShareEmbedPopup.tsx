import { useState } from 'react';
import { Share2, Link2, Code, Copy, Check, X, MessageCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Shadow Link is now available to everyone — no email gating.

interface ShareEmbedPopupProps {
  /** 'series' shows only Copy Series Link; 'episode' shows episode + embed options */
  type: 'series' | 'episode';
  /** The standard page link URL */
  pageUrl: string;
  /** Anime title for display */
  animeTitle: string;
  /** Slug-based embed URL (only for episode type) */
  embedUrl?: string;
  /** Optional className for trigger button */
  className?: string;
  /** Original/raw video file URL for direct download */
  rawVideoUrl?: string | null;
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
}

export function ShareEmbedPopup({
  type,
  pageUrl,
  animeTitle,
  embedUrl,
  className,
  rawVideoUrl,
  size = 'default',
  variant = 'outline',
}: ShareEmbedPopupProps) {
  const [open, setOpen] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const { user } = useAuth();

  // Production share/embed origin — points at the new custom domain
  const SITE_ORIGIN = 'https://animesavi.com';

  const slugify = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Preserve the exact route (including /anime/<uuid>) — only swap the host to animesavi.com.
  const rebrandUrl = (u: string) => {
    if (!u) return u;
    const input = u.startsWith('http') ? u : `${SITE_ORIGIN}${u.startsWith('/') ? u : '/' + u}`;
    try {
      const url = new URL(input.replace(/https?:\/\/[^/]*lovable\.app/i, SITE_ORIGIN));
      url.protocol = 'https:';
      url.host = 'animesavi.com';
      return url.toString();
    } catch {
      return `${SITE_ORIGIN}/${slugify(animeTitle || 'anime')}`;
    }
  };

  const fullPageUrl = rebrandUrl(pageUrl);
  const fullEmbedUrl = embedUrl ? rebrandUrl(embedUrl) : '';
  const shadowEmbedUrl = fullEmbedUrl ? `${fullEmbedUrl}${fullEmbedUrl.includes('?') ? '&' : '?'}theme=shadow` : '';
  const canSeeShadowLink = !!fullEmbedUrl;

  const iframeCode = fullEmbedUrl
    ? `<iframe src="${fullEmbedUrl}" width="100%" height="500" frameborder="0" allowfullscreen></iframe>`
    : '';

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedItem(label);
    toast.success(`${label} copied successfully.`);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const shareToWhatsApp = () => {
    const text = `Check out ${animeTitle} on AnimeSavi! ${fullPageUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Share2 className="h-4 w-4 mr-2" />
          {type === 'series' ? 'Share' : 'Share Episode'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" sideOffset={8}>
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h4 className="font-semibold text-sm">Share {type === 'series' ? animeTitle : 'Episode'}</h4>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-2 space-y-1">
          {/* Copy Page Link - always shown */}
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent text-left transition-colors"
            onClick={() => copyToClipboard(fullPageUrl, type === 'series' ? 'Series link' : 'Episode link')}
          >
            <Link2 className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Copy {type === 'series' ? 'Series' : 'Episode'} Link</p>
              <p className="text-xs text-muted-foreground truncate">{fullPageUrl}</p>
            </div>
            {copiedItem === (type === 'series' ? 'Series link' : 'Episode link') ? (
              <Check className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>

          {/* WhatsApp Share - always shown */}
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent text-left transition-colors"
            onClick={shareToWhatsApp}
          >
            <MessageCircle className="h-4 w-4 text-[#25D366] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Share on WhatsApp</p>
              <p className="text-xs text-muted-foreground">Send to friends or groups</p>
            </div>
          </button>

          {/* Embed options - only for episodes */}
          {type === 'episode' && fullEmbedUrl && (
            <>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-left transition-colors"
                onClick={() => copyToClipboard(fullEmbedUrl, 'Embed link')}
              >
                <Share2 className="h-4 w-4 text-primary-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Copy Embed Link</p>
                  <p className="text-xs text-primary-foreground/75 truncate">{fullEmbedUrl}</p>
                </div>
                {copiedItem === 'Embed link' ? (
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <Copy className="h-4 w-4 text-primary-foreground/80 shrink-0" />
                )}
              </button>

              {canSeeShadowLink && (
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-left transition-colors"
                  onClick={() => copyToClipboard(shadowEmbedUrl, 'Shadow link')}
                >
                  <Share2 className="h-4 w-4 text-primary-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Copy Shadow Link</p>
                    <p className="text-xs text-primary-foreground/75 truncate">{shadowEmbedUrl}</p>
                  </div>
                  {copiedItem === 'Shadow link' ? (
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <Copy className="h-4 w-4 text-primary-foreground/80 shrink-0" />
                  )}
                </button>
              )}

              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent text-left transition-colors"
                onClick={() => copyToClipboard(iframeCode, 'Iframe code')}
              >
                <Code className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Copy Iframe Code</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{'<iframe src="...">'}</p>
                </div>
                {copiedItem === 'Iframe code' ? (
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
