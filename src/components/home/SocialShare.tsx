import { Button } from '@/components/ui/button';
import {
  Copy,
  Check,
  Send,
  Twitter,
  Facebook,
  Instagram,
  Camera,
  Sparkles,
  MessageSquareText,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface SocialShareProps {
  className?: string;
}

type Template = {
  id: string;
  label: string;
  text: string;
  // Visual swatch for the picker + the gradient applied to the poster preview
  swatch: string;
  poster: string;
  tagline: string;
};

const MESSAGE_TEMPLATES: Template[] = [
  {
    id: 'crimson',
    label: 'Crimson',
    text: "Hey! I've been watching anime on AnimeSavi — free HD streaming, no ads, even 4K. You should check it out 👇",
    swatch: 'from-primary to-rose-800',
    poster: 'from-primary via-rose-700 to-rose-950',
    tagline: 'Join the evolution of anime',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    text: '🔥 Found the cleanest anime site ever — AnimeSavi. Free 4K, Hindi dubs, watch parties, the works. Drop everything and try it:',
    swatch: 'from-zinc-700 to-zinc-950',
    poster: 'from-zinc-700 via-zinc-900 to-black',
    tagline: 'Late-night, lossless, legendary',
  },
  {
    id: 'azure',
    label: 'Azure',
    text: 'Free HD anime, zero ads. AnimeSavi 👉',
    swatch: 'from-blue-600 to-indigo-900',
    poster: 'from-blue-600 via-indigo-800 to-indigo-950',
    tagline: 'Stream sharper than ever',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    text: "I'm watching anime on AnimeSavi and want you to join me. We can do watch parties together! Sign up here:",
    swatch: 'from-emerald-600 to-teal-900',
    poster: 'from-emerald-600 via-teal-800 to-teal-950',
    tagline: 'Better with your crew',
  },
];

export function SocialShare({ className = '' }: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const [templateId, setTemplateId] = useState(MESSAGE_TEMPLATES[0].id);

  const websiteUrl = 'https://animesavi.com';
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
    try {
      await navigator.clipboard.writeText(fullMessage);
      toast.success(`Message copied — paste it on ${name}!`, { duration: 2500 });
    } catch {
      // ignore clipboard failure
    }
    window.open(url, '_blank');
  };

  const shareOptions = [
    {
      name: 'Telegram',
      icon: Send,
      url: `https://t.me/share/url?url=${encodeURIComponent(websiteUrl)}&text=${encodeURIComponent(template.text)}`,
    },
    {
      name: 'X',
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(websiteUrl)}&text=${encodeURIComponent(template.text)}`,
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(websiteUrl)}&quote=${encodeURIComponent(template.text)}`,
    },
    {
      name: 'Instagram',
      icon: Instagram,
      url: 'https://www.instagram.com/',
    },
    {
      name: 'Snapchat',
      icon: Camera,
      url: 'https://www.snapchat.com/',
    },
  ];

  return (
    <div className={`relative group ${className}`}>
      {/* Animated background aura */}
      <div
        aria-hidden
        className="absolute -inset-4 bg-primary/5 rounded-[2.5rem] blur-3xl pointer-events-none"
      />

      <div className="relative bg-card/40 border border-border/40 rounded-[2rem] overflow-hidden backdrop-blur-2xl shadow-2xl">
        <div className="flex flex-col lg:flex-row">
          {/* Left: Configuration */}
          <div className="flex-1 p-6 md:p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-border/40">
            <h3 className="font-heading text-2xl font-bold text-foreground mb-2">
              Share with <span className="anime-gradient-text">friends</span>
            </h3>
            <p className="text-muted-foreground text-sm mb-6 md:mb-8">
              Choose a theme and spread the word about AnimeSavi.
            </p>

            <div className="space-y-6 md:space-y-8">
              {/* Template Picker */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-3">
                  Select Template
                </label>
                <div className="flex gap-3 flex-wrap">
                  {MESSAGE_TEMPLATES.map(t => {
                    const active = t.id === templateId;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTemplateId(t.id)}
                        title={t.label}
                        aria-label={`Template: ${t.label}`}
                        aria-pressed={active}
                        className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${t.swatch} transition-all shadow-lg ${
                          active
                            ? 'border-2 border-foreground ring-2 ring-primary/30 scale-105'
                            : 'border border-border/40 hover:border-border/80'
                        }`}
                      >
                        {active && (
                          <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Social Grid */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-3">
                  Quick Share
                </label>
                <div className="grid grid-cols-5 gap-2 md:gap-3">
                  {shareOptions.map(option => (
                    <button
                      key={option.name}
                      onClick={() => handleShareOption(option.url, option.name)}
                      aria-label={`Share on ${option.name}`}
                      className="group/icon aspect-square flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-background/40 border border-border/40 hover:bg-background/60 hover:border-primary/50 transition-all"
                    >
                      <option.icon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover/icon:text-primary transition-colors" />
                      <span className="text-[9px] md:text-[10px] font-semibold text-muted-foreground group-hover/icon:text-foreground transition-colors">
                        {option.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Poster Preview */}
          <div className="w-full lg:w-[380px] p-6 md:p-8 lg:p-10 bg-background/40">
            <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden shadow-2xl">
              <div
                className={`absolute inset-0 bg-gradient-to-t ${template.poster} flex flex-col justify-end p-6 transition-all duration-500`}
              >
                <div className="absolute top-6 left-6 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                    Must Watch
                  </span>
                </div>
                <div className="space-y-2">
                  <h4 className="font-heading text-3xl font-black text-white leading-tight">
                    AnimeSavi
                    <br />
                    Experience
                  </h4>
                  <p className="text-white/80 text-[10px] font-medium uppercase tracking-widest">
                    {template.tagline}
                  </p>
                </div>
              </div>
              <div className="absolute inset-0 border border-white/10 rounded-2xl pointer-events-none" />
            </div>

            {/* Copy Actions */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 bg-card/80 border border-border/40 rounded-xl p-2 pl-3">
                <code className="flex-1 text-xs text-muted-foreground truncate font-mono">
                  {websiteUrl.replace(/^https?:\/\//, '')}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyLink}
                  className="h-7 px-3 rounded-lg bg-background/60 hover:bg-background text-foreground text-[10px] font-bold uppercase tracking-wider gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy
                    </>
                  )}
                </Button>
              </div>
              <Button
                onClick={handleCopyMessage}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-rose-700 hover:opacity-95 text-primary-foreground text-xs font-bold uppercase tracking-widest shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.7)] gap-2"
              >
                {msgCopied ? (
                  <>
                    <Check className="h-4 w-4" /> Copied to clipboard
                  </>
                ) : (
                  <>
                    <MessageSquareText className="h-4 w-4" /> Copy message + link
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
