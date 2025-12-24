import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export function useFileUpload({ bucket, folder = '', maxSizeGB }: UseFileUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);

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

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt ? `.${fileExt}` : ''}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      // Use standard Supabase upload - simpler and more reliable
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        toast.error(error.message || 'Failed to upload file');
        return null;
      }

      // Get public URL
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

  return {
    uploadFile,
    isUploading,
    progress: 0, // Keep for compatibility but not used
    SIZE_LIMITS,
  };
}

