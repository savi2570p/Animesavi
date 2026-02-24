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

const NOTICE_VERSION = 'v3';

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
              <span className="text-lg">👑</span>
              <div>
                <h4 className="font-medium text-foreground">Premium Crown Badge</h4>
                <p className="text-sm text-muted-foreground">Active token users now get a shimmering golden crown on their avatar</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">☁️</span>
              <div>
                <h4 className="font-medium text-foreground">Cloud Access Sync</h4>
                <p className="text-sm text-muted-foreground">Token access now syncs across all devices, browsers & PWA automatically</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">📂</span>
              <div>
                <h4 className="font-medium text-foreground">Drag & Drop Uploads</h4>
                <p className="text-sm text-muted-foreground">Drag video and image files directly onto upload areas</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">📱</span>
              <div>
                <h4 className="font-medium text-foreground">Mobile Gallery Fix</h4>
                <p className="text-sm text-muted-foreground">Profile picture uploads now work correctly from phone galleries</p>
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
