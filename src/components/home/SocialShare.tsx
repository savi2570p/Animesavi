import { Button } from '@/components/ui/button';
import { MessageCircle, Share2 } from 'lucide-react';

interface SocialShareProps {
  className?: string;
}

export function SocialShare({ 
  className = ''
}: SocialShareProps) {
  const telegramChannelUrl = 'https://t.me/AnimeSaviInhindiDUB';

  const handleTelegramClick = () => {
    window.open(telegramChannelUrl, '_blank');
  };

  return (
    <div className={`bg-card/50 backdrop-blur border border-border/50 rounded-2xl p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Share2 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Share with Friends</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        Join our Telegram channel for updates!
      </p>

      <div className="flex flex-wrap gap-3">
        {/* Telegram */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-[#0088cc]/10 border-[#0088cc]/30 hover:bg-[#0088cc]/20 text-[#0088cc]"
          onClick={handleTelegramClick}
        >
          <MessageCircle className="h-4 w-4" />
          Telegram
        </Button>
      </div>
    </div>
  );
}
