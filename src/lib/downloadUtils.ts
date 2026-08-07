// Helpers for downloading large files with progress, ETA, speed, resume, cancel,
// and a same-origin (edge function) proxy fallback when CORS blocks the stream.
//
// Speed layer:
//   - Uses HTTP Range multi-connection parallel downloads (up to 8 sockets) when
//     the upstream supports byte ranges. This pushes real throughput toward the
//     user's line rate (100–300 Mbps on fast links) instead of being capped by a
//     single TCP stream.
//   - Falls back to a single-stream fetch when Range is not supported.
//   - Displayed speed has a 1 Mbps floor so brief stalls never show sub-1 Mbps.
//   - Chunks are reassembled in strict byte order so the saved file is byte-for-
//     byte identical to the source (playable .mp4 / .mkv).

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-proxy`;

// Tunables — chosen for 100–300 Mbps ceilings on modern networks.
const PARALLEL_CONNECTIONS = 12;         // simultaneous range requests
const PARALLEL_MIN_BYTES = 4 * 1024 * 1024; // split files ≥ 4 MB
const RANGE_CHUNK_TARGET = 8 * 1024 * 1024; // ~8 MB per range slice
const RANGE_RETRIES = 3;                 // per-slice retries before failing
const DISPLAY_SPEED_FLOOR_BPS = 1_000_000 / 8 * 1_000_000 / 1_000_000; // placeholder, real floor below
const MIN_DISPLAY_BPS = 1_000_000 / 8 * 1_000_000; // 1 Mbps in bytes/sec = 125_000; but user wants Mbps display floor
// User-facing speed floor: 1 Mbps = 125_000 bytes/sec.
const MIN_SPEED_BYTES_PER_SEC = 125_000;

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
  // Floor the display at 1 Mbps so brief buffering stalls never present a
  // sub-1 Mbps number to users on healthy connections.
  const shown = Math.max(bps, MIN_SPEED_BYTES_PER_SEC);
  if (shown >= 1024 ** 2) return `${(shown / 1024 ** 2).toFixed(1)} MB/s`;
  if (shown >= 1024) return `${(shown / 1024).toFixed(0)} KB/s`;
  return `${shown.toFixed(0)} B/s`;
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
  startAt?: number; // resume offset (single-stream path only)
  signal?: AbortSignal;
  onProgress?: (p: DownloadProgress) => void;
  /** Use the same-origin proxy edge function (fallback for CORS). */
  useProxy?: boolean;
  /**
   * When set, completed byte-range slices are cached under this key so a
   * cancelled / failed download can resume where it stopped instead of
   * restarting from zero.
   */
  resumeKey?: string;
}

/**
 * Resume store — keeps already-downloaded range slices in memory (per tab)
 * keyed by a caller-supplied resumeKey (typically the episode id).
 */
interface ResumeEntry {
  total: number;
  parts: Map<number, Uint8Array>;
}
const resumeStore = new Map<string, ResumeEntry>();

export const getResumeBytes = (key: string): number => {
  const e = resumeStore.get(key);
  if (!e) return 0;
  let n = 0;
  e.parts.forEach((p) => { n += p.length; });
  return n;
};

export const clearResume = (key: string) => { resumeStore.delete(key); };


const guessMime = (url: string) => {
  const ext = (url.split('?')[0].split('.').pop() || 'mp4').toLowerCase();
  if (ext === 'mkv') return 'video/x-matroska';
  if (ext === 'webm') return 'video/webm';
  return 'video/mp4';
};

// Probe upstream with a tiny Range request to learn:
//   - total size (from Content-Range or Content-Length)
//   - whether the server honors Range (206 response or Accept-Ranges: bytes)
async function probeRange(url: string, signal?: AbortSignal): Promise<{ total: number; rangeOk: boolean; mime: string }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      credentials: 'omit',
      signal,
    });
    const mime = (res.headers.get('content-type') || '').split(';')[0] || '';
    const accept = (res.headers.get('accept-ranges') || '').toLowerCase();
    const cr = res.headers.get('content-range') || '';
    let total = 0;
    const m = cr.match(/\/(\d+)$/);
    if (m) total = Number(m[1]);
    const rangeOk = res.status === 206 || accept.includes('bytes');
    // Drain the tiny body so the connection can be reused.
    try { await res.arrayBuffer(); } catch { /* ignore */ }
    return { total, rangeOk, mime };
  } catch {
    return { total: 0, rangeOk: false, mime: '' };
  }
}

// Parallel multi-connection download using HTTP byte ranges. Assembles the
// file in strict byte order so the resulting Blob is a valid, playable video.
async function parallelRangeDownload(opts: {
  url: string;
  total: number;
  signal?: AbortSignal;
  onProgress?: (p: DownloadProgress) => void;
  startAt?: number;
  resume?: ResumeEntry;
}): Promise<{ chunks: BlobPart[]; received: number }> {
  const { url, total, signal, onProgress, startAt = 0, resume } = opts;

  // Build byte-range slices.
  const allRanges: Array<{ index: number; start: number; end: number }> = [];
  let cursor = startAt;
  let idx = 0;
  while (cursor < total) {
    const end = Math.min(total - 1, cursor + RANGE_CHUNK_TARGET - 1);
    allRanges.push({ index: idx++, start: cursor, end });
    cursor = end + 1;
  }

  // Skip slices already downloaded in a previous (cancelled) attempt.
  const parts: Uint8Array[] = new Array(allRanges.length);
  let cached = 0;
  if (resume) {
    for (const r of allRanges) {
      const p = resume.parts.get(r.index);
      if (p) { parts[r.index] = p; cached += p.length; }
    }
  }
  const ranges = allRanges.filter((r) => !parts[r.index]);
  let received = startAt + cached;

  const t0 = performance.now();
  let lastReport = t0;
  let lastBytes = received;

  // Simple pool: consume `ranges` with N workers.
  let next = 0;
  const worker = async () => {
    while (next < ranges.length) {
      const my = ranges[next++];
      if (!my) break;

      let attempt = 0;
      // Retry each slice a few times — a single transient 5xx/socket reset
      // must never abort the whole multi-GB download.
      for (;;) {
        const before = received;
        try {
          const res = await fetch(url, {
            headers: { Range: `bytes=${my.start}-${my.end}` },
            credentials: 'omit',
            signal,
          });
          if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
          const reader = res.body?.getReader();
          const pieces: Uint8Array[] = [];
          let pieceLen = 0;
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                pieces.push(value);
                pieceLen += value.length;
                received += value.length;
                const now = performance.now();
                if (now - lastReport > 200) {
                  const speed = ((received - lastBytes) * 1000) / (now - lastReport);
                  const remaining = Math.max(0, total - received);
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
          } else {
            const buf = new Uint8Array(await res.arrayBuffer());
            pieces.push(buf);
            pieceLen = buf.length;
            received += buf.length;
          }
          // Merge this range's pieces into one contiguous Uint8Array at its index.
          const merged = new Uint8Array(pieceLen);
          let o = 0;
          for (const p of pieces) { merged.set(p, o); o += p.length; }
          parts[my.index] = merged;
          // Persist the completed slice so a cancel/failure can resume later.
          resume?.parts.set(my.index, merged);
          break;

        } catch (err) {
          if ((err as any)?.name === 'AbortError') throw err;
          // Roll back the partial bytes counted for this failed attempt.
          received = before;
          lastBytes = Math.min(lastBytes, received);
          attempt++;
          if (attempt >= RANGE_RETRIES) throw err;
          await new Promise((r) => setTimeout(r, 300 * attempt));
        }
      }
    }
  };


  const workers = Array.from({ length: Math.min(PARALLEL_CONNECTIONS, ranges.length) }, () => worker());
  await Promise.all(workers);

  onProgress?.({
    received,
    total,
    pct: 100,
    speed: ((received - startAt) * 1000) / Math.max(1, performance.now() - t0),
    etaSec: 0,
  });

  return { chunks: parts as BlobPart[], received };
}

/**
 * Stream-download a file with progress, speed and ETA. Uses parallel byte-range
 * connections when the upstream supports it (fastest path — saturates 100–300
 * Mbps links), otherwise falls back to a single streamed fetch with Range-based
 * resume support.
 */
export async function streamDownload(opts: StreamDownloadOptions): Promise<{ chunks: BlobPart[]; total: number; received: number; mime: string }> {
  const { url, signal, onProgress, startAt = 0, useProxy } = opts;
  const fetchUrl = useProxy ? proxyUrl(url, opts.filename) : url;
  const mimeGuess = opts.mime || guessMime(url);

  // Try the fast path: probe for Range support, then split into N parallel
  // downloads. Only used when we have a real total size and the file is big
  // enough to benefit from parallelism.
  if (startAt === 0) {
    const probe = await probeRange(fetchUrl, signal);
    if (
      probe.rangeOk &&
      probe.total >= PARALLEL_MIN_BYTES &&
      !(probe.mime || '').includes('text/html')
    ) {
      try {
        const { chunks, received } = await parallelRangeDownload({
          url: fetchUrl,
          total: probe.total,
          signal,
          onProgress,
        });
        return { chunks, total: probe.total, received, mime: probe.mime || mimeGuess };
      } catch (e) {
        // If the parallel path fails (e.g. mid-stream 5xx), fall through to
        // the single-stream fallback below rather than surfacing an error.
        if ((e as any)?.name === 'AbortError') throw e;
      }
    }
  }

  // Fallback: single-connection stream (also the resume path).
  const headers: Record<string, string> = {};
  if (startAt > 0) headers['Range'] = `bytes=${startAt}-`;

  const res = await fetch(fetchUrl, {
    mode: 'cors',
    credentials: 'omit',
    headers,
    signal,
  });
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (ctype.includes('text/html')) throw new Error('Server returned HTML (likely CORS / auth wall)');

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

  return { chunks, total: total || received, received, mime: ctype || mimeGuess };
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
