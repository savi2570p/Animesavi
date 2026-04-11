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
import { UpdatePopup } from '@/components/UpdatePopup';

export function WelcomePopup() {
  const { activePopup, dismissPopup } = usePopupQueue();

  const showWelcome = activePopup === 'welcome';

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

      {/* Update / What's New — Premium OTT style */}
      <UpdatePopup />
    </>
  );
}