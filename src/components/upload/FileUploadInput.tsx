import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, FileVideo, Image as ImageIcon, Loader2 } from 'lucide-react';
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

export function FileUploadInput({
  label,
  accept,
  value,
  onChange,
  folder = '',
  placeholder,
  className,
  maxSizeGB,
  contentType,
}: FileUploadInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const bucket = accept === 'video' ? 'anime-videos' : 'anime-thumbnails';
  
  // Determine max size based on content type
  const effectiveMaxSize = maxSizeGB ?? (contentType === 'movie' ? 100 : contentType === 'episode' ? 50 : accept === 'image' ? 1 : 50);
  
  const { uploadFile, isUploading, progress, SIZE_LIMITS } = useFileUpload({ 
    bucket, 
    folder,
    maxSizeGB: effectiveMaxSize 
  });

  const acceptTypes = accept === 'video' 
    ? 'video/mp4,video/webm,video/mkv,video/avi,video/mov,video/x-matroska' 
    : 'image/jpeg,image/png,image/webp,image/gif';
  
  const maxSizeLabel = effectiveMaxSize >= 1 ? `${effectiveMaxSize}GB` : `${effectiveMaxSize * 1024}MB`;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview for images
    if (accept === 'image') {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }

    const result = await uploadFile(file);
    if (result) {
      onChange(result.url);
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleClear = () => {
    onChange('');
    setPreview(null);
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
      
      <input
        ref={inputRef}
        type="file"
        accept={acceptTypes}
        onChange={handleFileSelect}
        className="hidden"
        // Mobile devices will open gallery/file picker automatically based on accept type
      />

      {value ? (
        <div className="relative">
          {accept === 'image' && (
            <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border bg-muted/50">
              <img
                src={preview || value}
                alt="Preview"
                className="w-full h-full object-cover"
              />
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
              <FileVideo className="h-5 w-5 text-primary" />
              <span className="text-sm truncate flex-1">Video uploaded</span>
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
      ) : (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={triggerFileSelect}
            disabled={isUploading}
            className="w-full h-28 border-dashed flex flex-col gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm font-medium">Uploading... {progress}%</span>
                <div className="w-full max-w-[200px] h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <Icon className="h-6 w-6" />
                <span className="text-sm">
                  {accept === 'video' ? 'Select Video File' : 'Select Image'}
                </span>
                <span className="text-xs text-muted-foreground">
                  Max size: {maxSizeLabel}
                </span>
              </>
            )}
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
            placeholder={placeholder || `Paste ${accept} URL...`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-muted/50"
          />
        </div>
      )}
    </div>
  );
}
