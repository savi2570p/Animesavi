import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import { subscribeUpload, type UploadSpeedSnapshot } from '@/lib/uploadSpeedTracker';

// Panel that compares live measured transferred-bytes throughput vs. the
// browser's reported downlink (navigator.connection.downlink, in Mbps).
// Flags mismatches outside a small tolerance so uploaders can spot when
// the displayed speed is out of sync with the network.

const TOLERANCE_RATIO = 0.35; // ±35 % window vs browser rate

function formatBps(bps: number): string {
  if (bps <= 0) return '0 KB/s';
  if (bps >= 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
}

function toMbps(bps: number): number {
  return (bps * 8) / 1_000_000;
}

interface Connectionish {
  downlink?: number;
  effectiveType?: string;
}

function getBrowserDownlinkMbps(): number | null {
  if (typeof navigator === 'undefined') return null;
  const c = (navigator as Navigator & { connection?: Connectionish }).connection;
  if (!c || typeof c.downlink !== 'number' || c.downlink <= 0) return null;
  return c.downlink;
}

export function SpeedValidationPanel() {
  const [snap, setSnap] = useState<UploadSpeedSnapshot | null>(null);
  const [browserMbps, setBrowserMbps] = useState<number | null>(getBrowserDownlinkMbps());

  useEffect(() => subscribeUpload(setSnap), []);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const c = (navigator as Navigator & { connection?: Connectionish & { addEventListener?: (t: string, cb: () => void) => void; removeEventListener?: (t: string, cb: () => void) => void } }).connection;
    if (!c?.addEventListener) return;
    const onChange = () => setBrowserMbps(getBrowserDownlinkMbps());
    c.addEventListener('change', onChange);
    return () => c.removeEventListener?.('change', onChange);
  }, []);

  if (!snap || !snap.isActive) return null;

  const measuredMbps = toMbps(snap.bytesPerSecond);
  const hasBrowser = browserMbps !== null && browserMbps > 0;
  const ratio = hasBrowser ? measuredMbps / (browserMbps as number) : 1;
  const withinTolerance = !hasBrowser
    ? true
    : Math.abs(1 - ratio) <= TOLERANCE_RATIO;

  const elapsedSec = Math.max((performance.now() - snap.startedAt) / 1000, 0.001);
  const avgBps = snap.bytesUploaded / elapsedSec;

  return (
    <div className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-2">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Speed Validation</span>
        {withinTolerance ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-emerald-500">
            <CheckCircle2 className="h-3 w-3" /> In range
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-amber-500">
            <AlertTriangle className="h-3 w-3" /> Divergent
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 rounded bg-background/50 border border-border/40">
          <div className="text-[10px] uppercase text-muted-foreground">Measured</div>
          <div className="font-mono font-semibold">{formatBps(snap.bytesPerSecond)}</div>
          <div className="text-[10px] text-muted-foreground">{measuredMbps.toFixed(2)} Mbps</div>
        </div>
        <div className="p-2 rounded bg-background/50 border border-border/40">
          <div className="text-[10px] uppercase text-muted-foreground">Avg</div>
          <div className="font-mono font-semibold">{formatBps(avgBps)}</div>
          <div className="text-[10px] text-muted-foreground">{toMbps(avgBps).toFixed(2)} Mbps</div>
        </div>
        <div className="p-2 rounded bg-background/50 border border-border/40">
          <div className="text-[10px] uppercase text-muted-foreground">Browser</div>
          <div className="font-mono font-semibold">
            {hasBrowser ? `${(browserMbps as number).toFixed(1)} Mbps` : 'N/A'}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {hasBrowser ? `±${Math.round(TOLERANCE_RATIO * 100)}% window` : 'unsupported'}
          </div>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground">
        Transferred {(snap.bytesUploaded / (1024 * 1024)).toFixed(1)} MB
        {snap.bytesTotal > 0 && ` / ${(snap.bytesTotal / (1024 * 1024)).toFixed(1)} MB`}
        {hasBrowser && ` — ratio ${(ratio).toFixed(2)}×`}
      </div>
    </div>
  );
}
