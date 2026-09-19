import { safeStorage } from '@/lib/storage/safeStorage';

export const UPLOAD_SESSION_VERSION = 2;
export const UPLOAD_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PersistedUploadStatus =
  | 'pending'
  | 'uploading'
  | 'paused'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PersistedUploadSession {
  version: number;
  uploadId: string;
  fingerprint: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  bucket: string;
  destinationPath: string;
  uploadUrl: string | null;
  chunkSize: number;
  totalChunks: number;
  completedChunks: number;
  failedChunks: number[];
  confirmedBytes: number;
  status: PersistedUploadStatus;
  retries: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

const PREFIX = 'resumable-upload:v2:';

export function fileFingerprint(file: Pick<File, 'name' | 'size' | 'lastModified'>, bucket: string, path: string) {
  return [bucket, path, file.name, file.size, file.lastModified].join(':');
}

function storageKey(fingerprint: string) {
  let hash = 2166136261;
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash ^= fingerprint.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${PREFIX}${(hash >>> 0).toString(36)}`;
}

export function readUploadSession(fingerprint: string): PersistedUploadSession | null {
  const session = safeStorage.getJSON<PersistedUploadSession | null>(storageKey(fingerprint), null);
  if (!session || session.version !== UPLOAD_SESSION_VERSION || session.fingerprint !== fingerprint) return null;
  if (Date.now() - session.updatedAt > UPLOAD_SESSION_TTL_MS) {
    safeStorage.removeItem(storageKey(fingerprint));
    return null;
  }
  return session;
}

export function writeUploadSession(session: PersistedUploadSession) {
  safeStorage.setJSON(storageKey(session.fingerprint), { ...session, updatedAt: Date.now() });
}

export function clearUploadSession(fingerprint: string) {
  safeStorage.removeItem(storageKey(fingerprint));
}

export function retryDelay(attempt: number) {
  const base = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000, 60_000][Math.min(attempt, 6)];
  return Math.round(base * (0.85 + Math.random() * 0.3));
}

export function isRetryableUploadStatus(status: number) {
  return status === 0 || status === 401 || status === 408 || status === 409 || status === 423 || status === 429 || status >= 500;
}

export function safeUploadError(message: string, status: number, body = '') {
  const cleanBody = body.replace(/[\r\n]+/g, ' ').slice(0, 140);
  if (!navigator.onLine || status === 0) return 'Connection interrupted. Your confirmed progress is saved.';
  if (status === 400) return `Storage rejected the upload session${cleanBody ? `: ${cleanBody}` : '.'}`;
  if (status === 401) return 'Your session expired during upload. Sign in again, then resume this file.';
  if (status === 403) return 'Storage permission denied. Your confirmed progress is saved.';
  if (status === 404) return 'The upload destination was not found or its storage policy rejected the path.';
  if (status === 413) return 'The file exceeds the current storage size limit.';
  if (status === 429) return 'Storage is temporarily rate limited. Your confirmed progress is saved.';
  if (status >= 500) return `Storage is temporarily unavailable (HTTP ${status}). Your progress is saved.`;
  return `${message || 'Upload failed'}${status ? ` (HTTP ${status})` : ''}${cleanBody ? `: ${cleanBody}` : ''}`;
}

type QueueTask = { run: () => Promise<unknown>; resolve: (value: unknown) => void; reject: (reason: unknown) => void };
const queue: QueueTask[] = [];
let queueRunning = false;

async function drainQueue() {
  if (queueRunning) return;
  queueRunning = true;
  while (queue.length > 0) {
    const task = queue.shift();
    if (!task) continue;
    try {
      task.resolve(await task.run());
    } catch (error) {
      task.reject(error);
    }
  }
  queueRunning = false;
}

/** One large storage transfer at a time prevents batch fields competing for bandwidth. */
export function enqueueVideoUpload<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({ run, resolve: (value) => resolve(value as T), reject });
    void drainQueue();
  });
}