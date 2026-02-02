import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Smartphone, Monitor, AlertTriangle, Check, Info } from 'lucide-react';
import { toast } from 'sonner';

interface VideoFormatConverterProps {
  onFormatChange?: (format: 'original' | 'mp4') => void;
  currentFormat?: 'original' | 'mp4';
  showAsCard?: boolean;
  compact?: boolean;
}

export function VideoFormatConverter({
  onFormatChange,
  currentFormat = 'original',
  showAsCard = true,
  compact = false,
}: VideoFormatConverterProps) {
  const [selectedFormat, setSelectedFormat] = useState<'original' | 'mp4'>(currentFormat);
  const [autoConvert, setAutoConvert] = useState(false);

  const handleFormatChange = (format: 'original' | 'mp4') => {
    setSelectedFormat(format);
    onFormatChange?.(format);
    
    if (format === 'mp4') {
      toast.info('Videos will be converted to MP4 for iOS compatibility', {
        description: 'Note: Server-side conversion will process MKV files after upload',
      });
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Output Format:</Label>
        </div>
        <Select value={selectedFormat} onValueChange={(v) => handleFormatChange(v as 'original' | 'mp4')}>
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="original">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                <span>Original Format</span>
              </div>
            </SelectItem>
            <SelectItem value="mp4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <span>MP4 (iOS Compatible)</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        {selectedFormat === 'mp4' && (
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
            <Check className="h-3 w-3 mr-1" />
            iOS Ready
          </Badge>
        )}
      </div>
    );
  }

  const content = (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
        <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Format Conversion</p>
          <p>
            MKV files are not playable on iOS devices. Select "MP4 (iOS Compatible)" to 
            ensure videos work on all devices. The conversion happens server-side after upload.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Target Format</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleFormatChange('original')}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              selectedFormat === 'original'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <Monitor className="h-5 w-5" />
              <span className="font-medium">Original Format</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Keep the original video format (MKV, MP4, etc.)
            </p>
            <div className="mt-2 flex items-center gap-1 text-xs text-amber-500">
              <AlertTriangle className="h-3 w-3" />
              <span>MKV may not play on iOS</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleFormatChange('mp4')}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              selectedFormat === 'mp4'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <Smartphone className="h-5 w-5" />
              <span className="font-medium">MP4 (iOS Compatible)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Convert to MP4 H.264 for universal playback
            </p>
            <div className="mt-2 flex items-center gap-1 text-xs text-primary">
              <Check className="h-3 w-3" />
              <span>Works on all devices</span>
            </div>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <div>
            <Label htmlFor="auto-convert" className="text-sm font-medium cursor-pointer">
              Auto-convert MKV files
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically queue MKV uploads for conversion
            </p>
          </div>
        </div>
        <Switch
          id="auto-convert"
          checked={autoConvert}
          onCheckedChange={setAutoConvert}
        />
      </div>
    </div>
  );

  if (!showAsCard) {
    return content;
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw className="h-4 w-4" />
          Video Format Settings
        </CardTitle>
        <CardDescription>
          Choose the output format for uploaded videos
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
