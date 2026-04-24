import { useEffect, useRef, useState } from 'react';
import { Send, Users, MessageCircle, X } from 'lucide-react';

const CHANNEL_URL = 'https://t.me/AnimeSaviInhindiDUB';
const PERSONAL_URL = 'https://t.me/Lv_Savi';

export function FloatingTelegramButton() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Hide on embed routes
  const isEmbed = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/embed/') ||
    new URLSearchParams(window.location.search).get('embed') === 'true'
  );

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
    <div
      ref={wrapperRef}
      className="fixed bottom-20 right-3 md:bottom-6 md:right-6 z-50"
    >
      {/* Options panel */}
      {open && (
        <div
          role="menu"
          aria-label="Telegram options"
          className="absolute bottom-full right-0 mb-3 w-64 origin-bottom-right animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="relative rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Header */}
            <div
              className="relative px-3.5 py-2.5 border-b border-border/50"
              style={{
                background:
                  'linear-gradient(135deg, rgba(34,158,217,0.18) 0%, rgba(0,136,204,0.06) 60%, transparent 100%)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-[#0088cc]/40 shadow-sm"
                    style={{
                      background:
                        'linear-gradient(135deg, #229ED9 0%, #0088cc 100%)',
                    }}
                  >
                    <Send className="h-3.5 w-3.5 text-white -translate-x-[1px] translate-y-[0.5px]" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-xs font-semibold text-foreground">Connect on Telegram</p>
                    <p className="text-[10px] text-muted-foreground">Choose how to reach us</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="p-1.5 space-y-1">
              <button
                onClick={() => openLink(CHANNEL_URL)}
                role="menuitem"
                className="group/item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/70 transition text-left"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-[#0088cc]/30"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(34,158,217,0.25), rgba(0,136,204,0.12))',
                  }}
                >
                  <Users className="h-4 w-4 text-[#229ED9]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-foreground leading-tight">
                    Join Channel
                  </p>
                  <p className="text-[10.5px] text-muted-foreground truncate">
                    @AnimeSaviInhindiDUB
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-[#229ED9] opacity-0 group-hover/item:opacity-100 transition">
                  Open →
                </span>
              </button>

              <button
                onClick={() => openLink(PERSONAL_URL)}
                role="menuitem"
                className="group/item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/70 transition text-left"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-primary/30"
                  style={{
                    background:
                      'linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.1))',
                  }}
                >
                  <MessageCircle className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-foreground leading-tight">
                    Personal Message
                  </p>
                  <p className="text-[10.5px] text-muted-foreground truncate">
                    @Lv_Savi
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-primary opacity-0 group-hover/item:opacity-100 transition">
                  Chat →
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Contact on Telegram"
        aria-expanded={open}
        className="group relative w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-lg shadow-[#0088cc]/40 transition-all duration-300 hover:scale-110 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #229ED9 0%, #0088cc 60%, #0077b5 100%)',
        }}
      >
        {!open && (
          <span className="absolute inset-0 rounded-full bg-[#0088cc]/40 animate-ping opacity-60 group-hover:opacity-90" />
        )}
        <span className="absolute inset-0 rounded-full ring-1 ring-white/20" />
        <Send className="relative h-4 w-4 md:h-[18px] md:w-[18px] text-white -translate-x-[1px] translate-y-[1px] drop-shadow" />
      </button>
    </div>
  );
}
