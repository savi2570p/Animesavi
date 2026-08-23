import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Copy,
  Check,
  Send,
  Twitter,
  Facebook,
  MessageCircle,
  Download,
  Sparkles,
  MessageSquareText,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

interface SocialShareProps {
  className?: string;
}

type Template = {
  id: string;
  label: string;
  text: string;
  swatch: string;
  // Hex stops used for the poster preview and the downloadable invite image
  posterStops: [string, string, string];
  tagline: string;
};

const TAGLINE = 'Anime in 4K — official Hindi dubs, same-day drops, zero ads.';

const MESSAGE_TEMPLATES: Template[] = [
  {
    id: 'crimson',
    label: 'Crimson',
    text: "Hey! I've been watching anime on AnimeSavi — free 4K HD, official Hindi dubs, zero ads. You should check it out 👇",
    swatch: 'from-primary to-rose-800',
    posterStops: ['#e11d48', '#9f1239', '#1a0408'],
    tagline: 'Join the evolution of anime',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    text: '🔥 Found the cleanest anime site ever — AnimeSavi. Free 4K, Hindi dubs, watch parties, the works. Drop everything and try it:',
    swatch: 'from-zinc-700 to-zinc-950',
    posterStops: ['#3f3f46', '#18181b', '#000000'],
    tagline: 'Late-night, lossless, legendary',
  },
  {
    id: 'azure',
    label: 'Azure',
    text: 'Free HD anime, zero ads. AnimeSavi 👉',
    swatch: 'from-blue-600 to-indigo-900',
    posterStops: ['#2563eb', '#3730a3', '#0b0a30'],
    tagline: 'Stream sharper than ever',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    text: "I'm watching anime on AnimeSavi and want you to join me. We can do watch parties together! Sign up here:",
    swatch: 'from-emerald-600 to-teal-900',
    posterStops: ['#059669', '#115e59', '#04201d'],
    tagline: 'Better with your crew',
  },
];

export function SocialShare({ className = '' }: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const [templateId, setTemplateId] = useState(MESSAGE_TEMPLATES[0].id);
  const [animeTitle, setAnimeTitle] = useState('AnimeSavi');
  const [seasonLabel, setSeasonLabel] = useState('Experience');
  const [downloading, setDownloading] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

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

  /**
   * Render the poster preview to a PNG via canvas (no external libs).
   * Keeps text crisp at 1080×1350 (4:5) and matches the live preview.
   */
  const handleDownloadInvite = async () => {
    setDownloading(true);
    try {
      const W = 1080;
      const H = 1350;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      // Gradient background (top → bottom mirrors `bg-gradient-to-t`)
      const grad = ctx.createLinearGradient(0, H, 0, 0);
      grad.addColorStop(0, template.posterStops[0]);
      grad.addColorStop(0.55, template.posterStops[1]);
      grad.addColorStop(1, template.posterStops[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Subtle vignette
      const vignette = ctx.createRadialGradient(W / 2, H / 2, W / 3, W / 2, H / 2, W);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      // "MUST WATCH" badge
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = '700 28px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('★  MUST WATCH', 72, 72);

      // Anime title (wraps if too long)
      const title = (animeTitle || 'AnimeSavi').toUpperCase();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 130px Inter, system-ui, sans-serif';
      const maxWidth = W - 144;
      const words = title.split(' ');
      const lines: string[] = [];
      let current = '';
      for (const w of words) {
        const test = current ? `${current} ${w}` : w;
        if (ctx.measureText(test).width > maxWidth && current) {
          lines.push(current);
          current = w;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);
      const baseY = H - 320 - (lines.length - 1) * 130;
      lines.forEach((line, i) => ctx.fillText(line, 72, baseY + i * 130));

      // Season / subtitle label
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 32px Inter, system-ui, sans-serif';
      ctx.fillText((seasonLabel || '').toUpperCase(), 72, H - 180);

      // Tagline
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '500 26px Inter, system-ui, sans-serif';
      ctx.fillText(TAGLINE, 72, H - 130);

      // URL footer
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = '700 28px Inter, system-ui, sans-serif';
      ctx.fillText('animesavi.com', 72, H - 80);

      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Failed to render image');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `animesavi-invite-${template.id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Invite image downloaded!');
    } catch (e) {
      console.error(e);
      toast.error('Could not generate the invite image');
    } finally {
      setDownloading(false);
    }
  };

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      url: `https://wa.me/?text=${encodeURIComponent(fullMessage)}`,
    },
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
  ];

  return (
    <div className={`relative group ${className}`}>
      <div
        aria-hidden
        className="absolute -inset-4 bg-primary/5 rounded-[2.5rem] blur-3xl pointer-events-none"
      />

      <div className="relative bg-card/40 border border-border/40 rounded-2xl overflow-hidden backdrop-blur-2xl shadow-xl">
        <div className="flex flex-col lg:flex-row">
          {/* Left: Configuration */}
          <div className="flex-1 p-4 md:p-5 border-b lg:border-b-0 lg:border-r border-border/40">
            <h3 className="font-heading text-lg font-bold text-foreground mb-1">
              Share with <span className="anime-gradient-text">friends</span>
            </h3>
            <p className="text-muted-foreground text-xs mb-4">{TAGLINE}</p>

            <div className="space-y-4">
              {/* Poster Editor */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                  Poster Editor
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    value={animeTitle}
                    onChange={e => setAnimeTitle(e.target.value.slice(0, 30))}
                    placeholder="Anime title"
                    className="bg-background/40 border-border/40 rounded-lg h-9 text-xs"
                  />
                  <Input
                    value={seasonLabel}
                    onChange={e => setSeasonLabel(e.target.value.slice(0, 24))}
                    placeholder="Season / tagline"
                    className="bg-background/40 border-border/40 rounded-lg h-9 text-xs"
                  />
                </div>
              </div>

              {/* Template Picker */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                  Select Theme
                </label>
                <div className="flex gap-2 flex-wrap">
                  {MESSAGE_TEMPLATES.map(t => {
                    const active = t.id === templateId;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTemplateId(t.id)}
                        title={t.label}
                        aria-label={`Theme: ${t.label}`}
                        aria-pressed={active}
                        className={`relative w-9 h-9 rounded-lg bg-gradient-to-br ${t.swatch} transition-all shadow-lg ${
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

              {/* One-tap Share Grid */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                  One-tap Share
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {shareOptions.map(option => (
                    <button
                      key={option.name}
                      onClick={() => handleShareOption(option.url, option.name)}
                      aria-label={`Share on ${option.name}`}
                      className="group/icon flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-background/40 border border-border/40 hover:bg-background/60 hover:border-primary/50 transition-all"
                    >
                      <option.icon className="h-4 w-4 text-muted-foreground group-hover/icon:text-primary transition-colors" />
                      <span className="text-[10px] font-semibold text-muted-foreground group-hover/icon:text-foreground transition-colors">
                        {option.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Live Poster Preview */}
          <div className="w-full lg:w-[280px] p-4 md:p-5 bg-background/40">
            <div
              ref={posterRef}
              className="relative aspect-[4/5] w-full max-w-[240px] mx-auto rounded-xl overflow-hidden shadow-xl"
            >
              <div
                className="absolute inset-0 flex flex-col justify-end p-4 transition-all duration-500"
                style={{
                  backgroundImage: `linear-gradient(to top, ${template.posterStops[0]}, ${template.posterStops[1]} 55%, ${template.posterStops[2]})`,
                }}
              >
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                    Must Watch
                  </span>
                </div>
                <div className="space-y-2">
                  <h4 className="font-heading text-xl font-black text-white leading-tight uppercase break-words">
                    {animeTitle || 'AnimeSavi'}
                  </h4>
                  {seasonLabel && (
                    <p className="text-white/85 text-xs font-semibold uppercase tracking-widest">
                      {seasonLabel}
                    </p>
                  )}
                  <p className="text-white/70 text-[10px] font-medium leading-relaxed pt-1">
                    {TAGLINE}
                  </p>
                  <p className="text-white text-[11px] font-bold pt-1">animesavi.com</p>
                </div>
              </div>
              <div className="absolute inset-0 border border-white/10 rounded-2xl pointer-events-none" />
            </div>

            {/* Copy Actions */}
            <div className="mt-4 space-y-2">
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
                className="w-full h-9 rounded-lg bg-gradient-to-r from-primary to-rose-700 hover:opacity-95 text-primary-foreground text-xs font-bold uppercase tracking-widest shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.7)] gap-2"
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
              <Button
                onClick={handleDownloadInvite}
                disabled={downloading}
                variant="outline"
                className="w-full h-9 rounded-lg border-border/60 bg-background/40 hover:bg-background text-foreground text-xs font-bold uppercase tracking-widest gap-2"
              >
                <Download className="h-4 w-4" />
                {downloading ? 'Rendering…' : 'Download invite image'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
