import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as tus from 'tus-js-client';
import { pickChunkSize } from '@/lib/uploadTuning';
import { beginUpload, reportUpload, endUpload } from '@/lib/uploadSpeedTracker';

interface UseFileUploadOptions {
  bucket: 'anime-videos' | 'anime-thumbnails' | 'movies';
  folder?: string;
  maxSizeGB?: number;
  /**
   * Use a deterministic storage path derived from the file itself so a failed
   * upload can be resumed (instead of restarting) when the same file is picked
   * again. Enables upsert so the partial object can be completed in place.
   */
  stablePath?: boolean;
  /** Cap chunk size (in 6MB units). Smaller chunks survive flaky mobile links. */
  maxChunkUnits?: number;
}


interface UploadResult {
  url: string;
  path: string;
}

// Size limits in GB
const SIZE_LIMITS = {
  movie: 90, // 90GB for movies
  episode: 90, // 90GB for anime episodes
  thumbnail: 1, // 1GB for thumbnails
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const RESUMABLE_UPLOAD_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/upload/resumable` : '';

// Lovable Cloud resumable storage requires chunk sizes that are multiples of
// 6 MB. The chunk size is chosen per-file at runtime (see uploadTuning.ts) so
// large files on fast links use fewer, larger round trips — a real throughput
// gain, not a cosmetic one.
// IMPORTANT: parallelUploads MUST stay at 1. tus-js-client's parallelUploads
// relies on the TUS `concatenation` extension, which the resumable storage
// endpoint does not support, causing uploads to restart mid-stream after a
// certain percentage. Keep this single-stream for reliability.
const SPEED_SAMPLE_WINDOW_MS = 3_000;
const SPEED_UPDATE_INTERVAL_MS = 200;

// Map file extensions to MIME types for cases where the browser reports empty/generic types
const VIDEO_MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  ts: 'video/mp2t',
  m4v: 'video/mp4',
};

function getVideoMimeType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return VIDEO_MIME_MAP[ext] || 'video/mp4';
}

// ---------------------------------------------------------------------------
// Resume pointers
// A tiny, explicit store (keyed by storage path) holding the TUS upload URL of
// an interrupted transfer. It is verified against the server with a HEAD probe
// before it is ever trusted, so a stale pointer can never fail an upload.
// ---------------------------------------------------------------------------
const RESUME_PREFIX = 'upload-resume:';

function resumeKey(filePath: string) {
  return `${RESUME_PREFIX}${filePath}`;
}

function readResumePointer(filePath: string): string | null {
  try {
    return localStorage.getItem(resumeKey(filePath));
  } catch {
    return null;
  }
}

function writeResumePointer(filePath: string, url: string) {
  try {
    localStorage.setItem(resumeKey(filePath), url);
  } catch {
    /* storage full / private mode — resume is best-effort */
  }
}

function clearResumePointer(filePath: string) {
  try {
    localStorage.removeItem(resumeKey(filePath));
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------------------------
// Progress snapshot
// The last known progress of an interrupted transfer, so a page refresh or a
// tab switch that unmounts the upload UI shows the real percentage again
// instead of falling back to 0%.
// ---------------------------------------------------------------------------
const SNAPSHOT_KEY = 'upload-progress-snapshot';
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

interface ProgressSnapshot {
  filePath: string;
  fileName: string;
  bytesUploaded: number;
  bytesTotal: number;
  at: number;
}

function writeSnapshot(snap: ProgressSnapshot) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  } catch { /* best effort */ }
}

function readSnapshot(): ProgressSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as ProgressSnapshot;
    if (!snap?.filePath || !snap.bytesTotal) return null;
    if (Date.now() - snap.at > SNAPSHOT_TTL_MS) return null;
    if (!readResumePointer(snap.filePath)) return null;
    return snap;
  } catch {
    return null;
  }
}

function clearSnapshot() {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch { /* noop */ }
}

/** Ask the server how many bytes it actually holds for an upload URL. */
async function probeOffset(uploadUrl: string, accessToken: string): Promise<number | null> {
  try {
    const response = await fetch(uploadUrl, {
      method: 'HEAD',
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Tus-Resumable': '1.0.0',
      },
    });
    if (!response.ok) return null;
    const offset = Number(response.headers.get('Upload-Offset'));
    return Number.isFinite(offset) ? offset : null;
  } catch {
    return null;
  }
}



// Hook to track online/offline status
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online! Resuming uploads...');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Uploads paused.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export interface UploadStats {
  fileName: string;
  bytesUploaded: number;
  bytesTotal: number;
  currentSpeed: number; // bytes/s (rolling, measured)
  averageSpeed: number; // bytes/s (measured over whole upload)
  etaSeconds: number | null;
  chunkSize: number;
  chunksDone: number;
  chunksTotal: number;
  retries: number;
  connection: 'idle' | 'stable' | 'retrying' | 'offline' | 'finalizing' | 'complete';
  storagePath: string;
  error: string | null;
  /** Bytes the server confirmed it already holds when the upload was resumed. */
  resumedFromBytes: number;
  /** True when this run continued a previously interrupted transfer. */
  resumed: boolean;
}

const emptyStats: UploadStats = {
  fileName: '',
  bytesUploaded: 0,
  bytesTotal: 0,
  currentSpeed: 0,
  averageSpeed: 0,
  etaSeconds: null,
  chunkSize: 0,
  chunksDone: 0,
  chunksTotal: 0,
  retries: 0,
  connection: 'idle',
  storagePath: '',
  error: null,
  resumedFromBytes: 0,
  resumed: false,
};


export function useFileUpload({ bucket, folder = '', maxSizeGB, stablePath = false, maxChunkUnits = 8 }: UseFileUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [displayedProgress, setDisplayedProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0); // bytes per second
  const [stats, setStats] = useState<UploadStats>(emptyStats);
  const isOnline = useOnlineStatus();
  const activeUploadRef = useRef<tus.Upload | null>(null);
  const pendingFileRef = useRef<{ file: File; filePath: string } | null>(null);
  const lastProgressRef = useRef<{ bytes: number; time: number }>({ bytes: 0, time: 0 });
  const speedSamplesRef = useRef<Array<{ bytes: number; time: number }>>([]);
  const measuredSpeedRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  // Video uploads always use a deterministic path so an interrupted transfer
  // can be continued; this ref carries that decision into the TUS headers.
  const stableRef = useRef<boolean>(stablePath);

  const patchStats = useCallback((patch: Partial<UploadStats>) => {
    setStats((prev) => ({ ...prev, ...patch }));
  }, []);

  // Restore the last known progress of an interrupted transfer (page refresh,
  // tab switch, app backgrounded) so the UI resumes where it left off instead
  // of showing 0%.
  useEffect(() => {
    if (bucket !== 'anime-videos' && bucket !== 'movies') return;
    const snap = readSnapshot();
    if (!snap) return;
    const pct = Math.min(99, Math.floor((snap.bytesUploaded / snap.bytesTotal) * 100));
    setUploadProgress(pct);
    setDisplayedProgress(pct);
    setStats({
      ...emptyStats,
      fileName: snap.fileName,
      bytesUploaded: snap.bytesUploaded,
      bytesTotal: snap.bytesTotal,
      storagePath: snap.filePath,
      resumed: true,
      resumedFromBytes: snap.bytesUploaded,
      connection: 'idle',
    });
  }, [bucket]);

  // Warn before a refresh/close would interrupt an in-flight upload.
  useEffect(() => {
    if (!isUploading) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isUploading]);


  // Auto-resume upload when coming back online
  useEffect(() => {
    if (isOnline && activeUploadRef.current && pendingFileRef.current) {
      toast.info('Resuming upload...');
      patchStats({ connection: 'stable' });
      activeUploadRef.current.start();
    } else if (!isOnline && activeUploadRef.current) {
      patchStats({ connection: 'offline' });
    }
  }, [isOnline, patchStats]);


  // Determine default max size based on bucket
  const getMaxSize = () => {
    if (maxSizeGB) return maxSizeGB * 1024 * 1024 * 1024;
    if (bucket === 'anime-thumbnails') return SIZE_LIMITS.thumbnail * 1024 * 1024 * 1024;
    if (bucket === 'movies') return SIZE_LIMITS.movie * 1024 * 1024 * 1024;
    return SIZE_LIMITS.episode * 1024 * 1024 * 1024;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(2)} KB`;
  };

  const uploadVideoResumable = async (file: File, filePath: string): Promise<UploadResult | null> => {
    if (!RESUMABLE_UPLOAD_ENDPOINT || !SUPABASE_PUBLISHABLE_KEY) {
      toast.error('Upload service is not configured');
      setIsUploading(false);
      return null;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      toast.error('Please sign in to upload');
      setIsUploading(false);
      return null;
    }

    // Check if offline before starting
    if (!navigator.onLine) {
      toast.warning('You are offline. Upload will start when you reconnect.');
      pendingFileRef.current = { file, filePath };
      return null;
    }

    console.log(`[Upload] Upload started: ${file.name}, size: ${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB (${file.size} bytes), type: ${getVideoMimeType(file)}`);
    console.log('[Upload] Uploading...');

    const chunkSize = pickChunkSize(file.size, maxChunkUnits);

    try {
      setUploadProgress(0);
      setDisplayedProgress(0);
      setUploadSpeed(0);
      measuredSpeedRef.current = 0;
      startedAtRef.current = performance.now();
      lastProgressRef.current = { bytes: 0, time: performance.now() };
      speedSamplesRef.current = [{ bytes: 0, time: performance.now() }];
      setStats({
        ...emptyStats,
        fileName: file.name,
        bytesTotal: file.size,
        chunkSize,
        chunksTotal: Math.max(1, Math.ceil(file.size / chunkSize)),
        connection: 'stable',
        storagePath: filePath,
      });
      beginUpload(file.size);


      await new Promise<void>((resolve, reject) => {
        let finalized = false;
        let finalizing = false;
        let allBytesUploaded = false;
        let completionGraceTimer: number | null = null;
        let completionWatchdog: number | null = null;
        let resumedThisRun = false;
        let staleResumeHandled = false;

        const clearCompletionTimers = () => {
          if (completionGraceTimer !== null) {
            window.clearTimeout(completionGraceTimer);
            completionGraceTimer = null;
          }
          if (completionWatchdog !== null) {
            window.clearTimeout(completionWatchdog);
            completionWatchdog = null;
          }
        };

        const finalizeUpload = () => {
          if (finalized || finalizing) return;
          finalizing = true;
          console.log('[Upload] Finalize called');
          clearCompletionTimers();
          finalized = true;
          clearResumePointer(filePath);
          clearSnapshot();

          activeUploadRef.current = null;
          pendingFileRef.current = null;
          setUploadProgress(100);
          setDisplayedProgress(100);
          reportUpload(file.size, measuredSpeedRef.current);
          speedSamplesRef.current = [];
          patchStats({
            bytesUploaded: file.size,
            bytesTotal: file.size,
            currentSpeed: 0,
            etaSeconds: 0,
            chunksDone: Math.max(1, Math.ceil(file.size / chunkSize)),
            connection: 'complete',
          });
          endUpload();
          console.log('[Upload] Storage commit...');
          console.log('[Upload] Finalize completed');
          console.log('[Upload] Progress reached 100%');
          console.log(`[Upload] Upload Complete: ${file.name}`);
          resolve();
        };

        const verifyFinalOffset = async (upload: tus.Upload): Promise<boolean> => {
          if (finalized || finalizing || !upload.url) return false;
          console.log('[Upload] Verifying...');
          try {
            const response = await fetch(upload.url, {
              method: 'HEAD',
              headers: {
                authorization: `Bearer ${accessToken}`,
                apikey: SUPABASE_PUBLISHABLE_KEY,
                'Tus-Resumable': '1.0.0',
              },
            });
            const committedOffset = Number(response.headers.get('Upload-Offset') || 0);
            if (response.ok && committedOffset >= file.size) {
              console.log('[Upload] Upload finished');
              finalizeUpload();
              return true;
            }
          } catch (error) {
            console.warn('[Upload] Finalize verification failed', error);
          }
          return false;
        };

        // The normal onSuccess path completes immediately. A one-second grace
        // check covers a missed callback, and a 5-second watchdog keeps
        // re-verifying the committed offset (never re-uploading the file), so
        // the bar can never sit at 99% while storage already holds the object.
        const scheduleFinalizeChecks = (upload: tus.Upload) => {
          if (finalized || completionGraceTimer !== null || completionWatchdog !== null) return;
          patchStats({ connection: 'finalizing' });
          completionGraceTimer = window.setTimeout(async () => {
            completionGraceTimer = null;
            await verifyFinalOffset(upload);
          }, 800);

          completionWatchdog = window.setTimeout(async () => {
            completionWatchdog = null;
            if (finalized || finalizing) return;
            const complete = await verifyFinalOffset(upload);
            if (!complete) {
              console.warn('[Upload] Finalize verification pending; retrying finalize check only');
              scheduleFinalizeChecks(upload);
            }
          }, 5_000);
        };


        const upload = new tus.Upload(file, {
          endpoint: RESUMABLE_UPLOAD_ENDPOINT,
          chunkSize,
          // Single-stream upload — parallelUploads with chunkSize triggers the
          // TUS concatenation extension, which Lovable Cloud storage rejects
          // partway through, causing the upload to restart.
          parallelUploads: 1,
          uploadDataDuringCreation: true,
          // Long, patient backoff: flaky mobile links commonly drop a chunk in
          // the first minute. Retrying instead of failing keeps the transfer alive.
          retryDelays: [0, 1000, 3000, 5000, 10000, 15000, 20000, 30000, 30000, 60000],
          storeFingerprintForResuming: true,
          removeFingerprintOnSuccess: true,
          onUploadUrlAvailable: () => {
            const url = activeUploadRef.current?.url;
            if (url) writeResumePointer(filePath, url);
          },
          // Retry on transport errors and transient server responses; only give
          // up on genuine client errors (auth/validation), never on 5xx/timeouts.
          onShouldRetry: (err) => {
            const status = (err as tus.DetailedError)?.originalResponse?.getStatus?.() ?? 0;
            if (!status) return true; // network drop / timeout
            if (status === 409 || status === 423 || status === 429) return true;
            if (status >= 500) return true;
            return false;
          },
          headers: {
            authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
            'x-upsert': stablePath ? 'true' : 'false',
          },

          metadata: {
            bucketName: bucket,
            objectName: filePath,
            contentType: getVideoMimeType(file),
            cacheControl: '3600',
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const totalBytes = bytesTotal || file.size || 1;
            const uploadComplete = bytesUploaded >= totalBytes;
            const percentage = Math.min(100, Math.max(0, (bytesUploaded / totalBytes) * 100));
            // The visible percentage is derived only from acknowledged bytes.
            // Reserve 100 for the storage completion callback or watchdog.
            const visibleProgress = uploadComplete ? 99 : Math.min(99, Math.floor(percentage));
            setUploadProgress(visibleProgress);
            setDisplayedProgress(visibleProgress);

            const now = performance.now();
            const lastProgress = lastProgressRef.current;
            const timeDiffMs = now - lastProgress.time;
            const bytesDiff = bytesUploaded - lastProgress.bytes;

            if (bytesDiff > 0 && timeDiffMs >= SPEED_UPDATE_INTERVAL_MS) {
              const samples = [
                ...speedSamplesRef.current,
                { bytes: bytesUploaded, time: now },
              ].filter((sample) => now - sample.time <= SPEED_SAMPLE_WINDOW_MS);

              const firstSample = samples[0];
              const timeWindowSeconds = Math.max((now - firstSample.time) / 1000, 0.001);
              const bytesWindow = Math.max(bytesUploaded - firstSample.bytes, bytesDiff);
              const rollingSpeed = bytesWindow / timeWindowSeconds;
              const instantSpeed = bytesDiff / (timeDiffMs / 1000);
              const measuredSpeed = Math.max(rollingSpeed, instantSpeed);

              measuredSpeedRef.current = measuredSpeed;
              setUploadSpeed(measuredSpeed);
              reportUpload(bytesUploaded, measuredSpeed);
              speedSamplesRef.current = samples;
              lastProgressRef.current = { bytes: bytesUploaded, time: now };

              const elapsedSec = Math.max((now - startedAtRef.current) / 1000, 0.001);
              const averageSpeed = bytesUploaded / elapsedSec;
              const remaining = Math.max(totalBytes - bytesUploaded, 0);
              const rate = measuredSpeed > 0 ? measuredSpeed : averageSpeed;
              patchStats({
                bytesUploaded,
                bytesTotal: totalBytes,
                currentSpeed: measuredSpeed,
                averageSpeed,
                etaSeconds: rate > 0 ? remaining / rate : null,
                chunksDone: Math.min(
                  Math.floor(bytesUploaded / chunkSize),
                  Math.max(1, Math.ceil(totalBytes / chunkSize))
                ),
                connection: 'stable',
              });
            }

            if (uploadComplete) {

              allBytesUploaded = true;
              measuredSpeedRef.current = Math.max(measuredSpeedRef.current, 0);
              reportUpload(totalBytes, measuredSpeedRef.current);
              console.log('[Upload] Upload finished');
              console.log('[Upload] Verifying...');
              scheduleFinalizeChecks(upload);
            }
          },

          onError: (err) => {
            if (finalized) return;
            if (allBytesUploaded) {
              console.warn('[Upload] Completion response failed after all bytes uploaded; preserving file and retrying finalize only', err);
              setStats((prev) => ({ ...prev, retries: prev.retries + 1, connection: 'retrying' }));
              scheduleFinalizeChecks(upload);
              return;
            }
            const status = (err as tus.DetailedError)?.originalResponse?.getStatus?.() ?? 0;
            const body = (err as tus.DetailedError)?.originalResponse?.getBody?.() ?? '';

            // A stale resume pointer (upload URL expired or the object was
            // removed) must not surface as a failure — drop the pointer and
            // start a clean transfer once.
            if (resumedThisRun && !staleResumeHandled && (status === 404 || status === 410 || status === 403 || status === 409)) {
              staleResumeHandled = true;
              resumedThisRun = false;
              console.warn('[Upload] Stale resume pointer; restarting a fresh upload', { status });
              clearCompletionTimers();
              clearResumePointer(filePath);
              patchStats({ resumed: false, resumedFromBytes: 0, connection: 'retrying' });
              window.setTimeout(() => {
                try {
                  upload.start();
                } catch (e) {
                  reject(e instanceof Error ? e : new Error(String(e)));
                }
              }, 300);
              return;
            }

            clearCompletionTimers();
            console.error('[Upload] TUS error details:', {
              message: err.message,
              status,
              body: String(body).slice(0, 300),
              fileName: file.name,
              fileSize: file.size,
              filePath,
            });
            const detail = status
              ? `${err.message} (HTTP ${status}${body ? `: ${String(body).slice(0, 120)}` : ''})`
              : err.message;
            setStats((prev) => ({
              ...prev,
              retries: prev.retries + 1,
              connection: navigator.onLine ? 'retrying' : 'offline',
              error: detail,
            }));

            activeUploadRef.current = null;
            pendingFileRef.current = null;
            setUploadProgress(0);
            setDisplayedProgress(0);
            setUploadSpeed(0);
            speedSamplesRef.current = [];
            endUpload();
            reject(new Error(detail));
          },
          onSuccess: () => {
            console.log('[Upload] Upload finished');
            finalizeUpload();
          },

        });

        activeUploadRef.current = upload;
        pendingFileRef.current = { file, filePath };

        // Resume path: only trust a stored pointer after the server confirms
        // the committed offset with a HEAD request. The confirmed offset is
        // published in stats so the UI can display it.
        void (async () => {
          try {
            const pointer = readResumePointer(filePath);
            if (pointer) {
              const offset = await probeOffset(pointer, accessToken);
              if (offset !== null && offset > 0 && offset < file.size) {
                resumedThisRun = true;
                upload.resumeFromPreviousUpload({
                  uploadUrl: pointer,
                  size: file.size,
                  metadata: {},
                  creationTime: new Date().toISOString(),
                  urlStorageKey: resumeKey(filePath),
                  parallelUploadUrls: null,
                } as unknown as tus.PreviousUpload);
                setUploadProgress(Math.floor((offset / file.size) * 100));
                setDisplayedProgress(Math.floor((offset / file.size) * 100));
                patchStats({ resumed: true, resumedFromBytes: offset, bytesUploaded: offset });
                console.log(`[Upload] Resuming from verified offset ${offset} / ${file.size}`);
                toast.info(`Resuming upload from ${(offset / (1024 * 1024)).toFixed(1)} MB`);
              } else {
                clearResumePointer(filePath);
              }
            }
          } catch (e) {
            console.warn('[Upload] Resume probe failed; starting fresh', e);
            clearResumePointer(filePath);
          }
          upload.start();
        })();
      });

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      toast.success('File uploaded successfully!');
      setIsUploading(false);
      return { url: urlData.publicUrl, path: filePath };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Upload] Resumable upload failed:', errMsg);
      
      if (errMsg.includes('413') || errMsg.includes('Maximum size exceeded')) {
        toast.error(`File too large for storage (${(file.size / (1024 * 1024 * 1024)).toFixed(1)} GB). Contact admin to increase the bucket limit.`);
      } else {
        toast.error(`Upload failed: ${errMsg.substring(0, 100)}`);
      }
      setIsUploading(false);
      return null;
    }
  };

  const uploadFile = async (file: File): Promise<UploadResult | null> => {
    const maxSize = getMaxSize();

    // Check file size (client-side guard only)
    if (file.size > maxSize) {
      const maxSizeFormatted = formatFileSize(maxSize);
      const fileSizeFormatted = formatFileSize(file.size);
      toast.error(`File too large (${fileSizeFormatted}). Maximum size is ${maxSizeFormatted}`);
      return null;
    }

    setIsUploading(true);

    try {
      // Generate filename. With stablePath the name is derived from the file
      // itself, so re-selecting the same file after a failure resumes the
      // existing partial object instead of starting a fresh upload.
      const fileExt = file.name.split('.').pop();
      const slug = file.name
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'video';
      const fileName = stablePath
        ? `${slug}-${file.size}-${file.lastModified}${fileExt ? `.${fileExt}` : ''}`
        : `${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt ? `.${fileExt}` : ''}`;
      let filePath = folder ? `${folder}/${fileName}` : fileName;

      // A stable path collides with a completed object from an earlier run.
      // Without a resume pointer that collision makes creation fail instantly,
      // so fall back to a unique path in that case.
      if (stablePath && !readResumePointer(filePath)) {
        const { data: existing } = await supabase.storage
          .from(bucket)
          .list(folder || undefined, { search: fileName, limit: 1 });
        if (existing?.some((entry) => entry.name === fileName)) {
          const unique = `${slug}-${Date.now()}${fileExt ? `.${fileExt}` : ''}`;
          filePath = folder ? `${folder}/${unique}` : unique;
        }
      }



      // Videos: use resumable/chunked upload to support large files reliably
      if (bucket === 'anime-videos' || bucket === 'movies') {
        return await uploadVideoResumable(file, filePath);
      }

      // Images: simple upload is fastest
      const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (error) {
        console.error('Upload error:', error);
        toast.error(error.message || 'Failed to upload file');
        return null;
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

      toast.success('File uploaded successfully!');
      return { url: urlData.publicUrl, path: data.path };
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Format only measured transferred-byte throughput. Speed Boost must not
  // fabricate a network rate or alter progress/completion state.
  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond <= 0) return '0 KB/s';
    if (bytesPerSecond >= 1024 * 1024) return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
  };

  const abortUpload = useCallback(() => {
    if (activeUploadRef.current) {
      try {
        // Preserve resumable server state so cancelling/retrying never deletes
        // bytes that storage has already accepted.
        activeUploadRef.current.abort(false);
      } catch (e) {
        // Ignore abort errors
      }
      activeUploadRef.current = null;
    }
    pendingFileRef.current = null;
    setIsUploading(false);
    setUploadProgress(0);
    setDisplayedProgress(0);
    setUploadSpeed(0);
    measuredSpeedRef.current = 0;
    endUpload();

    toast.info('Upload cancelled');
  }, []);

  return {
    uploadFile,
    isUploading,
    progress: displayedProgress,
    realProgress: uploadProgress,
    uploadSpeed,
    formattedSpeed: formatSpeed(uploadSpeed),
    formatSpeed,
    stats,
    SIZE_LIMITS,
    abortUpload,
  };
}


