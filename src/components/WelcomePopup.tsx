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

const NOTICE_VERSION = 'v4';

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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading text-center">
              Welcome to <span className="anime-gradient-text">Anime.Savi.me</span>! 🎉
            </DialogTitle>
            <DialogDescription className="text-center text-base pt-4">
              Hi, bro/sis I hope you are good. Welcome to our website you can watch your favorite anime in official Hindi DUB
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button variant="default" className="anime-button flex-1" onClick={handleWelcomeClose}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* What's New Popup */}
      <Dialog open={showNotice} onOpenChange={(open) => { if (!open) handleNoticeClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading text-center">
              ✨ What's New
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">🎬</span>
              <div>
                <h4 className="font-medium text-foreground">MuseIN — Coming Soon</h4>
                <p className="text-sm text-muted-foreground">A curated collection of Muse India anime dubbed in Hindi is on the way!</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">🎮</span>
              <div>
                <h4 className="font-medium text-foreground">Compact Player Controls</h4>
                <p className="text-sm text-muted-foreground">Sleeker, smaller video controls on both mobile and desktop for a cleaner viewing experience</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">⏱️</span>
              <div>
                <h4 className="font-medium text-foreground">Timeline Time Preview</h4>
                <p className="text-sm text-muted-foreground">Hover over the video timeline to see the exact time before skipping — no more guessing!</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">🚀</span>
              <div>
                <h4 className="font-medium text-foreground">Performance Boost</h4>
                <p className="text-sm text-muted-foreground">Faster loading, smoother animations, and improved performance across all devices</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button variant="default" className="anime-button flex-1" onClick={handleNoticeClose}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
