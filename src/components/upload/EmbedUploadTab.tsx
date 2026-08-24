import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Copy, Link2, Loader2, Upload, X } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { toast } from 'sonner';

const MAX_GB = 6;

interface UploadedEmbed {
  name: string;
  url: string;
}

/**
 * "Embed Upload" tab — standalone large-file uploader (max 6GB).
 * Produces a direct playback link that can be pasted into the normal
 * upload form's video / external URL field ("Use Embed Player").
 */
export function EmbedUploadTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [items, setItems] = useState<UploadedEmbed[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { uploadFile, isUploading, progress, formattedSpeed, abortUpload, stats } = useFileUpload({
    bucket: 'anime-videos',
    folder: 'embeds',
    maxSizeGB: MAX_GB,
    // Deterministic path + smaller chunks: a dropped connection resumes from
    // where it stopped when the same file is picked again.
    stablePath: true,
    maxChunkUnits: 2,
  });

  const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const run = async (file: File) => {
    setFileName(file.name);
    setError(null);
    const result = await uploadFile(file);
    if (!result) {
      setError(
        `Upload interrupted${stats.error ? ` — ${stats.error}` : ''}. Select the same file again to resume from the last confirmed chunk.`
      );
      return;
    }
    setItems((prev) => [{ name: file.name, url: result.url }, ...prev]);
    toast.success('Embed link generated — copy it into the upload form.');
  };



  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      toast.success('Embed link copied');
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error('Copy failed — select and copy manually.');
    }
  };

  return (
    <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4 text-primary" /> Embed Upload
        </CardTitle>
        <CardDescription>
          Upload a video up to {MAX_GB}GB. An embed link is generated automatically — copy it and paste it
          into the video / external URL field on a normal upload to use the embed player.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/x-matroska,video/quicktime,video/avi"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void run(f);
            e.target.value = '';
          }}
        />

        {isUploading ? (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex min-w-0 items-center gap-2 truncate">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                <span className="truncate">{fileName}</span>
              </span>
              <span className="font-semibold text-primary">{progress}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{formattedSpeed}</span>
              <button type="button" className="hover:text-destructive" onClick={abortUpload}>
                Cancel
              </button>
            </div>
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
          <p className="flex items-center gap-2 text-xs text-destructive">
            <X className="h-3.5 w-3.5" />
            {error}
          </p>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Generated embed links
            </p>
            {items.map((item) => (
              <div
                key={item.url}
                className="space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3"
              >
                <p className="truncate text-xs font-medium">{item.name}</p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={item.url} className="h-9 bg-background/60 text-xs" />
                  <Button type="button" size="sm" className="h-9 shrink-0" onClick={() => copy(item.url)}>
                    {copied === item.url ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
