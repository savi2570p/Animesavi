import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Check, X } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the uploaded playback URL — wired straight into "Use Embed Player". */
  onUploaded: (url: string) => void;
  initialFile?: File | null;
}

const MAX_GB = 6;

/**
 * Fallback "Upload on Embed" surface used when a normal upload fails.
 * Streams up to 6GB into the embed storage folder and returns a playable URL
 * that the embed system turns into a public token link.
 */
export function EmbedUploadDialog({ open, onOpenChange, onUploaded, initialFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState(initialFile?.name ?? '');
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { uploadFile, isUploading, progress, formattedSpeed, abortUpload } = useFileUpload({
    bucket: 'anime-videos',
    folder: 'embeds',
    maxSizeGB: MAX_GB,
  });

  const run = async (file: File) => {
    setFileName(file.name);
    setError(null);
    setDone(null);
    const result = await uploadFile(file);
    if (!result) {
      setError('Embed upload failed. Please try a smaller file or retry.');
      return;
    }
    setDone(result.url);
    onUploaded(result.url);
    toast.success('Embed upload complete — embed link will be generated automatically.');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && isUploading) abortUpload(); onOpenChange(v); }}>
      <DialogContent className="max-w-md rounded-2xl border-white/10 bg-background/80 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle>Upload on Embed</DialogTitle>
          <DialogDescription>
            Large-file embed upload. Maximum size {MAX_GB}GB. The embed link is generated automatically and
            connected to “Use Embed Player”.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/x-matroska,video/quicktime"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(f); }}
        />

        {isUploading ? (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> {fileName}
              </span>
              <span className="font-semibold text-primary">{progress}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{formattedSpeed}</span>
              <button type="button" className="hover:text-destructive" onClick={abortUpload}>Cancel</button>
            </div>
          </div>
        ) : done ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
            <Check className="h-4 w-4 text-emerald-500" />
            <span className="truncate">Uploaded — embed source ready.</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border transition-colors hover:border-primary/60 hover:bg-muted/40"
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">Select video for embed upload</span>
            <span className="text-xs text-muted-foreground">Max {MAX_GB}GB</span>
          </button>
        )}

        {error && (
          <p className="flex items-center gap-2 text-xs text-destructive"><X className="h-3.5 w-3.5" />{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          {done && <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
