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

export function ReportButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (!message.trim()) {
      toast.error('Please describe your issue');
      return;
    }

    const text = `🚨 Report from AnimeSavi\n\nPage: ${window.location.pathname}\n\n${message.trim()}`;
    const url = `https://t.me/Lv_Savi?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    toast.success('Opening Telegram to send your report');
    setMessage('');
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
          <Textarea
            placeholder="Describe the problem you're facing..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[100px] resize-none"
            maxLength={500}
          />
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
