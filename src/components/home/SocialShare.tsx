import { Button } from '@/components/ui/button';
import { Copy, Check, Share2, MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface SocialShareProps { className?: string; }
const WEBSITE_URL = 'https://animesavi.com';
export function SocialShare({ className = '' }: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(WEBSITE_URL); setCopied(true); toast.success('Link copied'); window.setTimeout(() => setCopied(false), 2000); }
    catch { toast.error('Could not copy the link'); }
  };
  const share = async () => {
    if (!navigator.share) { await copy(); return; }
    try { await navigator.share({ title: 'AnimeSavi', url: WEBSITE_URL }); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error('Could not share the link'); }
  };
  return <section className={`share-simple-v6 py-6 border-y border-border flex flex-wrap items-center justify-between gap-5 ${className}`}>
    <div className="flex items-center gap-3"><span className="utility-icon-v6 h-10 w-10 rounded-lg grid place-items-center"><Share2 className="h-4 w-4 text-primary" /></span><div><h3 className="text-lg font-semibold">Share with friends</h3><p className="text-xs text-muted-foreground mt-1">animesavi.com</p></div></div>
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={share}><Share2 className="h-4 w-4" />Share</Button>
      <Button variant="glass" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy link'}</Button>
      <Button asChild variant="glass" size="icon" title="Share on WhatsApp" aria-label="Share on WhatsApp"><a href={`https://wa.me/?text=${encodeURIComponent(WEBSITE_URL)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /></a></Button>
      <Button asChild variant="glass" size="icon" title="Share on Telegram" aria-label="Share on Telegram"><a href={`https://t.me/share/url?url=${encodeURIComponent(WEBSITE_URL)}`} target="_blank" rel="noopener noreferrer"><Send className="h-4 w-4" /></a></Button>
    </div>
  </section>;
}
