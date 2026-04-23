import { Button } from '@/components/ui/button';
import { Share2, Copy, Check, Send, Twitter, Facebook, Instagram, Camera, Sparkles, Heart } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface SocialShareProps {
  className?: string;
}

export function SocialShare({ className = '' }: SocialShareProps) {
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
      icon: Send,
      url: `https://t.me/share/url?url=${encodeURIComponent(websiteUrl)}&text=${encodeURIComponent('Check out Anime Savi - Free HD Anime Streaming!')}`,
      gradient: 'from-sky-400 to-blue-500',
      ring: 'hover:ring-sky-400/50',
    },
    {
      name: 'X / Twitter',
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(websiteUrl)}&text=${encodeURIComponent('Check out Anime Savi - Free HD Anime Streaming!')}`,
      gradient: 'from-zinc-700 to-black',
      ring: 'hover:ring-foreground/50',
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(websiteUrl)}`,
      gradient: 'from-blue-500 to-blue-700',
      ring: 'hover:ring-blue-500/50',
    },
    {
      name: 'Instagram',
      icon: Instagram,
      url: `https://www.instagram.com/`,
      gradient: 'from-fuchsia-500 via-rose-500 to-amber-500',
      ring: 'hover:ring-rose-500/50',
    },
    {
      name: 'Snapchat',
      icon: Camera,
      url: `https://www.snapchat.com/`,
      gradient: 'from-yellow-300 to-yellow-500',
      ring: 'hover:ring-yellow-400/50',
    },
  ];

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-card/80 via-card/50 to-card/30 backdrop-blur-sm border border-border/50 rounded-3xl p-5 md:p-6 ${className}`}
    >
      {/* Decorative blobs */}
      <div aria-hidden className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div aria-hidden className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="relative shrink-0">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary via-rose-500 to-purple-500 shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.7)]">
              <Share2 className="h-5 w-5 text-white" />
            </div>
            <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-primary animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading font-bold text-lg md:text-xl leading-tight">
                Share with <span className="anime-gradient-text">Friends</span>
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-primary/15 text-primary border border-primary/30">
                <Heart className="h-2.5 w-2.5 fill-current" />
                Spread love
              </span>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
              Help others discover free HD anime
            </p>
          </div>
        </div>

        {/* Copy link */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="w-full justify-between gap-2 h-11 mb-4 rounded-xl bg-background/50 hover:bg-primary/10 hover:border-primary/40 transition-all group"
        >
          <span className="flex items-center gap-2 text-xs md:text-sm font-mono text-muted-foreground truncate">
            <span className="opacity-60">🔗</span>
            animesavi.lovable.app
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 group-hover:text-primary transition-colors" />
                Copy
              </>
            )}
          </span>
        </Button>

        {/* Share grid */}
        <div className="grid grid-cols-5 gap-2 md:gap-3">
          {shareOptions.map((option) => (
            <button
              key={option.name}
              onClick={() => window.open(option.url, '_blank')}
              aria-label={`Share on ${option.name}`}
              className={`group relative flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-card/40 border border-border/40 backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-lg ring-1 ring-transparent ${option.ring}`}
            >
              <div
                className={`p-2.5 rounded-xl bg-gradient-to-br ${option.gradient} shadow-md group-hover:shadow-xl transition-shadow`}
              >
                <option.icon className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <span className="text-[10px] md:text-[11px] font-medium text-foreground/80 group-hover:text-foreground truncate max-w-full">
                {option.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
