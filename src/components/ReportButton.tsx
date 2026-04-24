import { useState } from 'react';
import { Flag, Send, X, Sparkles, Bug, PlayCircle, Volume2, Palette, Zap, Lightbulb, Lock, Server, Download, Bell, FileWarning, MoreHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const REPORT_CATEGORIES = [
  { label: 'Bug / Glitch', value: 'Bug', icon: Bug },
  { label: 'Video not playing', value: 'Video Issue', icon: PlayCircle },
  { label: 'Audio / Subtitle', value: 'Audio/Sub Issue', icon: Volume2 },
  { label: 'UI / Design', value: 'UI Issue', icon: Palette },
  { label: 'Slow / Laggy', value: 'Performance', icon: Zap },
  { label: 'Feature request', value: 'Feature Request', icon: Lightbulb },
  { label: 'Login / Access', value: 'Auth Issue', icon: Lock },
  { label: 'Server / Stream', value: 'Server Issue', icon: Server },
  { label: 'Download issue', value: 'Download Issue', icon: Download },
  { label: 'Notification', value: 'Notification Issue', icon: Bell },
  { label: 'Wrong info', value: 'Wrong Info', icon: FileWarning },
  { label: 'Other', value: 'Other', icon: MoreHorizontal },
] as const;

const MAX_LENGTH = 500;

export function ReportButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');

  // Hide on embed routes
  const isEmbed = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/embed/') ||
    new URLSearchParams(window.location.search).get('embed') === 'true'
  );

  if (isEmbed) return null;

  const handleSend = () => {
    if (!category) {
      toast.error('Please select a category');
      return;
    }
    if (!message.trim()) {
      toast.error('Please describe your issue');
      return;
    }

    const browserInfo = (() => {
      const ua = navigator.userAgent;
      if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
      if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
      if (ua.includes('Firefox')) return 'Firefox';
      if (ua.includes('Edg')) return 'Edge';
      return 'Other';
    })();

    const osInfo = (() => {
      const ua = navigator.userAgent;
      if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
      if (ua.includes('Android')) return 'Android';
      if (ua.includes('Windows')) return 'Windows';
      if (ua.includes('Mac')) return 'macOS';
      return 'Other';
    })();

    const text = `🚨 Report from AnimeSavi\n\n📂 Category: ${category}\n📄 Page: ${window.location.pathname}\n📱 Device: ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}\n🖥️ OS: ${osInfo}\n🌐 Browser: ${browserInfo}\n📐 Screen: ${window.innerWidth}x${window.innerHeight}\n🕐 Time: ${new Date().toLocaleString('en-IN')}\n\n💬 Details:\n${message.trim()}`;
    const url = `https://t.me/Lv_Savi?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    toast.success('Opening Telegram to send your report');
    setMessage('');
    setCategory('');
    setOpen(false);
  };

  const remaining = MAX_LENGTH - message.length;
  const canSend = !!category && message.trim().length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Report an issue"
        className="group fixed bottom-[8.25rem] right-3 md:bottom-6 md:right-[5.25rem] z-50 w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-lg shadow-destructive/40 transition-all duration-300 hover:scale-110 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.95) 0%, hsl(var(--destructive)) 60%, hsl(var(--destructive) / 0.85) 100%)',
        }}
      >
        <span className="absolute inset-0 rounded-full ring-1 ring-white/20" />
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-background animate-pulse" />
        <Flag className="relative h-4 w-4 md:h-[18px] md:w-[18px] text-destructive-foreground drop-shadow" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-md p-0 gap-0 overflow-hidden border-border/50 bg-card/95 backdrop-blur-xl"
        >
          {/* Cinematic header with destructive gradient */}
          <div
            className="relative px-5 pt-5 pb-4 border-b border-border/40"
            style={{
              background:
                'linear-gradient(135deg, hsl(var(--destructive) / 0.18) 0%, hsl(var(--destructive) / 0.04) 50%, transparent 100%)',
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-12 -right-10 w-40 h-40 rounded-full opacity-30 blur-3xl"
              style={{ background: 'hsl(var(--destructive))' }}
            />

            <DialogHeader className="space-y-1 text-left">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-destructive/30 shadow-lg shadow-destructive/20"
                  style={{
                    background:
                      'linear-gradient(135deg, hsl(var(--destructive) / 0.95), hsl(var(--destructive) / 0.7))',
                  }}
                >
                  <Flag className="h-4 w-4 text-destructive-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base font-semibold leading-tight text-foreground">
                    Report an Issue
                  </DialogTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    Helps us improve AnimeSavi for everyone
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Category grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Category
                </label>
                {category && (
                  <span className="text-[10px] font-medium text-primary">Selected</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {REPORT_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const active = category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`group/cat relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-all border text-left ${
                        active
                          ? 'bg-destructive/10 text-foreground border-destructive/60 shadow-sm shadow-destructive/20'
                          : 'bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted hover:text-foreground hover:border-border'
                      }`}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                          active ? 'text-destructive' : 'text-muted-foreground group-hover/cat:text-foreground'
                        }`}
                      />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Describe the issue
              </label>
              <div className="relative">
                <Textarea
                  placeholder="What happened? Steps to reproduce, expected vs actual…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
                  className="min-h-[110px] resize-none bg-muted/30 border-border/50 focus-visible:border-destructive/60 focus-visible:ring-destructive/20"
                  maxLength={MAX_LENGTH}
                />
                <span
                  className={`pointer-events-none absolute bottom-2 right-2.5 text-[10px] font-mono ${
                    remaining < 50 ? 'text-destructive' : 'text-muted-foreground/70'
                  }`}
                >
                  {remaining}
                </span>
              </div>
            </div>

            {/* Info chip */}
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/40">
              <Send className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                Your report will open in <span className="font-semibold text-foreground">Telegram</span>{' '}
                pre-filled with the current page, device, OS &amp; browser info.
              </p>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="px-5 py-3 border-t border-border/40 bg-background/40 backdrop-blur flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleSend}
              disabled={!canSend}
              className="min-w-[140px] shadow-md shadow-destructive/25"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
