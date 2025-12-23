import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as tus from 'tus-js-client';

interface UseFileUploadOptions {
  bucket: 'anime-videos' | 'anime-thumbnails';
  folder?: string;
  maxSizeGB?: number;
}

interface UploadResult {
  url: string;
  path: string;
}

// Size limits in GB
const SIZE_LIMITS = {
  movie: 100, // 100GB for movies
  episode: 50, // 50GB for anime episodes
  thumbnail: 1, // 1GB for thumbnails
};

function getProjectId() {
  const fromEnv = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID as string | undefined;
  if (fromEnv) return fromEnv;

  const urlStr = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  if (!urlStr) return null;
  try {
    const host = new URL(urlStr).hostname; // {projectRef}.supabase.co
    return host.split('.')[0] ?? null;
  } catch {
    return null;
  }
}

function getResumableEndpoint() {
  const projectId = getProjectId();
  if (!projectId) return null;
  return `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;
}

export function useFileUpload({ bucket, folder = '', maxSizeGB }: UseFileUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Determine default max size based on bucket
  const getMaxSize = () => {
    if (maxSizeGB) return maxSizeGB * 1024 * 1024 * 1024;
    if (bucket === 'anime-thumbnails') return SIZE_LIMITS.thumbnail * 1024 * 1024 * 1024;
    return SIZE_LIMITS.episode * 1024 * 1024 * 1024; // Default to episode size for videos
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

  const uploadWithTus = async ({ file, filePath }: { file: File; filePath: string }) => {
    const endpoint = getResumableEndpoint();
    if (!endpoint) {
      toast.error('Upload is not configured correctly (missing project id)');
      return null;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      toast.error('Please sign in again to upload');
      return null;
    }

    const publishableKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!publishableKey) {
      toast.error('Upload is not configured correctly (missing key)');
      return null;
    }

    return await new Promise<UploadResult | null>((resolve) => {
      const upload = new tus.Upload(file, {
        endpoint,
        chunkSize: 6 * 1024 * 1024,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: {
          authorization: `Bearer ${session.access_token}`,
          apikey: publishableKey,
        },
        metadata: {
          bucketName: bucket,
          objectName: filePath,
          contentType: file.type || 'application/octet-stream',
          cacheControl: '3600',
          // Supabase expects strings here; optional user_metadata can be passed via "metadata" key
          metadata: JSON.stringify({}),
        },
        onProgress(bytesUploaded, bytesTotal) {
          if (!bytesTotal) return;
          const pct = Math.min(99, Math.floor((bytesUploaded / bytesTotal) * 100));
          setProgress(pct);
        },
        onError(error) {
          console.error('Resumable upload error:', error);
          // Clear partial upload + fingerprint so re-try doesn't loop.
          upload.abort(true).catch(() => undefined);
          setProgress(0);
          toast.error('Upload failed. Please try again.');
          resolve(null);
        },
        onSuccess() {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
          setProgress(100);
          toast.success('File uploaded successfully!');
          resolve({ url: urlData.publicUrl, path: filePath });
        },
      });

      upload.start();
    });
  };

  const uploadFile = async (file: File): Promise<UploadResult | null> => {
    const maxSize = getMaxSize();

    // Check file size
    if (file.size > maxSize) {
      const maxSizeFormatted = formatFileSize(maxSize);
      const fileSizeFormatted = formatFileSize(file.size);
      toast.error(`File too large (${fileSizeFormatted}). Maximum size is ${maxSizeFormatted}`);
      return null;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt ? `.${fileExt}` : ''}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      // Use resumable uploads for reliability on large video files (fixes the 95% stall/loop)
      return await uploadWithTus({ file, filePath });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
      setProgress(0);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadFile,
    isUploading,
    progress: Math.round(progress),
    SIZE_LIMITS,
  };
}

