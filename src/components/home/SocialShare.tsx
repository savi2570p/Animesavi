import { Button } from '@/components/ui/button';
import { Share2, Copy, Check, Send, Twitter, Facebook, Instagram, Camera, Sparkles, Heart, MessageSquareText, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface SocialShareProps {
  className?: string;
}

const MESSAGE_TEMPLATES = [
  {
    id: 'casual',
    label: '😎 Casual',
    text: "Hey! I've been watching anime on AnimeSavi — free HD streaming, no ads, even 4K. You should check it out 👇",
  },
  {
    id: 'hype',
    label: '🔥 Hype',
    text: "🔥 Found the cleanest anime site ever — AnimeSavi. Free 4K, Hindi dubs, watch parties, the works. Drop everything and try it:",
  },
  {
    id: 'short',
    label: '⚡ Short',
    text: 'Free HD anime, zero ads. AnimeSavi 👉',
  },
  {
    id: 'invite',
    label: '💌 Invite',
    text: "I'm watching anime on AnimeSavi and want you to join me. We can do watch parties together! Sign up here:",
  },
];

export function SocialShare({ className = '' }: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const [templateId, setTemplateId] = useState(MESSAGE_TEMPLATES[0].id);
  const [showTemplates, setShowTemplates] = useState(false);

  const websiteUrl = 'https://animesavi.lovable.app';
  const template = MESSAGE_TEMPLATES.find(t => t.id === templateId) || MESSAGE_TEMPLATES[0];
  const fullMessage = `${template.text} ${websiteUrl}`;

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

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(fullMessage);
      setMsgCopied(true);
      toast.success('Message + link copied — paste anywhere!');
      setTimeout(() => setMsgCopied(false), 2200);
    } catch {
      toast.error('Failed to copy message');
    }
  };

  const handleShareOption = async (url: string, name: string) => {
    // Copy the templated message first so the user can paste it
    try {
      await navigator.clipboard.writeText(fullMessage);
      toast.success(`Message copied — paste it on ${name}!`, { duration: 2500 });
    } catch {
      // ignore clipboard failure, still open share dialog
    }
    window.open(url, '_blank');
  };

  const shareOptions = [
    {
      name: 'Telegram',
      icon: Send,
      url: `https://t.me/share/url?url=${encodeURIComponent(websiteUrl)}&text=${encodeURIComponent(template.text)}`,
      gradient: 'from-sky-400 to-blue-500',
      ring: 'hover:ring-sky-400/50',
    },
    {
      name: 'X / Twitter',
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(websiteUrl)}&text=${encodeURIComponent(template.text)}`,
      gradient: 'from-zinc-700 to-black',
      ring: 'hover:ring-foreground/50',
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(websiteUrl)}&quote=${encodeURIComponent(template.text)}`,
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
              Pick a vibe, copy & share in one tap
            </p>
          </div>
        </div>

        {/* Template picker */}
        <div className="mb-3">
          <button
            onClick={() => setShowTemplates(s => !s)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-background/40 border border-border/50 hover:border-primary/40 transition-colors text-left"
          >
            <span className="flex items-center gap-2 min-w-0">
              <MessageSquareText className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs md:text-sm font-semibold truncate">
                {template.label}
              </span>
              <span className="text-[10px] md:text-xs text-muted-foreground truncate hidden sm:inline">
                — {template.text.slice(0, 38)}…
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
          </button>

          {showTemplates && (
            <div className="mt-2 grid grid-cols-2 gap-2 animate-fade-in">
              {MESSAGE_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTemplateId(t.id); setShowTemplates(false); }}
                  className={`text-left px-3 py-2 rounded-xl border transition-all text-[11px] md:text-xs ${
                    t.id === templateId
                      ? 'bg-primary/15 border-primary/50 text-foreground shadow shadow-primary/10'
                      : 'bg-card/40 border-border/40 hover:border-primary/30 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="font-bold mb-0.5">{t.label}</div>
                  <div className="line-clamp-2 opacity-80">{t.text}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message preview */}
        <div className="mb-3 p-3 rounded-xl bg-background/40 border border-dashed border-border/60 text-[11px] md:text-xs text-foreground/85 leading-relaxed">
          <span className="block">{template.text}</span>
          <span className="block mt-1 font-mono text-primary truncate">{websiteUrl}</span>
        </div>

        {/* Action row: Copy message (primary) + Copy link */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Button
            size="sm"
            onClick={handleCopyMessage}
            className="h-11 rounded-xl gap-2 bg-gradient-to-r from-primary to-rose-500 hover:opacity-95 text-primary-foreground font-semibold shadow-md shadow-primary/30"
          >
            {msgCopied ? <Check className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
            {msgCopied ? 'Copied!' : 'Copy message'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="h-11 rounded-xl gap-2 bg-background/50 hover:bg-primary/10 hover:border-primary/40"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Link copied' : 'Copy link only'}
          </Button>
        </div>

        {/* Share grid — taps copy template + open dialog */}
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-2">
          Tap to copy & share
        </p>
        <div className="grid grid-cols-5 gap-2 md:gap-3">
          {shareOptions.map((option) => (
            <button
              key={option.name}
              onClick={() => handleShareOption(option.url, option.name)}
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
