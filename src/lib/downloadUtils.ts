// Helpers for downloading large files with progress, ETA, speed, resume, cancel,
// and a same-origin (edge function) proxy fallback when CORS blocks the stream.

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-proxy`;

export const proxyUrl = (url: string, filename?: string) => {
  const u = new URL(PROXY_URL);
  u.searchParams.set('url', url);
  if (filename) u.searchParams.set('filename', filename);
  return u.toString();
};

export const fmtSize = (b: number | null | undefined) => {
  if (!b || b <= 0) return '—';
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
};

export const fmtSpeed = (bps: number) => {
  if (!bps || bps < 0) return '—';
  if (bps >= 1024 ** 2) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
  if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
};

export const fmtEta = (sec: number) => {
  if (!isFinite(sec) || sec <= 0) return '—';
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`;
  return `${Math.ceil(sec)}s`;
};

export interface DownloadProgress {
  received: number;
  total: number;
  pct: number;
  speed: number; // bytes per second
  etaSec: number;
}

export interface StreamDownloadOptions {
  url: string;
  filename: string;
  mime?: string;
  startAt?: number; // resume offset
  signal?: AbortSignal;
  onProgress?: (p: DownloadProgress) => void;
  /** Use the same-origin proxy edge function (fallback for CORS). */
  useProxy?: boolean;
}

const guessMime = (url: string) => {
  const ext = (url.split('?')[0].split('.').pop() || 'mp4').toLowerCase();
  if (ext === 'mkv') return 'video/x-matroska';
  if (ext === 'webm') return 'video/webm';
  return 'video/mp4';
};

/**
 * Stream-download a file with progress, speed and ETA. Supports Range-based resume.
 * Returns the assembled chunks plus actual total size. Throws on cancel / error.
 */
export async function streamDownload(opts: StreamDownloadOptions): Promise<{ chunks: BlobPart[]; total: number; received: number; mime: string }> {
  const { url, signal, onProgress, startAt = 0, useProxy } = opts;
  const fetchUrl = useProxy ? proxyUrl(url, opts.filename) : url;
  const mime = opts.mime || guessMime(url);

  const headers: Record<string, string> = {};
  if (startAt > 0) headers['Range'] = `bytes=${startAt}-`;

  const res = await fetch(fetchUrl, {
    mode: useProxy ? 'cors' : 'cors',
    credentials: 'omit',
    headers,
    signal,
  });
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (ctype.includes('text/html')) throw new Error('Server returned HTML (likely CORS / auth wall)');

  // Resolve real total — content-range when resuming, otherwise content-length+startAt
  let total = 0;
  const cr = res.headers.get('content-range');
  if (cr) {
    const m = cr.match(/\/(\d+)$/);
    if (m) total = Number(m[1]);
  }
  if (!total) {
    const cl = Number(res.headers.get('content-length') || '0');
    total = cl > 0 ? cl + startAt : 0;
  }

  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let received = startAt;
  const start = performance.now();
  let lastReport = start;
  let lastBytes = received;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;

      const now = performance.now();
      if (now - lastReport > 200) {
        const speed = ((received - lastBytes) * 1000) / (now - lastReport);
        const remaining = total > 0 ? Math.max(0, total - received) : 0;
        const etaSec = speed > 0 && remaining > 0 ? remaining / speed : 0;
        onProgress?.({
          received,
          total,
          pct: total > 0 ? Math.min(99.9, (received / total) * 100) : 0,
          speed,
          etaSec,
        });
        lastReport = now;
        lastBytes = received;
      }
    }
  }

  onProgress?.({
    received,
    total: total || received,
    pct: 100,
    speed: ((received - startAt) * 1000) / Math.max(1, performance.now() - start),
    etaSec: 0,
  });

  return { chunks, total: total || received, received, mime };
}

/** Save assembled chunks as a downloaded file via blob URL. */
export function saveBlob(chunks: BlobPart[], mime: string, filename: string) {
  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
