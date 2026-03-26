import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

interface BanScreenProps {
  expiresAt: Date;
  onExpired: () => void;
}

export function BanScreen({ expiresAt, onExpired }: BanScreenProps) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function update() {
      const now = Date.now();
      const diff = expiresAt.getTime() - now;

      if (diff <= 0) {
        onExpired();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-background">
      <div className="max-w-md mx-auto px-6 text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="w-10 h-10 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold text-foreground">
          You Are Currently Banned
        </h1>

        <p className="text-muted-foreground">
          You have been banned from AnimeSavi for attempting to promote adult content. 
          Please wait until the timer ends to regain access.
        </p>

        <div className="py-4">
          <div className="text-5xl font-mono font-bold text-destructive tracking-wider">
            {timeLeft}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Hours : Minutes : Seconds</p>
        </div>

        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm text-muted-foreground">
            ⚠️ Repeated violations may result in a permanent ban.
          </p>
        </div>
      </div>
    </div>
  );
}
