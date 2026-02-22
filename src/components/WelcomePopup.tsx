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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function WelcomePopup() {
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (location.pathname !== '/') return;

    const hasSeenWelcome = localStorage.getItem('has_seen_welcome');
    const hideNotice = localStorage.getItem('hide_notice_popup_v2');
    
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    } else if (!hideNotice) {
      setShowNotice(true);
    }
  }, [location.pathname]);

  const handleWelcomeClose = () => {
    localStorage.setItem('has_seen_welcome', 'true');
    setShowWelcome(false);
    const hideNotice = localStorage.getItem('hide_notice_popup_v2');
    if (!hideNotice) {
      setShowNotice(true);
    }
  };

  const handleNoticeClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('hide_notice_popup_v2', 'true');
    }
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
              <span className="text-lg">🔗</span>
              <div>
                <h4 className="font-medium text-foreground">Clean Share Links</h4>
                <p className="text-sm text-muted-foreground">SEO-friendly anime URLs — share links look clean</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">🔥</span>
              <div>
                <h4 className="font-medium text-foreground">Trending in Crunchy</h4>
                <p className="text-sm text-muted-foreground">See the most popular Crunchy anime at a glance</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">🌙</span>
              <div>
                <h4 className="font-medium text-foreground">Dark Mode Locked</h4>
                <p className="text-sm text-muted-foreground">Permanently set to dark for the best viewing experience</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">📱</span>
              <div>
                <h4 className="font-medium text-foreground">Better Mobile & iOS</h4>
                <p className="text-sm text-muted-foreground">All tabs visible, smoother video controls on every device</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 pt-4">
            <Checkbox 
              id="dont-show-again" 
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label htmlFor="dont-show-again" className="text-sm text-muted-foreground cursor-pointer">
              Don't show again
            </Label>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button variant="default" className="anime-button flex-1" onClick={handleNoticeClose}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
