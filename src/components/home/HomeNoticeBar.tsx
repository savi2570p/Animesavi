import { memo, useState } from 'react';
import { Send, X, Zap, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'home_notice_telegram_dismissed';
const TELEGRAM_URL = 'https://t.me/AnimeSaviInhindiDUB';

/** Slim dismissible announcement strip shown under the homepage hero. */
export const HomeNoticeBar = memo(function HomeNoticeBar() {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });
  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* storage unavailable */ }
  };

  return (
    <div className="home-notice flex items-center gap-3 px-3 py-2.5" role="note">
      <span className="home-notice-icon grid h-8 w-8 shrink-0 place-items-center"><Zap className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">Stay updated</p>
        <p className="text-[11px] md:text-xs text-foreground/80 leading-snug">New Hindi DUB episodes drop on our Telegram first — join so you never miss one.</p>
      </div>
      <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="home-notice-action hidden sm:inline-flex items-center gap-1 h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider">
        <Send className="h-3 w-3" />Telegram<ChevronRight className="h-3 w-3" />
      </a>
      <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Join Telegram" className="home-notice-action sm:hidden grid h-7 w-7 place-items-center"><Send className="h-3.5 w-3.5" /></a>
      <button type="button" onClick={dismiss} aria-label="Dismiss notice" className="grid h-7 w-7 shrink-0 place-items-center text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
});
