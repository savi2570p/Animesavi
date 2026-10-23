import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Send, Users, MessageCircle, X } from 'lucide-react';

const CHANNEL_URL = 'https://t.me/AnimeSaviInhindiDUB';
const PERSONAL_URL = 'https://t.me/Lv_Savi';

export function FloatingTelegramButton() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  // Hide on all embed routes (legacy /embed, new /e/:token, and embed mode)
  const isEmbed = useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    return (
      location.pathname.startsWith('/embed/') ||
      location.pathname.startsWith('/e/') ||
      location.pathname.startsWith('/s2') ||
      search.get('embed') === 'true'
    );
  }, [location.pathname]);

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (isEmbed) return null;

  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="fixed bottom-20 right-3 md:bottom-6 md:right-6 z-50">
      {open && <div role="menu" aria-label="Telegram options" className="utility-glass-v6 telegram-contact-v6 absolute bottom-full right-0 mb-3 w-72 max-w-[calc(100vw-2rem)] overflow-hidden">
        <div className="utility-header-v6 px-4 py-4 border-b border-border flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">Stay connected</p><p className="text-xs text-muted-foreground mt-1">AnimeSavi on Telegram</p></div><Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close Telegram" className="h-7 w-7"><X className="h-3.5 w-3.5" /></Button></div>
        <div className="p-2 space-y-1">
          <Button variant="ghost" role="menuitem" onClick={() => openLink(CHANNEL_URL)} className="w-full h-auto py-3 justify-start gap-3 whitespace-normal text-left"><span className="utility-icon-v6 utility-telegram-icon-v6 h-9 w-9 grid place-items-center rounded-lg shrink-0"><Users className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">Join channel</span><span className="block text-[11px] text-muted-foreground mt-1">@AnimeSaviInhindiDUB</span></span></Button>
          <Button variant="ghost" role="menuitem" onClick={() => openLink(PERSONAL_URL)} className="w-full h-auto py-3 justify-start gap-3 whitespace-normal text-left"><span className="utility-icon-v6 h-9 w-9 grid place-items-center rounded-lg shrink-0 text-primary"><MessageCircle className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">Personal message</span><span className="block text-[11px] text-muted-foreground mt-1">@Lv_Savi</span></span></Button>
        </div>
      </div>}
      <Button variant="glass" size="icon" onClick={() => setOpen(v => !v)} aria-label="Contact on Telegram" title="Telegram" aria-expanded={open} className="utility-fab-v6 utility-telegram-icon-v6 h-10 w-10 md:h-11 md:w-11 rounded-lg"><Send className="h-4 w-4" /></Button>
    </div>
  );
}
