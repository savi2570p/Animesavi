import { Crown, Sparkles, ExternalLink, X, Tv, Ban, Globe, Download, Zap, Lock } from 'lucide-react';
import { usePopupQueue } from '@/contexts/PopupQueueContext';

export function TokenExpiredGlobalPopup() {
  const { activePopup, dismissPopup } = usePopupQueue();

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
        className="relative w-full max-w-sm rounded-3xl overflow-hidden border border-primary/30 bg-card shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        style={{
          boxShadow:
            '0 0 80px hsla(0, 70%, 40%, 0.25), 0 30px 60px hsla(0, 0%, 0%, 0.6)',
        }}
      >
        {/* Cinematic header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-rose-500/15 to-transparent" />
          <div className="absolute -top-20 -right-16 w-56 h-56 rounded-full blur-3xl bg-primary/40 animate-pulse" />
          <div
            className="absolute -bottom-24 -left-16 w-56 h-56 rounded-full blur-3xl bg-rose-500/30 animate-pulse"
            style={{ animationDelay: '0.6s' }}
          />

          {/* Close */}
          <button
            onClick={dismissPopup}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-background/40 hover:bg-background/70 border border-border/40 flex items-center justify-center backdrop-blur-md transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5 text-foreground/80" />
          </button>

          <div className="relative px-6 pt-7 pb-5 flex flex-col items-center text-center">
            {/* Animated lock badge */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/40 blur-2xl animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-rose-500 to-primary flex items-center justify-center shadow-2xl rotate-3">
                <Lock className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={2.5} />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow-lg ring-2 ring-background">
                <Sparkles className="h-2.5 w-2.5 text-amber-900" strokeWidth={3} />
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/15 border border-destructive/30">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-destructive">
                Premium Expired
              </span>
            </div>

            <h2 className="mt-3 text-xl font-black text-foreground leading-tight">
              Your Premium Access Ended
            </h2>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-[280px] leading-relaxed">
              Reactivate your token to keep enjoying ad-free 4K streaming and all premium perks.
            </p>
          </div>
        </div>

        {/* Perks grid */}
        <div className="px-5 pt-1 pb-2">
          <div className="grid grid-cols-4 gap-1.5">
            {perks.map(({ icon: Icon, label, tone }) => (
              <div
                key={label}
                className="rounded-xl bg-muted/30 border border-border/30 p-2 flex flex-col items-center gap-1"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-[8.5px] font-bold text-foreground/80 text-center leading-tight">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 pt-3 space-y-2">
          <a
            href="https://t.me/getunlocktoken"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center justify-center gap-2 w-full py-3 rounded-xl font-black text-sm text-white overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, hsl(0, 72%, 50%) 0%, hsl(340, 75%, 50%) 100%)',
              boxShadow: '0 0 25px hsla(0, 72%, 50%, 0.45), 0 8px 20px hsla(0, 0%, 0%, 0.4)',
            }}
          >
            <span
              className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
              style={{
                background:
                  'linear-gradient(90deg, transparent, hsla(0, 0%, 100%, 0.25), transparent)',
              }}
            />
            <Crown className="h-4 w-4 relative z-10" />
            <span className="relative z-10">Reactivate Premium</span>
            <ExternalLink className="h-3.5 w-3.5 relative z-10 opacity-80" />
          </a>

          <button
            onClick={dismissPopup}
            className="w-full py-2.5 rounded-xl font-semibold text-xs text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/70 border border-border/40 transition-colors"
          >
            Continue with Limited Access
          </button>
        </div>
      </div>
    </div>
  );
}
