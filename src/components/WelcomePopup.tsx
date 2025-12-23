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

export function WelcomePopup() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Show only on the home page and only once.
    if (location.pathname !== '/') return;

    const hasSeenWelcome = localStorage.getItem('has_seen_welcome');
    if (!hasSeenWelcome) {
      setIsOpen(true);
    }
  }, [location.pathname]);

  const markSeenAndClose = () => {
    localStorage.setItem('has_seen_welcome', 'true');
    setIsOpen(false);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // If user closes via "X" or clicking outside, also mark as seen.
        if (!open) localStorage.setItem('has_seen_welcome', 'true');
        setIsOpen(open);
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
          <Button variant="default" className="anime-button flex-1" onClick={markSeenAndClose}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

