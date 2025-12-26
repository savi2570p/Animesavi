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
    // Show only on the home page
    if (location.pathname !== '/') return;

    const hasSeenWelcome = localStorage.getItem('has_seen_welcome');
    const hideNotice = localStorage.getItem('hide_notice_popup');
    
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    } else if (!hideNotice) {
      // If welcome was already seen and notice is not hidden, show the notice directly
      setShowNotice(true);
    }
  }, [location.pathname]);

  const handleWelcomeClose = () => {
    localStorage.setItem('has_seen_welcome', 'true');
    setShowWelcome(false);
    // Show the notice after welcome is closed (if not hidden)
    const hideNotice = localStorage.getItem('hide_notice_popup');
    if (!hideNotice) {
      setShowNotice(true);
    }
  };

  const handleNoticeClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('hide_notice_popup', 'true');
    }
    setShowNotice(false);
  };

  return (
    <>
      {/* Welcome Popup - shows only once */}
      <Dialog
        open={showWelcome}
        onOpenChange={(open) => {
          if (!open) handleWelcomeClose();
        }}
      >
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
            <Button variant="default" className="anime-button flex-1" onClick={handleWelcomeClose}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notice Popup - shows every time unless "Don't show again" is checked */}
      <Dialog
        open={showNotice}
        onOpenChange={(open) => {
          if (!open) handleNoticeClose();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading text-center">
              📢 Important Notice
            </DialogTitle>
            <DialogDescription className="text-center text-base pt-4 leading-relaxed">
              We are now uploading the latest anime and anime movie also those anime or anime movie which is already released. We updating all completed series or movie which is already released within 7-10 Days. If you want to upload your own anime like older anime or anime movie also if you DUBBED your own anime or anime movie then DM us on telegram Channel we will upload on it with Full Credits.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-center pt-2">
            <a
              href="https://t.me/Lv_Savi"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline underline-offset-4 font-medium transition-colors"
            >
              Contact
            </a>
          </div>

          <div className="flex items-center justify-center gap-2 pt-4">
            <Checkbox 
              id="dont-show-again" 
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label 
              htmlFor="dont-show-again" 
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Don't show again
            </Label>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button variant="default" className="anime-button flex-1" onClick={handleNoticeClose}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
