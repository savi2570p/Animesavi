import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const REPORT_CATEGORIES = [
  { label: '🐛 Bug / Glitch', value: 'Bug' },
  { label: '▶️ Video not playing', value: 'Video Issue' },
  { label: '🔇 Audio / Subtitle issue', value: 'Audio/Sub Issue' },
  { label: '📱 UI / Design issue', value: 'UI Issue' },
  { label: '⚡ Slow / Laggy', value: 'Performance' },
  { label: '💡 Feature request', value: 'Feature Request' },
  { label: '🔒 Login / Access issue', value: 'Auth Issue' },
  { label: '📺 Server / Streaming issue', value: 'Server Issue' },
  { label: '📥 Download issue', value: 'Download Issue' },
  { label: '🔔 Notification issue', value: 'Notification Issue' },
  { label: '📝 Wrong info / Metadata', value: 'Wrong Info' },
  { label: '🔄 Other', value: 'Other' },
];

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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-20 z-50 w-9 h-9 md:w-10 md:h-10 rounded-full bg-destructive/80 hover:bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg transition-all duration-200 text-sm md:text-base"
        aria-label="Report an issue"
      >
        ⚠️
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm border-destructive/20">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              ⚠️ Report an Issue
            </DialogTitle>
          </DialogHeader>

          {/* Category selector */}
          <div className="flex flex-wrap gap-1.5">
            {REPORT_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                  category === cat.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <Textarea
            placeholder="Describe the problem you're facing..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[100px] resize-none"
            maxLength={500}
          />

          <p className="text-[10px] text-muted-foreground">
            Your report will be sent via Telegram with page & device info attached.
          </p>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={handleSend}>
              Send via Telegram
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
