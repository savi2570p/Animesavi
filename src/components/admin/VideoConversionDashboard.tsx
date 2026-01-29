import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  RefreshCw, 
  Play, 
  Check, 
  X, 
  Clock, 
  AlertCircle,
  ScanSearch,
  Copy,
  Terminal,
  Smartphone,
  Monitor,
  Tablet
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { generateFFmpegCommand } from '@/lib/deviceUtils';

interface ConversionStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
}

interface ConversionRecord {
  id: string;
  episode_id: string;
  original_url: string;
  ios_ready_url: string | null;
  status: string;
  error_message: string | null;
  video_codec: string | null;
  audio_codec: string | null;
  is_10bit: boolean;
  is_hevc: boolean;
  needs_conversion: boolean;
  created_at: string;
  updated_at: string;
  episodes?: {
    title: string;
    episode_number: number;
    seasons?: {
      season_number: number;
      anime?: {
        title: string;
      };
    };
  };
}

export function VideoConversionDashboard() {
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [pendingConversions, setPendingConversions] = useState<ConversionRecord[]>([]);
  const [failedConversions, setFailedConversions] = useState<ConversionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedConversion, setSelectedConversion] = useState<ConversionRecord | null>(null);
  const [ffmpegCommand, setFfmpegCommand] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const { data: allConversions } = await supabase
        .from('video_conversions')
        .select('status');

      const statusCounts: ConversionStats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      };

      allConversions?.forEach((row: { status: string }) => {
        if (row.status in statusCounts) {
          statusCounts[row.status as keyof ConversionStats]++;
        }
      });

      setStats(statusCounts);

      // Fetch pending conversions with episode info
      const { data: pending } = await supabase
        .from('video_conversions')
        .select(`
          *,
          episodes (
            title,
            episode_number,
            seasons (
              season_number,
              anime (
                title
              )
            )
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(50);

      setPendingConversions((pending as ConversionRecord[]) || []);

      // Fetch failed conversions
      const { data: failed } = await supabase
        .from('video_conversions')
        .select(`
          *,
          episodes (
            title,
            episode_number,
            seasons (
              season_number,
              anime (
                title
              )
            )
          )
        `)
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(20);

      setFailedConversions((failed as ConversionRecord[]) || []);
    } catch (error) {
      console.error('Error fetching conversion data:', error);
      toast.error('Failed to fetch conversion data');
    } finally {
      setLoading(false);
    }
  };

  const scanExistingVideos = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('video-conversion', {
        body: {},
        method: 'POST',
      });

      // Use query params for action
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-conversion?action=scan-existing`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success(`Scan complete: ${result.created} new records created, ${result.skipped} already existed`);
      fetchData();
    } catch (error) {
      console.error('Error scanning videos:', error);
      toast.error('Failed to scan existing videos');
    } finally {
      setScanning(false);
    }
  };

  const retryConversion = async (conversionId: string) => {
    try {
      const { error } = await supabase
        .from('video_conversions')
        .update({
          status: 'pending',
          error_message: null,
          conversion_started_at: null,
          conversion_completed_at: null,
        })
        .eq('id', conversionId);

      if (error) throw error;

      toast.success('Conversion queued for retry');
      fetchData();
    } catch (error) {
      console.error('Error retrying conversion:', error);
      toast.error('Failed to retry conversion');
    }
  };

  const showFFmpegCommand = (conversion: ConversionRecord) => {
    const inputPath = conversion.original_url;
    const outputPath = inputPath
      .replace('/original/', '/ios_ready/')
      .replace(/\.(mkv|webm|avi)$/i, '.mp4');
    
    setFfmpegCommand(generateFFmpegCommand(inputPath, outputPath));
    setSelectedConversion(conversion);
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(ffmpegCommand);
    toast.success('Command copied to clipboard');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Processing</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30"><Check className="h-3 w-3 mr-1" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30"><X className="h-3 w-3 mr-1" /> Failed</Badge>;
      case 'skipped':
        return <Badge variant="outline" className="bg-muted text-muted-foreground"><AlertCircle className="h-3 w-3 mr-1" /> Skipped</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEpisodeTitle = (conversion: ConversionRecord) => {
    if (!conversion.episodes) return 'Unknown Episode';
    const anime = conversion.episodes.seasons?.anime?.title || 'Unknown Anime';
    const season = conversion.episodes.seasons?.season_number || 1;
    const episode = conversion.episodes.episode_number || 1;
    return `${anime} - S${season}E${episode}`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">iOS Video Conversion</h2>
          <p className="text-muted-foreground">Manage automatic video conversion for iOS compatibility</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={scanExistingVideos} disabled={scanning}>
            <ScanSearch className={`h-4 w-4 mr-2 ${scanning ? 'animate-pulse' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan Existing Videos'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-500">{stats?.pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold text-blue-500">{stats?.processing || 0}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-500">{stats?.completed || 0}</p>
              </div>
              <Check className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-500">{stats?.failed || 0}</p>
              </div>
              <X className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Skipped</p>
                <p className="text-2xl font-bold text-muted-foreground">{stats?.skipped || 0}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Device-Based Video Delivery
          </CardTitle>
          <CardDescription>
            Videos are automatically served based on the user's device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Smartphone className="h-8 w-8 text-blue-500" />
              <div>
                <p className="font-medium">iOS (iPhone/iPad)</p>
                <p className="text-sm text-muted-foreground">Serves iOS-ready MP4 (H.264, AAC)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Tablet className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-medium">Android</p>
                <p className="text-sm text-muted-foreground">Serves original file format</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Monitor className="h-8 w-8 text-purple-500" />
              <div>
                <p className="font-medium">Windows/Mac</p>
                <p className="text-sm text-muted-foreground">Serves original file format</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Conversions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            Pending Conversions
          </CardTitle>
          <CardDescription>
            Videos waiting to be converted for iOS compatibility
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {pendingConversions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pending conversions</p>
            ) : (
              <div className="space-y-2">
                {pendingConversions.map((conversion) => (
                  <div
                    key={conversion.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getEpisodeTitle(conversion)}</p>
                      <p className="text-sm text-muted-foreground truncate">{conversion.original_url}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {getStatusBadge(conversion.status)}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => showFFmpegCommand(conversion)}
                      >
                        <Terminal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Failed Conversions */}
      {failedConversions.length > 0 && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <X className="h-5 w-5" />
              Failed Conversions
            </CardTitle>
            <CardDescription>
              Videos that failed to convert - review and retry
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {failedConversions.map((conversion) => (
                  <div
                    key={conversion.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 hover:bg-red-500/10 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getEpisodeTitle(conversion)}</p>
                      <p className="text-sm text-red-500 truncate">{conversion.error_message || 'Unknown error'}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => showFFmpegCommand(conversion)}
                      >
                        <Terminal className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retryConversion(conversion.id)}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Retry
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* FFmpeg Command Dialog */}
      <Dialog open={!!selectedConversion} onOpenChange={() => setSelectedConversion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              FFmpeg Conversion Command
            </DialogTitle>
            <DialogDescription>
              Run this command to convert the video for iOS compatibility
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto whitespace-pre-wrap break-all">
                {ffmpegCommand}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={copyCommand}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Input:</strong> {selectedConversion?.original_url}</p>
              <p><strong>Output:</strong> H.264 High Profile 4.1, AAC stereo, yuv420p, faststart enabled</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
