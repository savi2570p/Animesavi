import { useEffect, useState } from 'react';
import { AlertTriangle, ListX, VideoOff, VolumeX, Captions, CircleEllipsis, Clock, MonitorSmartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

/** The only report reasons offered — reports live in the video player only. */
export const PLAYER_REPORT_OPTIONS = [
  { value: 'Wrong Episode', icon: ListX },
  { value: 'Video Not Working', icon: VideoOff },
  { value: 'Audio Issue', icon: VolumeX },
  { value: 'Subtitle Issue', icon: Captions },
  { value: 'Something else', icon: CircleEllipsis },
] as const;

const MAX_LENGTH = 500;

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

function deviceSummary() {
  const ua = navigator.userAgent;
  const browserMatch = ua.match(/(Edg|Chrome|Firefox|Version)\/(\d+)/);
  const browser = !browserMatch ? 'Browser'
    : browserMatch[1] === 'Edg' ? `Edge ${browserMatch[2]}`
    : browserMatch[1] === 'Version' ? `Safari ${browserMatch[2]}`
    : `${browserMatch[1]} ${browserMatch[2]}`;
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
  const kind = /Mobi|iPhone|Android/.test(ua) ? 'Mobile' : /iPad|Tablet/.test(ua) ? 'Tablet' : 'Desktop';
  return `${browser} · ${os} · ${kind}`;
}

interface PlayerReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animeTitle: string;
  coverImage?: string | null;
  episodeLabel: string;
  serverLabel?: string;
  getCurrentTime: () => number;
}

/** "Report an Issue" dialog opened from the video player. */
export function PlayerReportDialog({ open, onOpenChange, animeTitle, coverImage, episodeLabel, serverLabel, getCurrentTime }: PlayerReportDialogProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [attachTime, setAttachTime] = useState(false);
  const [attachDevice, setAttachDevice] = useState(false);
  const [openedAt, setOpenedAt] = useState(0);
  const device = deviceSummary();

  // Capture the playback position at the moment the dialog opens.
  useEffect(() => {
    if (open) setOpenedAt(getCurrentTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = () => { setReason(''); setNotes(''); setAttachTime(false); setAttachDevice(false); setOpenedAt(0); };

  const submit = () => {
    if (!reason) { toast.error('Please pick what went wrong'); return; }
    const lines = [
      `⚠️ Report: ${reason}`,
      `🎬 ${animeTitle} — ${episodeLabel}${serverLabel ? ` (${serverLabel})` : ''}`,
      `📄 Page: ${window.location.pathname}`,
      attachTime ? `⏱️ Time: ${formatTime(openedAt)}` : null,
      attachDevice ? `🖥️ Device: ${device}` : null,
      notes.trim() ? `\n💬 ${notes.trim()}` : null,
    ].filter(Boolean).join('\n');
    window.open(`https://t.me/Lv_Savi?text=${encodeURIComponent(lines)}`, '_blank', 'noopener,noreferrer');
    toast.success('Opening Telegram to send your report');
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent className="sm:max-w-[440px] p-5 gap-4">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary"><AlertTriangle className="h-4 w-4" /></span>
            <div>
              <DialogTitle className="text-lg font-bold">Report an Issue</DialogTitle>
              <DialogDescription className="text-xs">Something broken with this episode? Reports go straight to the team.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-md border border-border bg-background p-2.5">
          {coverImage && <img src={coverImage} alt="" className="h-12 w-9 shrink-0 rounded object-cover" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{animeTitle}</p>
            <p className="truncate text-xs text-muted-foreground">{episodeLabel}{serverLabel ? ` • ${serverLabel}` : ''}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label="What went wrong">
          {PLAYER_REPORT_OPTIONS.map(({ value, icon: Icon }) => (
            <button key={value} type="button" className="report-ra-option" aria-pressed={reason === value} onClick={() => setReason(value)}>
              <Icon aria-hidden />{value}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Attach to report</p>
          <label className="report-ra-attach">
            <Checkbox checked={attachTime} onCheckedChange={(v) => setAttachTime(v === true)} aria-label="Include playback time" />
            <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{formatTime(openedAt)}<small>Include</small>
          </label>
          <label className="report-ra-attach">
            <Checkbox checked={attachDevice} onCheckedChange={(v) => setAttachDevice(v === true)} aria-label="Include device details" />
            <MonitorSmartphone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /><span className="truncate">{device}</span><small>Include</small>
          </label>
        </div>

        <Textarea
          placeholder="Anything else we should know? (optional)"
          value={notes}
          maxLength={MAX_LENGTH}
          onChange={(e) => setNotes(e.target.value.slice(0, MAX_LENGTH))}
          className="min-h-[80px] resize-none bg-background"
        />

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={submit} disabled={!reason}>Submit report</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
