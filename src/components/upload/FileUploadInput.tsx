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

  const { uploadFile, isUploading, progress, formattedSpeed, formatSpeed, stats, abortUpload } = useFileUpload({
    bucket,
    folder,
    maxSizeGB: effectiveMaxSize,
  });

  const formatEta = (seconds: number | null) => {
    if (seconds === null || !isFinite(seconds) || seconds <= 0) return '—';
    const s = Math.round(seconds);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  };


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

    await runUpload(file);
  };

  const handleRetry = async () => {
    if (!lastFile) return;
    await runUpload(lastFile);
  };

  const handleClear = () => {
    // Abort any active upload
    abortUpload();
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

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = accept === 'video'
      ? ['video/mp4', 'video/webm', 'video/x-matroska', 'video/avi', 'video/quicktime']
      : ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.some(t => file.type.startsWith(t.split('/')[0]))) {
      setUploadError(`Invalid file type. Please drop a ${accept} file.`);
      return;
    }

    setFileName(file.name);
    setLastFile(file);
    setUploadError(null);

    if (accept === 'image') {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }

    await runUpload(file);
  }, [accept, runUpload]);

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
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/50 bg-primary/5">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate">{fileName || 'Uploading...'}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formattedSpeed}</span>
                  <span className="text-sm font-bold text-primary">{progress}%</span>
                </div>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {accept === 'video' && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>ETA {formatEta(stats.etaSeconds)}</span>
                  <span>avg {formatSpeed(stats.averageSpeed)}</span>
                  <span>
                    chunk {(stats.chunkSize / (1024 * 1024)).toFixed(0)}MB · {stats.chunksDone}/{stats.chunksTotal}
                  </span>
                  <span>
                    {(stats.bytesUploaded / (1024 * 1024)).toFixed(0)}/
                    {(stats.bytesTotal / (1024 * 1024)).toFixed(0)} MB
                  </span>
                  <span className="capitalize">{stats.connection}</span>
                  {stats.retries > 0 && <span className="text-amber-500">retries {stats.retries}</span>}
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
              onClick={handleClear}
              title="Cancel upload"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
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
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            className={cn(
              'w-full h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-200',
              isDragging
                ? 'border-primary bg-primary/10 scale-[1.02]'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            )}
          >
            <Upload className={cn('h-6 w-6 transition-colors', isDragging ? 'text-primary' : 'text-muted-foreground')} />
            <span className="text-sm font-medium">
              {isDragging ? `Drop ${accept} here` : accept === 'video' ? 'Select or Drop Video' : 'Select or Drop Image'}
            </span>
            <span className="text-xs text-muted-foreground">Max: {maxSizeLabel}</span>
          </div>

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

