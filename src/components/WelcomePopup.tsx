import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePopupQueue } from '@/contexts/PopupQueueContext';
import { UpdatePopup } from '@/components/UpdatePopup';
import { Sparkles, Tv, Download, Languages, Rocket, ShieldCheck } from 'lucide-react';

export function WelcomePopup() {
  const { activePopup, dismissPopup } = usePopupQueue();
  const showWelcome = activePopup === 'welcome';

  const features = [
    { Icon: Tv, label: '4K Ultra HD', tone: 'from-sky-500/25 to-sky-500/5 text-sky-300 border-sky-500/30' },
    { Icon: Languages, label: 'Hindi DUB', tone: 'from-amber-500/25 to-amber-500/5 text-amber-300 border-amber-500/30' },
    { Icon: Download, label: 'Offline', tone: 'from-emerald-500/25 to-emerald-500/5 text-emerald-300 border-emerald-500/30' },
  ];

  return (
    <>
      <Dialog open={showWelcome} onOpenChange={(open) => { if (!open) dismissPopup(); }}>
        <DialogContent
          className="sm:max-w-md p-0 overflow-hidden border border-primary/30 bg-card"
          style={{ zIndex: 9997, boxShadow: '0 0 80px hsla(0, 70%, 40%, 0.25), 0 30px 60px hsla(0, 0%, 0%, 0.6)' }}
        >
          {/* Cinematic backdrop */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-pink-500/15 to-transparent" />
            <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full blur-3xl bg-primary/40 animate-pulse" />
            <div
              className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full blur-3xl bg-pink-500/30 animate-pulse"
              style={{ animationDelay: '0.6s' }}
            />

            <div className="relative px-6 pt-8 pb-5 text-center">
              {/* Hero mark */}
              <div className="relative inline-block">
                <div className="absolute inset-0 rounded-2xl bg-primary/40 blur-2xl animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-rose-500 to-pink-500 flex items-center justify-center shadow-2xl rotate-3 mx-auto">
                  <span className="text-3xl drop-shadow">🎌</span>
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow-lg ring-2 ring-card">
                  <Sparkles className="h-2.5 w-2.5 text-amber-900" strokeWidth={3} />
                </div>
              </div>

              <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">
                  New Here · Welcome
                </span>
              </div>

              <h2 className="mt-3 text-2xl sm:text-3xl font-heading font-black leading-tight">
                Welcome to{' '}
                <span className="bg-gradient-to-br from-primary via-rose-500 to-pink-500 bg-clip-text text-transparent">
                  AnimeSavi
                </span>
              </h2>
              <p className="text-[12px] sm:text-sm text-muted-foreground mt-2 max-w-[340px] mx-auto leading-relaxed">
                Your premium home for anime — official{' '}
                <span className="font-bold text-foreground">Hindi DUB</span>, 4K streaming, ad-free.
              </p>
            </div>
          </div>

          {/* Feature pills */}
          <div className="px-5 pb-2">
            <div className="grid grid-cols-3 gap-2">
              {features.map(({ Icon, label, tone }) => (
                <div
                  key={label}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl bg-gradient-to-b border ${tone}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] font-bold tracking-wide">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trust strip */}
          <div className="mx-5 mt-2 mb-3 rounded-xl bg-muted/40 border border-border/40 px-3 py-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              <span className="font-bold text-foreground">100% free</span> — bookmark us &amp; never miss a release.
            </p>
          </div>

          {/* CTA */}
          <div className="p-5 pt-2">
            <Button
              onClick={dismissPopup}
              className="group relative w-full h-11 rounded-xl font-black text-sm text-white overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, hsl(0, 72%, 50%) 0%, hsl(340, 75%, 50%) 100%)',
                boxShadow: '0 0 25px hsla(0, 72%, 50%, 0.4), 0 8px 20px hsla(0, 0%, 0%, 0.4)',
              }}
            >
              <span
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
                style={{ background: 'linear-gradient(90deg, transparent, hsla(0,0%,100%,0.25), transparent)' }}
              />
              <Rocket className="h-4 w-4 mr-1.5 relative z-10" />
              <span className="relative z-10">Let&apos;s Go</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update / What's New — Premium OTT style */}
      <UpdatePopup />
    </>
  );
}
