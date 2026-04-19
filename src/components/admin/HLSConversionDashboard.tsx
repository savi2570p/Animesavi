import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Tablet,
  Cpu,
  Zap,
  Server,
  Download,
  Settings,
  BarChart3
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
  file_size_bytes: number | null;
  ios_file_size_bytes: number | null;
  conversion_started_at: string | null;
  conversion_completed_at: string | null;
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

export function HLSConversionDashboard() {
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [pendingConversions, setPendingConversions] = useState<ConversionRecord[]>([]);
  const [processingConversions, setProcessingConversions] = useState<ConversionRecord[]>([]);
  const [completedConversions, setCompletedConversions] = useState<ConversionRecord[]>([]);
  const [failedConversions, setFailedConversions] = useState<ConversionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedConversion, setSelectedConversion] = useState<ConversionRecord | null>(null);
  const [ffmpegCommand, setFfmpegCommand] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async () => {
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

      // Fetch conversions by status with episode info
      const selectQuery = `
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
      `;

      const [pendingRes, processingRes, completedRes, failedRes] = await Promise.all([
        supabase.from('video_conversions').select(selectQuery).eq('status', 'pending').order('created_at', { ascending: true }).limit(50),
        supabase.from('video_conversions').select(selectQuery).eq('status', 'processing').order('conversion_started_at', { ascending: false }).limit(20),
        supabase.from('video_conversions').select(selectQuery).eq('status', 'completed').order('conversion_completed_at', { ascending: false }).limit(50),
        supabase.from('video_conversions').select(selectQuery).eq('status', 'failed').order('updated_at', { ascending: false }).limit(20),
      ]);

      setPendingConversions((pendingRes.data as ConversionRecord[]) || []);
      setProcessingConversions((processingRes.data as ConversionRecord[]) || []);
      setCompletedConversions((completedRes.data as ConversionRecord[]) || []);
      setFailedConversions((failedRes.data as ConversionRecord[]) || []);
    } catch (error) {
      console.error('Error fetching conversion data:', error);
      toast.error('Failed to fetch conversion data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Set up realtime subscription for updates
    const channel = supabase
      .channel('video_conversions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_conversions' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const scanExistingVideos = async () => {
    setScanning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      let offset = 0;
      let totalCreated = 0;
      let totalSkipped = 0;
      let totalRequeued = 0;
      const batchSize = 500;

      while (true) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-conversion?action=scan-existing`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ offset, batchSize }),
          }
        );
        const result = await response.json();
        if (result.error) throw new Error(result.error);

        totalCreated += result.created || 0;
        totalSkipped += result.skipped || 0;
        totalRequeued += result.requeued || 0;

        if (!result.hasMore || result.nextOffset == null) break;
        offset = result.nextOffset;
      }

      toast.success(`Scan complete: ${totalCreated} new, ${totalRequeued} requeued, ${totalSkipped} skipped`);
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

  const retryAllFailed = async () => {
    try {
      const { error } = await supabase
        .from('video_conversions')
        .update({
          status: 'pending',
          error_message: null,
          conversion_started_at: null,
          conversion_completed_at: null,
        })
        .eq('status', 'failed');

      if (error) throw error;

      toast.success(`Queued ${failedConversions.length} failed conversions for retry`);
      fetchData();
    } catch (error) {
      console.error('Error retrying all failed:', error);
      toast.error('Failed to retry conversions');
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return 'N/A';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const totalConversions = stats ? stats.pending + stats.processing + stats.completed + stats.failed + stats.skipped : 0;
  const completionRate = totalConversions > 0 ? ((stats?.completed || 0) / totalConversions) * 100 : 0;

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
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-purple-500" />
            HLS Video Conversion System
          </h2>
          <p className="text-muted-foreground">Automatic iOS HLS streaming with GPU acceleration support</p>
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

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{totalConversions}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
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
                <p className="text-sm text-muted-foreground">Completion</p>
                <p className="text-2xl font-bold text-purple-500">{completionRate.toFixed(0)}%</p>
              </div>
              <Zap className="h-8 w-8 text-purple-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Conversion Progress</span>
              <span>{stats?.completed || 0} / {totalConversions}</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Device Delivery Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Adaptive Device-Based Delivery
          </CardTitle>
          <CardDescription>
            Videos are automatically served based on user device for optimal playback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Smartphone className="h-8 w-8 text-blue-500" />
              <div>
                <p className="font-medium">iOS (iPhone/iPad)</p>
                <p className="text-sm text-muted-foreground">HLS Adaptive Streaming (H.264, AAC)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <Tablet className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-medium">Android</p>
                <p className="text-sm text-muted-foreground">Original Format (MKV, HEVC supported)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Monitor className="h-8 w-8 text-purple-500" />
              <div>
                <p className="font-medium">Desktop (Win/Mac)</p>
                <p className="text-sm text-muted-foreground">Original Format (Full quality)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pending">Pending ({stats?.pending || 0})</TabsTrigger>
          <TabsTrigger value="processing">Processing ({stats?.processing || 0})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({stats?.completed || 0})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({stats?.failed || 0})</TabsTrigger>
          <TabsTrigger value="worker">Worker Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Currently Processing */}
          {processingConversions.length > 0 && (
            <Card className="border-blue-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-500">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Currently Processing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {processingConversions.map((conversion) => (
                    <div key={conversion.id} className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{getEpisodeTitle(conversion)}</p>
                        <p className="text-sm text-muted-foreground">Started: {conversion.conversion_started_at ? new Date(conversion.conversion_started_at).toLocaleString() : 'Unknown'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(conversion.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Completed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-500">
                <Check className="h-5 w-5" />
                Recently Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                {completedConversions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No completed conversions yet</p>
                ) : (
                  <div className="space-y-2">
                    {completedConversions.slice(0, 10).map((conversion) => (
                      <div key={conversion.id} className="flex items-center justify-between p-3 rounded-lg bg-green-500/5">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{getEpisodeTitle(conversion)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(conversion.file_size_bytes)} → {formatFileSize(conversion.ios_file_size_bytes)} 
                            {conversion.conversion_started_at && conversion.conversion_completed_at && (
                              <> • {formatDuration(conversion.conversion_started_at, conversion.conversion_completed_at)}</>
                            )}
                          </p>
                        </div>
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-500">
                <Clock className="h-5 w-5" />
                Pending Conversions
              </CardTitle>
              <CardDescription>Videos waiting to be converted for iOS compatibility</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {pendingConversions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No pending conversions</p>
                ) : (
                  <div className="space-y-2">
                    {pendingConversions.map((conversion) => (
                      <div key={conversion.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{getEpisodeTitle(conversion)}</p>
                          <p className="text-sm text-muted-foreground truncate">{conversion.original_url}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {getStatusBadge(conversion.status)}
                          <Button variant="ghost" size="sm" onClick={() => showFFmpegCommand(conversion)}>
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
        </TabsContent>

        <TabsContent value="processing">
          <Card className="border-blue-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-500">
                <RefreshCw className="h-5 w-5 animate-spin" />
                Currently Processing
              </CardTitle>
              <CardDescription>Videos currently being converted</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {processingConversions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No conversions in progress</p>
                ) : (
                  <div className="space-y-2">
                    {processingConversions.map((conversion) => (
                      <div key={conversion.id} className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{getEpisodeTitle(conversion)}</p>
                          <p className="text-sm text-muted-foreground">Started: {conversion.conversion_started_at ? new Date(conversion.conversion_started_at).toLocaleString() : 'Unknown'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(conversion.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-500">
                <Check className="h-5 w-5" />
                Completed Conversions
              </CardTitle>
              <CardDescription>Successfully converted videos</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {completedConversions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No completed conversions</p>
                ) : (
                  <div className="space-y-2">
                    {completedConversions.map((conversion) => (
                      <div key={conversion.id} className="flex items-center justify-between p-3 rounded-lg bg-green-500/5">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{getEpisodeTitle(conversion)}</p>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>Original: {formatFileSize(conversion.file_size_bytes)}</span>
                            <span>iOS: {formatFileSize(conversion.ios_file_size_bytes)}</span>
                            {conversion.video_codec && <span>Codec: {conversion.video_codec}</span>}
                            {conversion.conversion_started_at && conversion.conversion_completed_at && (
                              <span>Time: {formatDuration(conversion.conversion_started_at, conversion.conversion_completed_at)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {conversion.is_hevc && <Badge variant="outline" className="text-xs">HEVC</Badge>}
                          {conversion.is_10bit && <Badge variant="outline" className="text-xs">10-bit</Badge>}
                          <Check className="h-4 w-4 text-green-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failed">
          <Card className="border-red-500/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-red-500">
                    <X className="h-5 w-5" />
                    Failed Conversions
                  </CardTitle>
                  <CardDescription>Videos that failed to convert - review and retry</CardDescription>
                </div>
                {failedConversions.length > 0 && (
                  <Button variant="outline" size="sm" onClick={retryAllFailed}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry All Failed
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {failedConversions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No failed conversions</p>
                ) : (
                  <div className="space-y-2">
                    {failedConversions.map((conversion) => (
                      <div key={conversion.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{getEpisodeTitle(conversion)}</p>
                          <p className="text-sm text-red-500 truncate">{conversion.error_message || 'Unknown error'}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button variant="ghost" size="sm" onClick={() => showFFmpegCommand(conversion)}>
                            <Terminal className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => retryConversion(conversion.id)}>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Retry
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="worker">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Background Worker Setup
                </CardTitle>
                <CardDescription>Deploy a worker server to process video conversions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">Requirements</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• FFmpeg with H.264 encoding support</li>
                    <li>• NVIDIA GPU with NVENC (optional, for acceleration)</li>
                    <li>• Python 3.8+ or Bash</li>
                    <li>• Network access to video storage</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">Environment Variables</h4>
                  <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
{`SUPABASE_URL=${import.meta.env.VITE_SUPABASE_URL}
SUPABASE_SERVICE_KEY=<your-service-role-key>
STORAGE_BASE_PATH=/mnt/videos
CDN_BASE_URL=https://your-cdn.com`}
                  </pre>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText('python3 scripts/ffmpeg-worker.py --gpu --max-concurrent=2');
                    toast.success('Command copied!');
                  }}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Python Command
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText('./scripts/ffmpeg-worker.sh --gpu --max-concurrent=2');
                    toast.success('Command copied!');
                  }}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Bash Command
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  GPU Acceleration
                </CardTitle>
                <CardDescription>Supported hardware encoders for fast conversion</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10">
                    <Zap className="h-6 w-6 text-green-500" />
                    <div>
                      <p className="font-medium">NVIDIA NVENC</p>
                      <p className="text-sm text-muted-foreground">Fastest option for NVIDIA GPUs</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10">
                    <Zap className="h-6 w-6 text-blue-500" />
                    <div>
                      <p className="font-medium">Apple VideoToolbox</p>
                      <p className="text-sm text-muted-foreground">For macOS with Apple Silicon</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-500/10">
                    <Zap className="h-6 w-6 text-purple-500" />
                    <div>
                      <p className="font-medium">Intel VAAPI</p>
                      <p className="text-sm text-muted-foreground">For Intel integrated graphics</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Cpu className="h-6 w-6 text-muted-foreground" />
                    <div>
                      <p className="font-medium">CPU Fallback</p>
                      <p className="text-sm text-muted-foreground">libx264 when no GPU available</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

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
              <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={copyCommand}>
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
