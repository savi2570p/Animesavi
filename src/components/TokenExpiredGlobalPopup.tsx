import { Crown, Sparkles, ExternalLink, X, Tv, Ban, Globe, Download, Zap, Lock } from 'lucide-react';
import { usePopupQueue } from '@/contexts/PopupQueueContext';
import { useCastDetection } from '@/hooks/useCastDetection';

export function TokenExpiredGlobalPopup() {
  const { activePopup, dismissPopup } = usePopupQueue();
  const isCasting = useCastDetection();

  // Bypass popup entirely while casting / mirroring to a TV or on embed routes
  if (isCasting) return null;
  if (typeof window !== 'undefined') {
    const p = window.location.pathname;
    if (p.startsWith('/embed/') || p.startsWith('/embed-')) return null;
  }
  if (activePopup !== 'expired') return null;

  const perks = [
    { icon: Tv, label: '4K Ultra HD', tone: 'text-sky-400 bg-sky-500/10' },
    { icon: Ban, label: 'Ad-Free', tone: 'text-rose-400 bg-rose-500/10' },
    { icon: Globe, label: 'Multi-Audio', tone: 'text-emerald-400 bg-emerald-500/10' },
    { icon: Download, label: '4K Downloads', tone: 'text-violet-400 bg-violet-500/10' },
  ];

  return (
    <div
      data-scroll-lock="active"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300"
      style={{
        background:
          'radial-gradient(ellipse at center, hsla(0, 65%, 12%, 0.55) 0%, hsla(0, 0%, 0%, 0.92) 70%)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="relative w-full max-w-[19rem] rounded-2xl overflow-hidden border border-primary/30 bg-card shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        style={{
          boxShadow:
            '0 0 60px hsla(0, 70%, 40%, 0.22), 0 20px 40px hsla(0, 0%, 0%, 0.55)',
        }}
      >
        {/* Cinematic header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-rose-500/15 to-transparent" />
          <div className="absolute -top-16 -right-12 w-40 h-40 rounded-full blur-3xl bg-primary/40 animate-pulse" />

          {/* Close */}
          <button
            onClick={dismissPopup}
            className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-background/40 hover:bg-background/70 border border-border/40 flex items-center justify-center backdrop-blur-md transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3 text-foreground/80" />
          </button>

          <div className="relative px-4 pt-5 pb-3 flex flex-col items-center text-center">
            {/* Compact lock badge */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/40 blur-xl animate-pulse" />
              <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-primary via-rose-500 to-primary flex items-center justify-center shadow-xl rotate-3">
                <Lock className="h-5 w-5 text-white drop-shadow" strokeWidth={2.5} />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shadow ring-2 ring-background">
                <Sparkles className="h-2 w-2 text-amber-900" strokeWidth={3} />
              </div>
            </div>

            <div className="mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/15 border border-destructive/30">
              <span className="w-1 h-1 rounded-full bg-destructive animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-[0.18em] text-destructive">
                Premium Expired
              </span>
            </div>

            <h2 className="mt-2 text-sm font-black text-foreground leading-tight">
              Your Premium Access Ended
            </h2>
            <p className="text-[10px] text-muted-foreground mt-1 max-w-[220px] leading-snug">
              Reactivate your token to keep ad-free 4K streaming.
            </p>
          </div>
        </div>

        {/* Perks grid — compact */}
        <div className="px-4 pt-0 pb-1.5">
          <div className="grid grid-cols-4 gap-1">
            {perks.map(({ icon: Icon, label, tone }) => (
              <div
                key={label}
                className="rounded-lg bg-muted/30 border border-border/30 p-1.5 flex flex-col items-center gap-0.5"
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center ${tone}`}>
                  <Icon className="h-2.5 w-2.5" />
                </div>
                <span className="text-[7.5px] font-bold text-foreground/80 text-center leading-tight">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pt-2 pb-4 space-y-1.5">
          <a
            href="https://t.me/getunlocktoken"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center justify-center gap-1.5 w-full py-2 rounded-lg font-black text-xs text-white overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, hsl(270, 75%, 55%) 0%, hsl(290, 75%, 55%) 100%)',
              boxShadow: '0 0 18px hsla(0, 72%, 50%, 0.4), 0 6px 14px hsla(0, 0%, 0%, 0.35)',
            }}
          >
            <Crown className="h-3.5 w-3.5 relative z-10" />
            <span className="relative z-10">Reactivate Premium</span>
            <ExternalLink className="h-3 w-3 relative z-10 opacity-80" />
          </a>

          <button
            onClick={dismissPopup}
            className="w-full py-1.5 rounded-lg font-semibold text-[10px] text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/70 border border-border/40 transition-colors"
          >
            Continue with Limited Access
          </button>
        </div>
      </div>
    </div>
  );
}
