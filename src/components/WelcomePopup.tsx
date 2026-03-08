import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const NOTICE_VERSION = 'v6';

export function WelcomePopup() {
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    if (location.pathname !== '/') return;

    const hasSeenWelcome = localStorage.getItem('has_seen_welcome');
    const seenNoticeVersion = localStorage.getItem('notice_popup_seen_version');
    
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    } else if (seenNoticeVersion !== NOTICE_VERSION) {
      setShowNotice(true);
    }
  }, [location.pathname]);

  const handleWelcomeClose = () => {
    localStorage.setItem('has_seen_welcome', 'true');
    setShowWelcome(false);
    const seenNoticeVersion = localStorage.getItem('notice_popup_seen_version');
    if (seenNoticeVersion !== NOTICE_VERSION) {
      setShowNotice(true);
    }
  };

  const handleNoticeClose = () => {
    localStorage.setItem('notice_popup_seen_version', NOTICE_VERSION);
    setShowNotice(false);
  };

  return (
    <>
      {/* Welcome Popup */}
      <Dialog open={showWelcome} onOpenChange={(open) => { if (!open) handleWelcomeClose(); }}>
        <DialogContent className="sm:max-w-md border-primary/20">
          <DialogHeader>
            <div className="flex justify-center mb-3">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl">
                🎌
              </div>
            </div>
            <DialogTitle className="text-2xl font-heading text-center">
              Welcome to <span className="anime-gradient-text">Anime.Savi</span>! 
            </DialogTitle>
            <DialogDescription className="text-center text-base pt-3 space-y-2">
              <p>Hey there! 👋 Welcome to your new home for anime.</p>
              <p className="text-sm text-muted-foreground">Watch your favorite anime in <span className="font-semibold text-foreground">official Hindi DUB</span> — completely free, anytime, anywhere.</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mt-2">
            <span className="text-xl">🍿</span>
            <p className="text-sm text-muted-foreground">New episodes added regularly. Bookmark us & never miss an update!</p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button variant="default" className="anime-button flex-1" onClick={handleWelcomeClose}>Let's Go! 🚀</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* What's New Popup */}
      <Dialog open={showNotice} onOpenChange={(open) => { if (!open) handleNoticeClose(); }}>
        <DialogContent className="sm:max-w-lg border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading text-center">
              ✨ What's New — v5
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground">
              Here's what we've been cooking up for you
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">📅</span>
              <div>
                <h4 className="font-medium text-foreground">Upcoming Anime Tab</h4>
                <p className="text-sm text-muted-foreground">See what's coming next with a live countdown timer for every upcoming anime release!</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">🎉</span>
              <div>
                <h4 className="font-medium text-foreground">Watch Party Upgraded</h4>
                <p className="text-sm text-muted-foreground">Dedicated chat tab, see who's watching with you, and anyone can end inactive parties</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">🔍</span>
              <div>
                <h4 className="font-medium text-foreground">Better Search</h4>
                <p className="text-sm text-muted-foreground">Search results now appear first — no more scrolling past popular titles</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">▶️</span>
              <div>
                <h4 className="font-medium text-foreground">Auto Embed Player</h4>
                <p className="text-sm text-muted-foreground">URL-based episodes now auto-play in the embed player — zero extra clicks</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button variant="default" className="anime-button flex-1" onClick={handleNoticeClose}>Got it! 👍</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
