import { useState, useEffect } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has seen the welcome popup
    const hasSeenWelcome = localStorage.getItem('has_seen_welcome');
    
    if (!hasSeenWelcome) {
      setIsOpen(true);
    }
  }, []);

  const handleOk = () => {
    localStorage.setItem('has_seen_welcome', 'true');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
          <Button
            variant="default"
            className="anime-button flex-1"
            onClick={handleOk}
          >
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
