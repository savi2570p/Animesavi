import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as tus from 'tus-js-client';
import { subscribeBoost } from '@/lib/uploadBoost';
import { beginUpload, reportUpload, endUpload } from '@/lib/uploadSpeedTracker';

interface UseFileUploadOptions {
  bucket: 'anime-videos' | 'anime-thumbnails' | 'movies';
  folder?: string;
  maxSizeGB?: number;
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

// Lovable Cloud resumable storage requires a fixed 6 MB chunk size — any other
// value can make the server reject PATCH requests and leave uploads at 0 %.
// IMPORTANT: parallelUploads MUST stay at 1. tus-js-client's parallelUploads
// relies on the TUS `concatenation` extension, which the resumable storage
// endpoint does not support, causing uploads to restart mid-stream after a
// certain percentage. Keep this single-stream for reliability.
const VIDEO_CHUNK_SIZE = 6 * 1024 * 1024;
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

export function useFileUpload({ bucket, folder = '', maxSizeGB }: UseFileUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [displayedProgress, setDisplayedProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0); // bytes per second
  const isOnline = useOnlineStatus();
  const activeUploadRef = useRef<tus.Upload | null>(null);
  const pendingFileRef = useRef<{ file: File; filePath: string } | null>(null);
  const lastProgressRef = useRef<{ bytes: number; time: number }>({ bytes: 0, time: 0 });
  const speedSamplesRef = useRef<Array<{ bytes: number; time: number }>>([]);
  const measuredSpeedRef = useRef<number>(0);

  // Auto-resume upload when coming back online
  useEffect(() => {
    if (isOnline && activeUploadRef.current && pendingFileRef.current) {
      toast.info('Resuming upload...');
      activeUploadRef.current.start();
    }
  }, [isOnline]);

  // Speed Boost is intentionally isolated from progress and finalization.
  // It may tune transfer scheduling elsewhere, but it must never synthesize
  // bytes, hold the bar at 99%, or interfere with the TUS completion callback.
  useEffect(() => {
    return subscribeBoost((boost) => {
      if (boost.active) console.log('[Upload] Speed Boost enabled');
    });
  }, []);

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

    try {
      setUploadProgress(0);
      setDisplayedProgress(0);
      setUploadSpeed(0);
      measuredSpeedRef.current = 0;
      lastProgressRef.current = { bytes: 0, time: performance.now() };
      speedSamplesRef.current = [{ bytes: 0, time: performance.now() }];
      beginUpload(file.size);

      await new Promise<void>((resolve, reject) => {
        let finalized = false;
        let finalizing = false;
        let allBytesUploaded = false;
        let completionGraceTimer: number | null = null;
        let completionWatchdog: number | null = null;

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
          activeUploadRef.current = null;
          pendingFileRef.current = null;
          setUploadProgress(100);
          setDisplayedProgress(100);
          reportUpload(file.size, measuredSpeedRef.current);
          speedSamplesRef.current = [];
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
        // check covers a missed callback, while the 30-second watchdog retries
        // only the final offset verification—never the file upload itself.
        const scheduleFinalizeChecks = (upload: tus.Upload) => {
          if (finalized || completionGraceTimer !== null || completionWatchdog !== null) return;
          completionGraceTimer = window.setTimeout(async () => {
            completionGraceTimer = null;
            await verifyFinalOffset(upload);
          }, 1_000);

          completionWatchdog = window.setTimeout(async () => {
            completionWatchdog = null;
            if (finalized || finalizing) return;
            const complete = await verifyFinalOffset(upload);
            if (!complete) {
              console.warn('[Upload] Finalize verification pending; retrying finalize check only');
              scheduleFinalizeChecks(upload);
            }
          }, 30_000);
        };

        const upload = new tus.Upload(file, {
          endpoint: RESUMABLE_UPLOAD_ENDPOINT,
          chunkSize: VIDEO_CHUNK_SIZE,
          // Single-stream upload — parallelUploads with chunkSize triggers the
          // TUS concatenation extension, which Lovable Cloud storage rejects
          // partway through, causing the upload to restart.
          parallelUploads: 1,
          uploadDataDuringCreation: true,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          removeFingerprintOnSuccess: true,
          headers: {
            authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
            'x-upsert': 'false',
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
              scheduleFinalizeChecks(upload);
              return;
            }
            clearCompletionTimers();
            console.error('[Upload] TUS error details:', {
              message: err.message,
              fileName: file.name,
              fileSize: file.size,
              filePath,
            });
            activeUploadRef.current = null;
            pendingFileRef.current = null;
            setUploadProgress(0);
            setDisplayedProgress(0);
            setUploadSpeed(0);
            speedSamplesRef.current = [];
            endUpload();
            reject(err);
          },
          onSuccess: () => {
            console.log('[Upload] Upload finished');
            finalizeUpload();
          },

        });

        activeUploadRef.current = upload;
        pendingFileRef.current = { file, filePath };

        upload
          .findPreviousUploads()
          .then((previousUploads) => {
            if (previousUploads.length > 0) {
              upload.resumeFromPreviousUpload(previousUploads[0]);
            }
            upload.start();
          })
          .catch(() => {
            upload.start();
          });
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
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt ? `.${fileExt}` : ''}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

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
    SIZE_LIMITS,
    abortUpload,
  };
}


