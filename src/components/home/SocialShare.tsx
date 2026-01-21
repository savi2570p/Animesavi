import { Button } from '@/components/ui/button';
import { MessageCircle, Twitter, Facebook, Share2 } from 'lucide-react';

interface SocialShareProps {
  title?: string;
  url?: string;
  className?: string;
}

export function SocialShare({ 
  title = 'Check out Anime.Savi.me - Watch Hindi DUB Anime for Free!',
  url = typeof window !== 'undefined' ? window.location.href : 'https://animesavi.lovable.app',
  className = ''
}: SocialShareProps) {
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);

  const shareLinks = {
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Anime.Savi.me',
          text: title,
          url: url,
        });
      } catch (err) {
        // User cancelled or error
      }
    }
  };

  return (
    <div className={`bg-card/50 backdrop-blur border border-border/50 rounded-2xl p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Share2 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Share with Friends</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        Enjoying Anime.Savi.me? Share it with your friends!
      </p>

      <div className="flex flex-wrap gap-3">
        {/* Telegram */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-[#0088cc]/10 border-[#0088cc]/30 hover:bg-[#0088cc]/20 text-[#0088cc]"
          asChild
        >
          <a href={shareLinks.telegram} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" />
            Telegram
          </a>
        </Button>

        {/* Twitter/X */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-foreground/5 border-foreground/20 hover:bg-foreground/10"
          asChild
        >
          <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer">
            <Twitter className="h-4 w-4" />
            Twitter
          </a>
        </Button>

        {/* Facebook */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-[#1877f2]/10 border-[#1877f2]/30 hover:bg-[#1877f2]/20 text-[#1877f2]"
          asChild
        >
          <a href={shareLinks.facebook} target="_blank" rel="noopener noreferrer">
            <Facebook className="h-4 w-4" />
            Facebook
          </a>
        </Button>

        {/* Native Share (mobile) */}
        {typeof navigator !== 'undefined' && navigator.share && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
            More
          </Button>
        )}
      </div>
    </div>
  );
}
