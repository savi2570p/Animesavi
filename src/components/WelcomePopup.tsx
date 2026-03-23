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

const NOTICE_VERSION = 'v9';

interface WelcomePopupProps {
  showNoticeOnly?: boolean;
  onNoticeClose?: () => void;
}

export function WelcomePopup({ showNoticeOnly = false, onNoticeClose }: WelcomePopupProps) {
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    if (showNoticeOnly) {
      setShowNotice(true);
      return;
    }

    if (location.pathname !== '/') return;

    const hasSeenWelcome = localStorage.getItem('has_seen_welcome');
    const seenNoticeVersion = localStorage.getItem('notice_popup_seen_version');
    
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    } else if (seenNoticeVersion !== NOTICE_VERSION) {
      setShowNotice(true);
    }
  }, [location.pathname, showNoticeOnly]);

  const handleWelcomeClose = () => {
    localStorage.setItem('has_seen_welcome', 'true');
    setShowWelcome(false);
    const seenNoticeVersion = localStorage.getItem('notice_popup_seen_version');
    if (seenNoticeVersion !== NOTICE_VERSION) {
      setShowNotice(true);
    }
  };

  const handleNoticeClose = () => {
    if (!showNoticeOnly) {
      localStorage.setItem('notice_popup_seen_version', NOTICE_VERSION);
    }
    setShowNotice(false);
    onNoticeClose?.();
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
            <Button variant="default" className="anime-button flex-1" onClick={handleWelcomeClose}>Let's Go! 🚀</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* What's New Popup — v9 */}
      <Dialog open={showNotice} onOpenChange={(open) => { if (!open) handleNoticeClose(); }}>
        <DialogContent className="sm:max-w-lg border-primary/20 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading text-center">
              ✨ What's New — v9
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground">
              Fresh updates just dropped — here's everything new
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">📥</span>
              <div>
                <h4 className="font-medium text-foreground">4K Downloads</h4>
                <p className="text-sm text-muted-foreground">Download episodes in 480p, 720p, 1080p, or 2160p (4K) — choose your quality before downloading.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">📴</span>
              <div>
                <h4 className="font-medium text-foreground">Offline Playback</h4>
                <p className="text-sm text-muted-foreground">Save episodes offline and watch them without internet using the built-in player with full controls.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">🎬</span>
              <div>
                <h4 className="font-medium text-foreground">Advanced Embed Player</h4>
                <p className="text-sm text-muted-foreground">Episode selector, audio switching, keyboard shortcuts (Space/F/M), and multi-season support built into the embed player.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">🏠</span>
              <div>
                <h4 className="font-medium text-foreground">Revamped Landing Page</h4>
                <p className="text-sm text-muted-foreground">New /welcome page with genre explorer, feature grid, testimonials, FAQ, and how-it-works section.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">📺</span>
              <div>
                <h4 className="font-medium text-foreground">Hero Slider Upgrade</h4>
                <p className="text-sm text-muted-foreground">Netflix-style animated progress bar replaced bulky dots — with a glowing active indicator.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">📅</span>
              <div>
                <h4 className="font-medium text-foreground">Compact Calendar</h4>
                <p className="text-sm text-muted-foreground">Release calendar redesigned with dates on the left and anime scrolling horizontally for easy browsing.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">📱</span>
              <div>
                <h4 className="font-medium text-foreground">Mobile Compact UI</h4>
                <p className="text-sm text-muted-foreground">Smaller header icons, home button, compact player controls, and a smaller continue-watching popup for mobile.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">🔗</span>
              <div>
                <h4 className="font-medium text-foreground">Multi-Season Embeds</h4>
                <p className="text-sm text-muted-foreground">Embed links now include season info — Season 2 episodes play correctly without defaulting to Season 1.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">⚡</span>
              <div>
                <h4 className="font-medium text-foreground">Faster Downloads</h4>
                <p className="text-sm text-muted-foreground">Embed player uses direct URLs for instant download start — no more 20-30 second wait times.</p>
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
