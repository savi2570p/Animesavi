import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UnsupportedFormatWarningProps {
  format: string;
  onTryAnyway?: () => void;
  onUseEmbed?: () => void;
}

export function UnsupportedFormatWarning({ 
  format, 
  onTryAnyway, 
  onUseEmbed 
}: UnsupportedFormatWarningProps) {
  const formatName = format.replace('.', '').toUpperCase();
  
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20">
      <div className="bg-card border border-border rounded-xl p-6 max-w-md mx-4 shadow-2xl animate-scale-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="text-foreground font-semibold text-lg">
            Format Not Supported
          </h3>
        </div>
        
        <p className="text-muted-foreground text-sm mb-4">
          <strong>{formatName}</strong> files are not natively supported on mobile browsers. 
          For best compatibility, videos should be converted to:
        </p>
        
        <ul className="text-sm text-muted-foreground mb-4 space-y-1">
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <strong>MP4</strong> with H.264 codec (best compatibility)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <strong>WebM</strong> with VP9 codec
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <strong>HLS</strong> (.m3u8) for adaptive streaming
          </li>
        </ul>
        
        <div className="flex flex-col gap-2">
          {onTryAnyway && (
            <Button
              onClick={onTryAnyway}
              variant="default"
              className="w-full"
            >
              Try Anyway
            </Button>
          )}
          {onUseEmbed && (
            <Button
              onClick={onUseEmbed}
              variant="outline"
              className="w-full"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Use Embed Player
            </Button>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Tip: Use FFmpeg to convert: <code className="bg-muted px-1 rounded">ffmpeg -i input.{formatName.toLowerCase()} -c:v libx264 -movflags +faststart output.mp4</code>
        </p>
      </div>
    </div>
  );
}
