import { forwardRef, useCallback, useRef, useState } from 'react';
import type { ChangeEvent, ForwardedRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, FileVideo, Image as ImageIcon, Check, Loader2, RotateCw } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { cn } from '@/lib/utils';

interface FileUploadInputProps {
  label: string;
  accept: 'video' | 'image';
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  placeholder?: string;
  className?: string;
  maxSizeGB?: number;
  contentType?: 'movie' | 'episode' | 'thumbnail';
}

export const FileUploadInput = forwardRef<HTMLInputElement, FileUploadInputProps>(function FileUploadInput(
  {
    label,
    accept,
    value,
    onChange,
    folder = '',
    placeholder,
    className,
    maxSizeGB,
    contentType,
  }: FileUploadInputProps,
  forwardedRef: ForwardedRef<HTMLInputElement>
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const bucket = accept === 'video' ? 'anime-videos' : 'anime-thumbnails';

  // Determine max size based on content type
  const effectiveMaxSize =
    maxSizeGB ?? (contentType === 'movie' ? 100 : contentType === 'episode' ? 50 : accept === 'image' ? 1 : 50);

  const { uploadFile, isUploading } = useFileUpload({
    bucket,
    folder,
    maxSizeGB: effectiveMaxSize,
  });

  const acceptTypes =
    accept === 'video'
      ? 'video/mp4,video/webm,video/mkv,video/avi,video/mov,video/x-matroska'
      : 'image/jpeg,image/png,image/webp,image/gif';

  const maxSizeLabel = effectiveMaxSize >= 1 ? `${effectiveMaxSize}GB` : `${effectiveMaxSize * 1024}MB`;

  const setInputNode = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (!forwardedRef) return;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
        return;
      }
      forwardedRef.current = node;
    },
    [forwardedRef]
  );

  const runUpload = useCallback(
    async (file: File) => {
      setUploadError(null);
      const result = await uploadFile(file);
      if (result) {
        onChange(result.url);
        setUploadError(null);
      } else {
        setUploadError('Upload failed. Please retry.');
      }
    },
    [onChange, uploadFile]
  );

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLastFile(file);
    setUploadError(null);

    // Create preview for images
    if (accept === 'image') {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }

    // Start upload immediately
    await runUpload(file);

    // Reset input (lets user pick the same file again if needed)
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRetry = async () => {
    if (!lastFile) return;
    await runUpload(lastFile);
  };

  const handleClear = () => {
    onChange('');
    setPreview(null);
    setFileName('');
    setLastFile(null);
    setUploadError(null);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const triggerFileSelect = () => {
    inputRef.current?.click();
  };

  const Icon = accept === 'video' ? FileVideo : ImageIcon;

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>

      <input ref={setInputNode} type="file" accept={acceptTypes} onChange={handleFileSelect} className="hidden" />

      {value ? (
        <div className="relative">
          {accept === 'image' && (
            <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border bg-muted/50">
              <img src={preview || value} alt={`${label} preview`} className="w-full h-full object-cover" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={handleClear}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {accept === 'video' && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/50">
              <Check className="h-5 w-5 text-primary" />
              <span className="text-sm truncate flex-1">{fileName || 'Video uploaded'}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={handleClear}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      ) : isUploading ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/50 bg-primary/5">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium truncate">{fileName || 'Uploading...'}</span>
        </div>
      ) : uploadError ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/50 bg-destructive/5">
          <Upload className="h-5 w-5 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{fileName || 'Upload failed'}</p>
            <p className="text-xs text-destructive truncate">{uploadError}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleRetry} className="shrink-0">
            <RotateCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={triggerFileSelect}
            className="w-full h-20 border-dashed flex flex-col gap-1"
          >
            <Icon className="h-5 w-5" />
            <span className="text-sm">{accept === 'video' ? 'Select Video' : 'Select Image'}</span>
            <span className="text-xs text-muted-foreground">Max: {maxSizeLabel}</span>
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or paste URL</span>
            </div>
          </div>

          <Input
            type="url"
            placeholder={placeholder || `Paste ${accept} URL (direct link or embed)...`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-muted/50"
          />
          {accept === 'video' && (
            <p className="text-xs text-muted-foreground">
              Supports: Direct video links (.mp4, .webm) or embed URLs (Google Drive, YouTube, etc.)
            </p>
          )}
        </div>
      )}
    </div>
  );
});

