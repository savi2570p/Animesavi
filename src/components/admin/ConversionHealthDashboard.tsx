 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Progress } from '@/components/ui/progress';
 import { Skeleton } from '@/components/ui/skeleton';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Input } from '@/components/ui/input';
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from '@/components/ui/table';
  import { toast } from 'sonner';
  import {
    RefreshCw,
    Check,
    X,
    Clock,
    AlertTriangle,
    Smartphone,
    Activity,
    Server,
    Search,
    Wrench,
    Play,
    Film,
    Tv,
    FileVideo,
    Volume2,
    Subtitles,
    Shield,
    Zap,
    RotateCcw,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2,
    Pause,
    Square,
  } from 'lucide-react';
 
 interface VideoHealthRecord {
   id: string;
   episode_id: string | null;
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
         type: string;
       };
     };
   };
 }
 
  interface HealthStats {
    total: number;
    healthy: number;
    processing: number;
    hlsPending: number;
    failed: number;
    iosRisk: number;
    estimatedTotalMinutes: number;
  }
 
 interface PipelineStatus {
   uploadQueue: number;
   mp4Conversion: number;
   hlsGeneration: number;
   audioMapping: number;
   activeJobs: number;
   pendingJobs: number;
   failedJobs: number;
   retryCount: number;
 }
 
 interface RepairProgress {
   isRunning: boolean;
   total: number;
   processed: number;
   converted: number;
   repaired: number;
   skipped: number;
   failed: number;
   currentItem: string;
 }
 
 export function ConversionHealthDashboard() {
    const [healthStats, setHealthStats] = useState<HealthStats>({
      total: 0,
      healthy: 0,
      processing: 0,
      hlsPending: 0,
      failed: 0,
      iosRisk: 0,
      estimatedTotalMinutes: 0,
    });
   const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>({
     uploadQueue: 0,
     mp4Conversion: 0,
     hlsGeneration: 0,
     audioMapping: 0,
     activeJobs: 0,
     pendingJobs: 0,
     failedJobs: 0,
     retryCount: 0,
   });
   const [videoRecords, setVideoRecords] = useState<VideoHealthRecord[]>([]);
   const [filteredRecords, setFilteredRecords] = useState<VideoHealthRecord[]>([]);
   const [loading, setLoading] = useState(true);
   const [searchQuery, setSearchQuery] = useState('');
   const [filterType, setFilterType] = useState<'all' | 'ios-risk' | 'failed' | 'healthy' | 'compatible'>('all');
   const [repairProgress, setRepairProgress] = useState<RepairProgress>({
     isRunning: false,
     total: 0,
     processed: 0,
     converted: 0,
     repaired: 0,
     skipped: 0,
     failed: 0,
     currentItem: '',
   });
   const [activeTab, setActiveTab] = useState('overview');
 
   const fetchData = useCallback(async () => {
     setLoading(true);
     try {
       const { data: conversions, error } = await supabase
         .from('video_conversions')
         .select(`
           *,
           episodes (
             title,
             episode_number,
             seasons (
               season_number,
               anime (
                 title,
                 type
               )
             )
           )
         `)
         .order('updated_at', { ascending: false });
 
       if (error) throw error;
 
       const records = (conversions as VideoHealthRecord[]) || [];
       setVideoRecords(records);
 
        // Calculate health stats
        const pendingCount = records.filter(r => r.status === 'pending').length;
        const processingCount = records.filter(r => r.status === 'processing').length;
         // Estimate ~1 min per video for optimized conversion
         const estimatedMinutes = (pendingCount + processingCount) * 1;
        const stats: HealthStats = {
          total: records.length,
          healthy: records.filter(r => r.status === 'completed' && r.ios_ready_url).length,
          processing: processingCount,
          hlsPending: pendingCount,
          failed: records.filter(r => r.status === 'failed').length,
          iosRisk: records.filter(r => isIosRisk(r)).length,
          estimatedTotalMinutes: estimatedMinutes,
        };
       setHealthStats(stats);
 
       // Calculate pipeline status
       const pipeline: PipelineStatus = {
         uploadQueue: 0,
         mp4Conversion: records.filter(r => r.status === 'pending' && r.needs_conversion).length,
         hlsGeneration: records.filter(r => r.status === 'pending' && !r.needs_conversion).length,
         audioMapping: 0,
         activeJobs: records.filter(r => r.status === 'processing').length,
         pendingJobs: records.filter(r => r.status === 'pending').length,
         failedJobs: records.filter(r => r.status === 'failed').length,
         retryCount: 0,
       };
       setPipelineStatus(pipeline);
 
     } catch (error) {
       console.error('Error fetching health data:', error);
       toast.error('Failed to fetch health data');
     } finally {
       setLoading(false);
     }
   }, []);
 
   useEffect(() => {
     fetchData();
 
     const channel = supabase
       .channel('health_dashboard_changes')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'video_conversions' }, () => {
         fetchData();
       })
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [fetchData]);
 
   useEffect(() => {
     let filtered = videoRecords;
 
     if (searchQuery) {
       const query = searchQuery.toLowerCase();
       filtered = filtered.filter(r => 
         getVideoTitle(r).toLowerCase().includes(query) ||
         r.original_url.toLowerCase().includes(query)
       );
     }
 
      switch (filterType) {
        case 'ios-risk':
          filtered = filtered.filter(r => isIosRisk(r));
          break;
        case 'failed':
          filtered = filtered.filter(r => r.status === 'failed');
          break;
        case 'healthy':
          filtered = filtered.filter(r => r.status === 'completed' && r.ios_ready_url);
          break;
        case 'compatible':
          filtered = filtered.filter(r => r.status === 'completed' && !r.needs_conversion);
          break;
      }
 
     setFilteredRecords(filtered);
   }, [videoRecords, searchQuery, filterType]);
 
   const isIosRisk = (record: VideoHealthRecord): boolean => {
     if (record.status === 'failed') return true;
     if (record.status === 'pending' && record.needs_conversion) return true;
     if (!record.ios_ready_url && record.needs_conversion) return true;
     return false;
   };
 
   const getVideoTitle = (record: VideoHealthRecord): string => {
     if (!record.episodes) return 'Unknown Video';
     const anime = record.episodes.seasons?.anime?.title || 'Unknown';
     const season = record.episodes.seasons?.season_number || 1;
     const episode = record.episodes.episode_number || 1;
     return `${anime} - S${season}E${episode}`;
   };
 
   const getVideoType = (record: VideoHealthRecord): 'movie' | 'episode' => {
     return record.episodes?.seasons?.anime?.type === 'movie' ? 'movie' : 'episode';
   };
 
   const getHealthStatus = (record: VideoHealthRecord): { label: string; color: string; icon: React.ReactNode } => {
     if (record.status === 'completed' && record.ios_ready_url) {
       return { label: 'Healthy', color: 'text-green-500', icon: <CheckCircle2 className="h-4 w-4" /> };
     }
     if (record.status === 'processing') {
       return { label: 'Processing', color: 'text-blue-500', icon: <Loader2 className="h-4 w-4 animate-spin" /> };
     }
     if (record.status === 'failed') {
       return { label: 'Failed', color: 'text-red-500', icon: <XCircle className="h-4 w-4" /> };
     }
     if (record.status === 'pending') {
       return { label: 'Pending', color: 'text-yellow-500', icon: <Clock className="h-4 w-4" /> };
     }
     if (isIosRisk(record)) {
       return { label: 'iOS Risk', color: 'text-orange-500', icon: <AlertTriangle className="h-4 w-4" /> };
     }
     return { label: 'Unknown', color: 'text-muted-foreground', icon: <AlertCircle className="h-4 w-4" /> };
   };
 
   const formatFileSize = (bytes: number | null): string => {
     if (!bytes) return 'N/A';
     if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
     if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
     return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
   };
 
   const reprocessVideo = async (conversionId: string) => {
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
       toast.success('Video queued for reprocessing');
       fetchData();
     } catch (error) {
       console.error('Error reprocessing video:', error);
       toast.error('Failed to reprocess video');
     }
   };
 
   const fixAllOldAnime = async () => {
     setRepairProgress({
       isRunning: true,
       total: healthStats.iosRisk + healthStats.failed,
       processed: 0,
       converted: 0,
       repaired: 0,
       skipped: 0,
       failed: 0,
       currentItem: 'Starting repair...',
     });
 
     try {
       // Get all videos that need repair
       const { data: videosToRepair, error } = await supabase
         .from('video_conversions')
         .select('id, original_url, status, needs_conversion, ios_ready_url, episode_id')
         .or('status.eq.failed,status.eq.pending,ios_ready_url.is.null');
 
       if (error) throw error;
 
       const toRepair = videosToRepair || [];
       let processed = 0;
       let converted = 0;
       let repaired = 0;
       let skipped = 0;
       let failedCount = 0;
 
       for (const video of toRepair) {
         setRepairProgress(prev => ({
           ...prev,
           currentItem: `Processing: ${video.original_url.split('/').pop()}`,
           processed,
         }));
 
         // Check if already completed
         if (video.status === 'completed' && video.ios_ready_url) {
           skipped++;
           processed++;
           continue;
         }
 
          // Start conversion immediately
          const { error: updateError } = await supabase
            .from('video_conversions')
            .update({
              status: 'processing',
              error_message: null,
              conversion_started_at: new Date().toISOString(),
              conversion_completed_at: null,
              needs_conversion: true,
            })
            .eq('id', video.id);
 
         if (updateError) {
           failedCount++;
         } else {
           repaired++;
         }
         processed++;
       }
 
       setRepairProgress(prev => ({
         ...prev,
         isRunning: false,
         processed,
         converted,
         repaired,
         skipped,
         failed: failedCount,
         currentItem: 'Repair complete!',
       }));
 
       toast.success(`Repair complete: ${repaired} queued, ${skipped} skipped, ${failedCount} failed`);
       fetchData();
     } catch (error) {
       console.error('Error repairing videos:', error);
       toast.error('Repair process failed');
       setRepairProgress(prev => ({ ...prev, isRunning: false }));
     }
   };
 
   const retryAllFailed = async () => {
     try {
       const { data, error } = await supabase
         .from('video_conversions')
         .update({
           status: 'pending',
           error_message: null,
           conversion_started_at: null,
           conversion_completed_at: null,
         })
         .eq('status', 'failed')
         .select();
 
       if (error) throw error;
       toast.success(`Queued ${data?.length || 0} failed conversions for retry`);
       fetchData();
     } catch (error) {
       console.error('Error retrying failed conversions:', error);
       toast.error('Failed to retry conversions');
     }
   };
 
   const healthPercentage = healthStats.total > 0 
     ? Math.round((healthStats.healthy / healthStats.total) * 100) 
     : 0;
 
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
             <Activity className="h-6 w-6 text-primary" />
             Conversion Health Dashboard
           </h2>
           <p className="text-muted-foreground">Real-time visibility into video processing health</p>
         </div>
         <div className="flex gap-2">
           <Button variant="outline" onClick={fetchData} disabled={loading}>
             <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
             Refresh
           </Button>
         </div>
       </div>
 
       {/* Overall Status Summary */}
       <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
         <Card>
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">Total</p>
                 <p className="text-2xl font-bold">{healthStats.total}</p>
               </div>
               <FileVideo className="h-8 w-8 text-muted-foreground/30" />
             </div>
           </CardContent>
         </Card>
         <Card className="border-green-500/30">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">Healthy</p>
                 <p className="text-2xl font-bold text-green-500">{healthStats.healthy}</p>
               </div>
               <CheckCircle2 className="h-8 w-8 text-green-500/30" />
             </div>
           </CardContent>
         </Card>
         <Card className="border-blue-500/30">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">Processing</p>
                 <p className="text-2xl font-bold text-blue-500">{healthStats.processing}</p>
               </div>
               <Loader2 className="h-8 w-8 text-blue-500/30 animate-spin" />
             </div>
           </CardContent>
         </Card>
         <Card className="border-yellow-500/30">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">HLS Pending</p>
                 <p className="text-2xl font-bold text-yellow-500">{healthStats.hlsPending}</p>
               </div>
               <Clock className="h-8 w-8 text-yellow-500/30" />
             </div>
           </CardContent>
         </Card>
         <Card className="border-red-500/30">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">Failed</p>
                 <p className="text-2xl font-bold text-red-500">{healthStats.failed}</p>
               </div>
               <XCircle className="h-8 w-8 text-red-500/30" />
             </div>
           </CardContent>
         </Card>
         <Card className="border-orange-500/30">
           <CardContent className="p-4">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">iOS Risk</p>
                 <p className="text-2xl font-bold text-orange-500">{healthStats.iosRisk}</p>
               </div>
               <Smartphone className="h-8 w-8 text-orange-500/30" />
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Health Progress Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  Overall Platform Health
                </span>
                <span className={healthPercentage >= 80 ? 'text-green-500' : healthPercentage >= 50 ? 'text-yellow-500' : 'text-red-500'}>
                  {healthPercentage}% Healthy
                </span>
              </div>
              <Progress value={healthPercentage} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Estimated Time */}
        {(healthStats.processing > 0 || healthStats.hlsPending > 0) && (
          <Card className="border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Estimated Time to Complete</p>
                    <p className="text-sm text-muted-foreground">
                      {healthStats.processing + healthStats.hlsPending} videos remaining
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-500">
                    {healthStats.estimatedTotalMinutes >= 60
                      ? `${Math.floor(healthStats.estimatedTotalMinutes / 60)}h ${healthStats.estimatedTotalMinutes % 60}m`
                      : `${healthStats.estimatedTotalMinutes}m`}
                  </p>
                  <p className="text-xs text-muted-foreground">~1 min per video</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
 
       {/* Tabs */}
       <Tabs value={activeTab} onValueChange={setActiveTab}>
         <TabsList>
           <TabsTrigger value="overview">Overview</TabsTrigger>
           <TabsTrigger value="pipeline">Pipeline Status</TabsTrigger>
           <TabsTrigger value="videos">Video Health</TabsTrigger>
           <TabsTrigger value="ios-safety">iOS Safety</TabsTrigger>
           <TabsTrigger value="actions">Quick Actions</TabsTrigger>
           <TabsTrigger value="logs">Logs</TabsTrigger>
         </TabsList>
 
         <TabsContent value="overview" className="space-y-4">
           {/* Repair Progress */}
           {repairProgress.isRunning && (
             <Card className="border-purple-500/30">
               <CardHeader>
                 <CardTitle className="flex items-center gap-2 text-purple-500">
                   <Wrench className="h-5 w-5 animate-pulse" />
                   Repair In Progress
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                   <Progress value={(repairProgress.processed / repairProgress.total) * 100} className="h-2" />
                   <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                     <div>
                       <p className="text-muted-foreground">Processed</p>
                       <p className="font-bold">{repairProgress.processed} / {repairProgress.total}</p>
                     </div>
                     <div>
                       <p className="text-muted-foreground">Repaired</p>
                       <p className="font-bold text-green-500">{repairProgress.repaired}</p>
                     </div>
                     <div>
                       <p className="text-muted-foreground">Skipped</p>
                       <p className="font-bold text-muted-foreground">{repairProgress.skipped}</p>
                     </div>
                     <div>
                       <p className="text-muted-foreground">Failed</p>
                       <p className="font-bold text-red-500">{repairProgress.failed}</p>
                     </div>
                     <div className="col-span-2 md:col-span-1">
                       <p className="text-muted-foreground">Current</p>
                       <p className="font-mono text-xs truncate">{repairProgress.currentItem}</p>
                     </div>
                   </div>
                 </div>
               </CardContent>
             </Card>
           )}
 
           {/* Quick Stats Cards */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <Tv className="h-5 w-5" />
                   Episodes Status
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="space-y-3">
                   {[
                     { label: 'Fully Playable', count: healthStats.healthy, color: 'bg-green-500' },
                     { label: 'Processing', count: healthStats.processing, color: 'bg-blue-500' },
                     { label: 'Pending', count: healthStats.hlsPending, color: 'bg-yellow-500' },
                     { label: 'Failed', count: healthStats.failed, color: 'bg-red-500' },
                   ].map(item => (
                     <div key={item.label} className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <div className={`w-3 h-3 rounded-full ${item.color}`} />
                         <span className="text-sm">{item.label}</span>
                       </div>
                       <span className="font-bold">{item.count}</span>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
 
             <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <Smartphone className="h-5 w-5" />
                   iOS Compatibility
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <span>Compatible</span>
                     <Badge className="bg-green-500">{healthStats.healthy}</Badge>
                   </div>
                   <div className="flex items-center justify-between">
                     <span>At Risk</span>
                     <Badge className="bg-orange-500">{healthStats.iosRisk}</Badge>
                   </div>
                   <div className="flex items-center justify-between">
                     <span>Conversion Rate</span>
                     <Badge variant="outline">{healthPercentage}%</Badge>
                   </div>
                 </div>
               </CardContent>
             </Card>
           </div>
         </TabsContent>
 
         <TabsContent value="pipeline" className="space-y-4">
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Zap className="h-5 w-5" />
                 Conversion Pipeline Status
               </CardTitle>
               <CardDescription>Live status of video processing stages</CardDescription>
             </CardHeader>
             <CardContent>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="p-4 rounded-lg bg-muted/50 text-center">
                   <p className="text-3xl font-bold text-blue-500">{pipelineStatus.mp4Conversion}</p>
                   <p className="text-sm text-muted-foreground">MP4 Conversion Queue</p>
                 </div>
                 <div className="p-4 rounded-lg bg-muted/50 text-center">
                   <p className="text-3xl font-bold text-purple-500">{pipelineStatus.hlsGeneration}</p>
                   <p className="text-sm text-muted-foreground">HLS Generation</p>
                 </div>
                 <div className="p-4 rounded-lg bg-muted/50 text-center">
                   <p className="text-3xl font-bold text-green-500">{pipelineStatus.activeJobs}</p>
                   <p className="text-sm text-muted-foreground">Active Jobs</p>
                 </div>
                 <div className="p-4 rounded-lg bg-muted/50 text-center">
                   <p className="text-3xl font-bold text-red-500">{pipelineStatus.failedJobs}</p>
                   <p className="text-sm text-muted-foreground">Failed Jobs</p>
                 </div>
               </div>
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Server className="h-5 w-5" />
                 Worker Health
               </CardTitle>
             </CardHeader>
             <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-4">
                    <div className="h-4 w-4 rounded-full bg-green-500 animate-pulse" />
                    <div>
                      <p className="font-medium">Worker Status: Ready</p>
                      <p className="text-sm text-muted-foreground">
                        Background processing available via FFmpeg worker scripts
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase
                            .from('video_conversions')
                            .update({
                              status: 'processing',
                              conversion_started_at: new Date().toISOString(),
                              error_message: null,
                            })
                            .eq('status', 'pending')
                            .select();
                          if (error) throw error;
                          toast.success(`Started ${data?.length || 0} pending conversions`);
                          fetchData();
                        } catch (err) {
                          console.error(err);
                          toast.error('Failed to start conversions');
                        }
                      }}
                      disabled={pipelineStatus.pendingJobs === 0}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start ({pipelineStatus.pendingJobs})
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase
                            .from('video_conversions')
                            .update({
                              status: 'pending',
                              conversion_started_at: null,
                            })
                            .eq('status', 'processing')
                            .select();
                          if (error) throw error;
                          toast.success(`Paused ${data?.length || 0} active conversions`);
                          fetchData();
                        } catch (err) {
                          console.error(err);
                          toast.error('Failed to pause conversions');
                        }
                      }}
                      disabled={pipelineStatus.activeJobs === 0}
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pause ({pipelineStatus.activeJobs})
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase
                            .from('video_conversions')
                            .update({
                              status: 'pending',
                              conversion_started_at: null,
                              error_message: 'Stopped by admin',
                            })
                            .eq('status', 'processing')
                            .select();
                          if (error) throw error;
                          toast.success(`Stopped ${data?.length || 0} conversions`);
                          fetchData();
                        } catch (err) {
                          console.error(err);
                          toast.error('Failed to stop conversions');
                        }
                      }}
                      disabled={pipelineStatus.activeJobs === 0}
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                  </div>
                </div>
             </CardContent>
           </Card>
         </TabsContent>
 
         <TabsContent value="videos" className="space-y-4">
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <FileVideo className="h-5 w-5" />
                 Video Health Table
               </CardTitle>
               <CardDescription>Detailed status of all video files</CardDescription>
             </CardHeader>
             <CardContent>
               <div className="flex gap-4 mb-4">
                 <div className="relative flex-1">
                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <Input
                     placeholder="Search videos..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="pl-10"
                   />
                 </div>
                  <div className="flex gap-2 flex-wrap">
                    {(['all', 'compatible', 'ios-risk', 'failed', 'healthy'] as const).map(filter => (
                      <Button
                        key={filter}
                        variant={filterType === filter ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterType(filter)}
                      >
                        {filter === 'all' ? 'All' : filter === 'ios-risk' ? 'iOS Risk' : filter === 'compatible' ? 'Compatible' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </Button>
                    ))}
                 </div>
               </div>
 
               <ScrollArea className="h-[400px]">
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Title</TableHead>
                       <TableHead>Type</TableHead>
                       <TableHead>Format</TableHead>
                       <TableHead>iOS MP4</TableHead>
                       <TableHead>HLS</TableHead>
                       <TableHead>Audio</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Est. Time</TableHead>
                        <TableHead>Actions</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {filteredRecords.slice(0, 50).map((record) => {
                       const health = getHealthStatus(record);
                       const originalFormat = record.original_url.split('.').pop()?.toUpperCase() || 'MP4';
 
                       return (
                         <TableRow key={record.id}>
                           <TableCell className="font-medium max-w-[200px] truncate">
                             {getVideoTitle(record)}
                           </TableCell>
                           <TableCell>
                             {getVideoType(record) === 'movie' ? (
                               <Badge variant="outline"><Film className="h-3 w-3 mr-1" /> Movie</Badge>
                             ) : (
                               <Badge variant="outline"><Tv className="h-3 w-3 mr-1" /> Episode</Badge>
                             )}
                           </TableCell>
                           <TableCell>
                             <Badge variant="secondary">{originalFormat}</Badge>
                           </TableCell>
                           <TableCell>
                             {record.ios_ready_url ? (
                               <Badge className="bg-green-500">Ready</Badge>
                             ) : (
                               <Badge variant="outline" className="text-orange-500">Missing</Badge>
                             )}
                           </TableCell>
                           <TableCell>
                             {record.ios_ready_url?.includes('.m3u8') ? (
                               <Badge className="bg-purple-500">Ready</Badge>
                             ) : (
                               <Badge variant="outline">N/A</Badge>
                             )}
                           </TableCell>
                           <TableCell>
                             <div className="flex items-center gap-1">
                               <Volume2 className="h-3 w-3" />
                               <span className="text-xs">{record.audio_codec || 'Unknown'}</span>
                             </div>
                           </TableCell>
                           <TableCell>
                             <div className={`flex items-center gap-1 ${health.color}`}>
                               {health.icon}
                               <span className="text-xs">{health.label}</span>
                             </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {record.status === 'processing' || record.status === 'pending' ? '~1 min' : record.status === 'completed' ? '✓' : '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => reprocessVideo(record.id)}
                               disabled={record.status === 'processing'}
                             >
                               <RotateCcw className="h-4 w-4" />
                             </Button>
                           </TableCell>
                         </TableRow>
                       );
                     })}
                   </TableBody>
                 </Table>
               </ScrollArea>
             </CardContent>
           </Card>
         </TabsContent>
 
         <TabsContent value="ios-safety" className="space-y-4">
           <Card className="border-orange-500/30">
             <CardHeader>
               <CardTitle className="flex items-center gap-2 text-orange-500">
                 <Smartphone className="h-5 w-5" />
                 iOS Playback Safety Check
               </CardTitle>
               <CardDescription>
                 Videos flagged as potential playback issues on iOS devices
               </CardDescription>
             </CardHeader>
             <CardContent>
               <ScrollArea className="h-[300px]">
                 <div className="space-y-2">
                   {videoRecords.filter(r => isIosRisk(r)).map((record) => (
                     <div
                       key={record.id}
                       className="flex items-center justify-between p-3 rounded-lg bg-orange-500/5 border border-orange-500/20"
                     >
                       <div className="flex-1 min-w-0">
                         <p className="font-medium truncate">{getVideoTitle(record)}</p>
                         <div className="flex gap-2 mt-1">
                           {!record.ios_ready_url && (
                             <Badge variant="outline" className="text-orange-500 text-xs">Missing MP4</Badge>
                           )}
                           {record.is_hevc && (
                             <Badge variant="outline" className="text-orange-500 text-xs">HEVC</Badge>
                           )}
                           {record.is_10bit && (
                             <Badge variant="outline" className="text-orange-500 text-xs">10-bit</Badge>
                           )}
                           {record.status === 'failed' && (
                             <Badge variant="outline" className="text-red-500 text-xs">Failed</Badge>
                           )}
                         </div>
                       </div>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => reprocessVideo(record.id)}
                       >
                         <Wrench className="h-4 w-4 mr-1" />
                         Fix
                       </Button>
                     </div>
                   ))}
                   {videoRecords.filter(r => isIosRisk(r)).length === 0 && (
                     <div className="text-center py-8 text-muted-foreground">
                       <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                       <p>All videos are iOS-compatible!</p>
                     </div>
                   )}
                 </div>
               </ScrollArea>
             </CardContent>
           </Card>
         </TabsContent>
 
         <TabsContent value="actions" className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Card>
               <CardHeader>
              <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-orange-500" />
                    Fix All iOS Playback Issues
                  </CardTitle>
                  <CardDescription>
                    Revalidate all videos with real codec inspection and queue incompatible ones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Scans every video, validates actual codecs via ffprobe, and queues non-compliant files for conversion.
                    </p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Validate H.264 Main profile + yuv420p</li>
                      <li>• Verify AAC stereo audio</li>
                      <li>• Queue incompatible for smart conversion</li>
                      <li>• Auto-generate HLS after conversion</li>
                    </ul>
                   <Button
                     onClick={fixAllOldAnime}
                     disabled={repairProgress.isRunning}
                     className="w-full"
                   >
                     {repairProgress.isRunning ? (
                       <>
                         <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                         Repairing...
                       </>
                     ) : (
                       <>
                         <Wrench className="h-4 w-4 mr-2" />
                         Fix All Old Anime
                       </>
                     )}
                   </Button>
                 </div>
               </CardContent>
             </Card>
 
             <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <RotateCcw className="h-5 w-5" />
                   Retry All Failed
                 </CardTitle>
                 <CardDescription>
                   Queue all failed conversions for retry
                 </CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                   <p className="text-sm text-muted-foreground">
                     {healthStats.failed} videos have failed conversion.
                     Retry them with updated settings.
                   </p>
                   <Button
                     onClick={retryAllFailed}
                     variant="outline"
                     className="w-full"
                     disabled={healthStats.failed === 0}
                   >
                     <RotateCcw className="h-4 w-4 mr-2" />
                     Retry {healthStats.failed} Failed Jobs
                   </Button>
                 </div>
               </CardContent>
             </Card>
           </div>
         </TabsContent>
 
         <TabsContent value="logs" className="space-y-4">
           <Card>
             <CardHeader>
               <CardTitle>Recent Activity Logs</CardTitle>
               <CardDescription>Processing history and status changes</CardDescription>
             </CardHeader>
             <CardContent>
               <ScrollArea className="h-[300px]">
                 <div className="space-y-2">
                   {videoRecords.slice(0, 20).map((record) => (
                     <div
                       key={record.id}
                       className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm"
                     >
                       <div className="flex items-center gap-2">
                         {record.status === 'completed' && <Check className="h-4 w-4 text-green-500" />}
                         {record.status === 'failed' && <X className="h-4 w-4 text-red-500" />}
                         {record.status === 'processing' && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                         {record.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                         <span className="truncate max-w-[300px]">{getVideoTitle(record)}</span>
                       </div>
                       <span className="text-muted-foreground text-xs">
                         {new Date(record.updated_at).toLocaleString()}
                       </span>
                     </div>
                   ))}
                 </div>
               </ScrollArea>
             </CardContent>
           </Card>
         </TabsContent>
       </Tabs>
     </div>
   );
 }