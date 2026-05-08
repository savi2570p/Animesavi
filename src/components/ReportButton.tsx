import { useEffect, useRef, useState } from 'react';
import {
  Flag, Send, X, Sparkles, Bug, PlayCircle, Volume2, Palette, Zap, Lightbulb,
  Lock, Server, Download, Bell, FileWarning, MoreHorizontal,
  ImagePlus, Trash2, Paperclip,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hide on embed routes
  const isEmbed = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/embed/') ||
    new URLSearchParams(window.location.search).get('embed') === 'true'
  );

  // Generate / cleanup preview URL
  useEffect(() => {
    if (!screenshot) {
      setScreenshotPreview(null);
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setScreenshotPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  // Allow pasting an image directly into the dialog
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      if (!item) return;
      const file = item.getAsFile();
      if (file) {
        handlePickFile(file);
        e.preventDefault();
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open]);

  if (isEmbed) return null;

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  const handlePickFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('Image is too large. Max 5MB.');
      return;
    }
    setScreenshot(file);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePickFile(file);
    e.target.value = '';
  };

  const removeScreenshot = () => setScreenshot(null);

  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
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

    setIsSending(true);

    // Upload screenshot to public storage so Telegram renders it as an inline
    // photo preview from the URL — no manual attach step needed.
    let screenshotUrl: string | null = null;
    if (screenshot) {
      try {
        const ext = (screenshot.name.split('.').pop() || 'png').toLowerCase();
        const stamp = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        const path = `reports/${stamp}-${rand}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('anime-thumbnails')
          .upload(path, screenshot, {
            contentType: screenshot.type || 'image/png',
            upsert: false,
          });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('anime-thumbnails').getPublicUrl(path);
        screenshotUrl = data.publicUrl;
      } catch (err) {
        console.error('[Report] screenshot upload failed', err);
        toast.error('Could not upload screenshot — sending report without it');
      }
    }

    const screenshotLine = screenshotUrl
      ? `\n📎 Screenshot: ${screenshotUrl}`
      : '';

    const text = `🚨 Report from AnimeSavi\n\n📂 Category: ${category}\n📄 Page: ${window.location.pathname}\n📱 Device: ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}\n🖥️ OS: ${osInfo}\n🌐 Browser: ${browserInfo}\n📐 Screen: ${window.innerWidth}x${window.innerHeight}\n🕐 Time: ${new Date().toLocaleString('en-IN')}${screenshotLine}\n\n💬 Details:\n${message.trim()}`;

    setIsSending(false);
    toast.success(screenshotUrl ? 'Opening Telegram with your screenshot' : 'Opening Telegram to send your report');

    const tgUrl = `https://t.me/Lv_Savi?text=${encodeURIComponent(text)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');

    setMessage('');
    setCategory('');
    setScreenshot(null);
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

            {/* Optional screenshot */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Screenshot <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span>
                </label>
                {screenshot && (
                  <span className="text-[10px] font-medium text-primary truncate max-w-[55%]">
                    {(screenshot.size / 1024).toFixed(0)} KB
                  </span>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFileInputChange}
                className="hidden"
              />

              {!screenshotPreview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed border-border/60 bg-muted/30 hover:bg-muted/60 hover:border-destructive/50 text-muted-foreground hover:text-foreground transition-all"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span className="text-[11.5px] font-medium">
                    Click to upload <span className="text-muted-foreground/70">or paste an image</span>
                  </span>
                </button>
              ) : (
                <div className="relative group/img rounded-lg overflow-hidden border border-border/60 bg-black/40">
                  <img
                    src={screenshotPreview}
                    alt="Report screenshot preview"
                    className="w-full max-h-48 object-contain"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-2.5 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[10.5px] font-medium text-white/90 hover:text-white inline-flex items-center gap-1"
                    >
                      <ImagePlus className="h-3 w-3" />
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={removeScreenshot}
                      className="text-[10.5px] font-medium text-destructive-foreground bg-destructive/80 hover:bg-destructive px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Info chip */}
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/40">
              <Paperclip className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                Your report opens in <span className="font-semibold text-foreground">Telegram</span> with page, device, OS &amp; browser info.
                {' '}Attached screenshots are uploaded and sent as a previewable image link — Telegram renders it inline as a photo.
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
              disabled={!canSend || isSending}
              className="min-w-[140px] shadow-md shadow-destructive/25"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {isSending ? 'Uploading…' : 'Send Report'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
