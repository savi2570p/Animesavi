import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePopupQueue } from '@/contexts/PopupQueueContext';

export function WelcomePopup() {
  const { activePopup, dismissPopup } = usePopupQueue();

  const showWelcome = activePopup === 'welcome';
  const showNotice = activePopup === 'whatsNew';

  return (
    <>
      {/* Welcome Popup */}
      <Dialog open={showWelcome} onOpenChange={(open) => { if (!open) dismissPopup(); }}>
        <DialogContent className="sm:max-w-md border-primary/20" style={{ zIndex: 9997 }}>
          <DialogHeader>
            <div className="flex justify-center mb-3">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl">
                🎌
              </div>
            </div>
            <DialogTitle className="text-2xl font-heading text-center">
              Welcome to <span className="anime-gradient-text">AnimeSavi</span>! 
            </DialogTitle>
            <DialogDescription className="text-center text-base pt-3 space-y-3">
              <p>Hey there! 👋 Welcome to your new home for anime.</p>
              <p className="text-sm text-muted-foreground">Watch your favorite anime in <span className="font-semibold text-foreground">official Hindi DUB</span> — completely free, anytime, anywhere.</p>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/40">
                  <span className="text-lg">🎬</span>
                  <span className="text-[10px] text-muted-foreground text-center">HD & 4K</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/40">
                  <span className="text-lg">📥</span>
                  <span className="text-[10px] text-muted-foreground text-center">Offline</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/40">
                  <span className="text-lg">🔊</span>
                  <span className="text-[10px] text-muted-foreground text-center">Hindi Dub</span>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mt-2">
            <span className="text-xl">🍿</span>
            <p className="text-sm text-muted-foreground">New episodes added regularly. Bookmark us & never miss an update!</p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button variant="default" className="anime-button flex-1" onClick={dismissPopup}>Let's Go! 🚀</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* What's New Popup — v9 */}
      <Dialog open={showNotice} onOpenChange={(open) => { if (!open) dismissPopup(); }}>
        <DialogContent className="sm:max-w-sm border-primary/20 p-4" style={{ zIndex: 9998 }}>
          <DialogHeader className="pb-1">
            <DialogTitle className="text-base font-heading text-center">
              ✨ What's New — v9
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
            {[
              { icon: '📥', title: '4K Downloads', desc: 'Download in 480p, 720p, 1080p or 4K' },
              { icon: '📴', title: 'Offline Playback', desc: 'Save & watch episodes without internet' },
              { icon: '🎬', title: 'Advanced Embed Player', desc: 'Episode selector, audio switch & shortcuts' },
              { icon: '🏠', title: 'New Landing Page', desc: 'Genre explorer, testimonials & FAQ' },
              { icon: '📺', title: 'Hero Slider Upgrade', desc: 'Netflix-style animated progress bar' },
              { icon: '📅', title: 'Compact Calendar', desc: 'Dates on left, anime scroll horizontally' },
              { icon: '📱', title: 'Mobile Compact UI', desc: 'Smaller controls & compact popups' },
              { icon: '🔗', title: 'Multi-Season Embeds', desc: 'Correct season in embed links' },
              { icon: '⚡', title: 'Faster Downloads', desc: 'Instant download start, no delays' },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-2.5 p-2 bg-muted/40 rounded-md">
                <span className="text-sm shrink-0">{item.icon}</span>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-foreground leading-tight">{item.title}</h4>
                  <p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="default" size="sm" className="anime-button w-full" onClick={dismissPopup}>Got it! 👍</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
