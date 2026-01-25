import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, Lock, Unlock, ExternalLink } from 'lucide-react';

interface TelegramUnlockDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlock: () => void;
}

const TELEGRAM_CHANNEL_URL = 'https://t.me/AnimeSaviInhindiDUB';
const UNLOCK_KEY = 'animesavi_download_unlocked';

export function TelegramUnlockDialog({ 
  isOpen, 
  onOpenChange,
  onUnlock 
}: TelegramUnlockDialogProps) {
  const [hasJoined, setHasJoined] = useState(false);

  const handleJoinChannel = () => {
    window.open(TELEGRAM_CHANNEL_URL, '_blank');
    setHasJoined(true);
  };

  const handleUnlock = () => {
    // Save unlock status to localStorage
    localStorage.setItem(UNLOCK_KEY, 'true');
    onUnlock();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Unlock Batch Download
          </DialogTitle>
          <DialogDescription>
            Join our Telegram channel to unlock the batch download feature
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <MessageCircle className="h-12 w-12 text-primary-foreground" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg">Anime Savi on Telegram</h3>
            <p className="text-sm text-muted-foreground">
              Get the latest anime updates, episode releases, and exclusive content!
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleJoinChannel}
              className="w-full gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Join Telegram Channel
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>

            {hasJoined && (
              <Button 
                onClick={handleUnlock}
                variant="outline"
                className="w-full gap-2"
              >
                <Unlock className="h-4 w-4" />
                I've Joined - Unlock Download
              </Button>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            By joining, you'll also receive notifications for new episodes!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper to check if download is unlocked
export function isDownloadUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(UNLOCK_KEY) === 'true';
}
