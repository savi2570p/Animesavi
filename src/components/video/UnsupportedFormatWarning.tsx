import { AlertTriangle, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

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
  const [copied, setCopied] = useState(false);
  
  const ffmpegCommand = `ffmpeg -i input.${formatName.toLowerCase()} -c:v libx264 -movflags +faststart output.mp4`;
  
  const handleCopyCommand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(ffmpegCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleTryAnyway = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTryAnyway?.();
  };

  const handleUseEmbed = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUseEmbed?.();
  };
  
  return (
    <div 
      className="absolute inset-0 flex items-center justify-center bg-black/95 z-[200]"
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-card border border-border rounded-xl p-6 max-w-md mx-4 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
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
              onClick={handleTryAnyway}
              variant="default"
              className="w-full relative z-[201]"
              type="button"
            >
              Try Anyway
            </Button>
          )}
          {onUseEmbed && (
            <Button
              onClick={handleUseEmbed}
              variant="outline"
              className="w-full relative z-[201]"
              type="button"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Use Embed Player
            </Button>
          )}
        </div>
        
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-2">
            Convert with FFmpeg:
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-background px-2 py-1 rounded flex-1 overflow-x-auto whitespace-nowrap">
              {ffmpegCommand}
            </code>
            <Button
              onClick={handleCopyCommand}
              variant="ghost"
              size="sm"
              className="shrink-0 h-7 w-7 p-0 relative z-[201]"
              type="button"
            >
            {copied ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
