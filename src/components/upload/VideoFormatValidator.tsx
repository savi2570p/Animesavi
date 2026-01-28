import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, Smartphone, Monitor, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ValidationResult {
  isValid: boolean;
  format: string;
  issues: string[];
  warnings: string[];
  recommendations: string[];
}

// iOS-compatible formats
const IOS_COMPATIBLE_FORMATS = ['.mp4', '.m4v', '.mov', '.m3u8'];
const IOS_COMPATIBLE_CODECS = ['h264', 'h.264', 'avc', 'hevc', 'h265', 'h.265'];

// Formats that need conversion
const NEEDS_CONVERSION = ['.mkv', '.avi', '.wmv', '.flv', '.webm', '.ogv', '.3gp'];

export function VideoFormatValidator() {
  const [videoUrl, setVideoUrl] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [copied, setCopied] = useState(false);

  const validateVideoUrl = (url: string): ValidationResult => {
    const urlLower = url.toLowerCase();
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Extract format from URL
    let format = 'unknown';
    const formatMatch = urlLower.match(/\.(mp4|mkv|avi|mov|m4v|webm|flv|wmv|m3u8|ts|ogv|3gp)(\?.*)?$/);
    if (formatMatch) {
      format = `.${formatMatch[1]}`;
    } else if (urlLower.includes('.m3u8') || urlLower.includes('m3u8')) {
      format = '.m3u8';
    }

    // Check if format is iOS compatible
    const isIOSCompatible = IOS_COMPATIBLE_FORMATS.includes(format);
    const needsConversion = NEEDS_CONVERSION.includes(format);

    if (needsConversion) {
      issues.push(`${format.toUpperCase()} format is NOT supported on iOS Safari`);
      issues.push('Videos will not play on iPhone/iPad');
      recommendations.push('Convert to HLS (.m3u8) for best iOS compatibility');
      recommendations.push('Or convert to MP4 with H.264 codec');
    } else if (format === '.m3u8') {
      // HLS is best for iOS
      recommendations.push('HLS format - Excellent iOS compatibility!');
    } else if (format === '.mp4' || format === '.m4v') {
      // MP4 is good but check for potential codec issues
      warnings.push('Ensure video uses H.264 codec (not H.265/HEVC for older devices)');
      warnings.push('Ensure audio uses AAC codec');
      recommendations.push('Add faststart flag for better streaming');
    } else if (format === '.mov') {
      warnings.push('MOV may have limited support on some Android devices');
      recommendations.push('Consider converting to MP4 for better cross-platform support');
    } else if (format === 'unknown') {
      warnings.push('Could not detect video format from URL');
      recommendations.push('Ensure the video uses H.264/AAC codecs in MP4 or HLS format');
    }

    // Check for common CDN patterns
    if (urlLower.includes('supabase') && urlLower.includes('storage')) {
      recommendations.push('Supabase Storage detected - Ensure CORS is configured');
    }

    return {
      isValid: isIOSCompatible || format === 'unknown',
      format,
      issues,
      warnings,
      recommendations,
    };
  };

  const handleValidate = () => {
    if (!videoUrl.trim()) {
      toast.error('Please enter a video URL');
      return;
    }
    const validationResult = validateVideoUrl(videoUrl);
    setResult(validationResult);
  };

  const ffmpegCommand = `ffmpeg -i input${result?.format || '.mkv'} \\
  -c:v libx264 -profile:v baseline -level:v 3.1 \\
  -preset fast -crf 23 -pix_fmt yuv420p \\
  -c:a aac -b:a 128k -ac 2 \\
  -movflags +faststart \\
  output.mp4`;

  const hlsCommand = `ffmpeg -i input${result?.format || '.mkv'} \\
  -c:v libx264 -profile:v baseline -level:v 3.1 \\
  -preset fast -crf 23 -pix_fmt yuv420p \\
  -c:a aac -b:a 128k -ac 2 \\
  -hls_time 6 -hls_list_size 0 -hls_playlist_type vod \\
  -hls_segment_filename 'segment_%03d.ts' \\
  output.m3u8`;

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd.replace(/\\\n\s+/g, ' '));
    setCopied(true);
    toast.success('Command copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          iOS Video Compatibility Checker
        </CardTitle>
        <CardDescription>
          Check if your video URL will play on iOS devices (iPhone, iPad, Safari)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="video-url" className="sr-only">Video URL</Label>
            <Input
              id="video-url"
              placeholder="Paste video URL to validate..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="bg-muted/50"
            />
          </div>
          <Button onClick={handleValidate} className="anime-button">
            Check
          </Button>
        </div>

        {result && (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              {result.isValid ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  iOS Compatible
                </Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not iOS Compatible
                </Badge>
              )}
              <Badge variant="outline" className="uppercase">
                {result.format}
              </Badge>
            </div>

            {/* Issues */}
            {result.issues.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <h4 className="font-medium text-red-400 mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Issues
                </h4>
                <ul className="text-sm text-red-300 space-y-1">
                  {result.issues.map((issue, i) => (
                    <li key={i}>• {issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <h4 className="font-medium text-yellow-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings
                </h4>
                <ul className="text-sm text-yellow-300 space-y-1">
                  {result.warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <h4 className="font-medium text-blue-400 mb-2 flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Recommendations
                </h4>
                <ul className="text-sm text-blue-300 space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* FFmpeg Commands - Show only if conversion needed */}
            {!result.isValid && (
              <div className="space-y-3">
                <h4 className="font-medium text-foreground">FFmpeg Conversion Commands:</h4>
                
                {/* MP4 Command */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Convert to MP4:</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyCommand(ffmpegCommand)}
                      className="h-7 px-2"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap font-mono">
                    {ffmpegCommand}
                  </pre>
                </div>

                {/* HLS Command */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Convert to HLS (Recommended):</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyCommand(hlsCommand)}
                      className="h-7 px-2"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap font-mono">
                    {hlsCommand}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
