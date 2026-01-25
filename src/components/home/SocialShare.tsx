import { Button } from '@/components/ui/button';
import { Share2, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface SocialShareProps {
  className?: string;
}

export function SocialShare({ 
  className = ''
}: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const websiteUrl = 'https://animesavi.lovable.app';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(websiteUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const shareOptions = [
    {
      name: 'Telegram',
      icon: '📱',
      url: `https://t.me/share/url?url=${encodeURIComponent(websiteUrl)}&text=${encodeURIComponent('Check out Anime Savi - Free HD Anime Streaming!')}`,
      color: 'bg-[#0088cc]/10 border-[#0088cc]/30 hover:bg-[#0088cc]/20 text-[#0088cc]'
    },
    {
      name: 'Twitter X',
      icon: '𝕏',
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(websiteUrl)}&text=${encodeURIComponent('Check out Anime Savi - Free HD Anime Streaming!')}`,
      color: 'bg-foreground/10 border-foreground/30 hover:bg-foreground/20 text-foreground'
    },
    {
      name: 'Facebook',
      icon: '📘',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(websiteUrl)}`,
      color: 'bg-[#1877f2]/10 border-[#1877f2]/30 hover:bg-[#1877f2]/20 text-[#1877f2]'
    },
    {
      name: 'Instagram',
      icon: '📸',
      url: `https://www.instagram.com/`,
      color: 'bg-[#e4405f]/10 border-[#e4405f]/30 hover:bg-[#e4405f]/20 text-[#e4405f]'
    },
    {
      name: 'Snapchat',
      icon: '👻',
      url: `https://www.snapchat.com/`,
      color: 'bg-[#fffc00]/10 border-[#fffc00]/30 hover:bg-[#fffc00]/20 text-[#fffc00]'
    }
  ];

  return (
    <div className={`bg-card/50 backdrop-blur border border-border/50 rounded-2xl p-4 md:p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Share2 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Share with Friends</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        Share Anime Savi with your friends!
      </p>

      {/* Copy Link Button */}
      <Button
        variant="outline"
        size="sm"
        className="gap-2 mb-4 w-full"
        onClick={handleCopyLink}
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied!' : 'Copy Website Link'}
      </Button>

      <div className="flex flex-wrap gap-2">
        {shareOptions.map((option) => (
          <Button
            key={option.name}
            variant="outline"
            size="sm"
            className={`gap-2 ${option.color}`}
            onClick={() => window.open(option.url, '_blank')}
          >
            <span>{option.icon}</span>
            <span className="hidden sm:inline">{option.name}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
