import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileVideo,
  Zap,
  HardDrive,
  Clock,
  Settings2,
  Search,
  Download,
  Copy,
  ExternalLink,
} from 'lucide-react';

interface VideoFile {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string;
  episodeId?: string;
  animeTitle?: string;
  episodeNumber?: number;
  createdAt: string;
  // Encoding analysis
  analysis?: VideoAnalysis;
}

interface VideoAnalysis {
  hasValidCodec: boolean;
  codecProfile: string;
  codecLevel: string;
  hasFastStart: boolean;
  resolution: string;
  bitrate: number;
  duration: number;
  audioCodec: string;
  issues: string[];
  recommendations: string[];
}

interface EncodingJob {
  id: string;
  videoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  outputUrl?: string;
}

export function VideoEncodingDashboard() {
  const { user, isAdmin } = useAuth();
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [encodingJobs, setEncodingJobs] = useState<EncodingJob[]>([]);
  const [activeTab, setActiveTab] = useState('videos');

  useEffect(() => {
    if (isAdmin) {
      fetchVideos();
    }
  }, [isAdmin]);

  const fetchVideos = async () => {
    setIsLoading(true);
    try {
      // Fetch all episodes with video URLs
      const { data: episodes, error } = await supabase
        .from('episodes')
        .select(`
          id,
          title,
          video_url,
          external_url,
          created_at,
          episode_number,
          season:seasons (
            season_number,
            anime:anime (
              id,
              title
            )
          )
        `)
        .or('video_url.not.is.null,external_url.not.is.null')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const videoFiles: VideoFile[] = (episodes || []).map(ep => {
        const videoUrl = ep.video_url || ep.external_url || '';
        const fileName = videoUrl.split('/').pop() || 'Unknown';
        
        return {
          id: ep.id,
          name: fileName,
          path: videoUrl,
          url: videoUrl,
          size: 0, // Would need to fetch from storage
          mimeType: videoUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4',
          episodeId: ep.id,
          animeTitle: (ep.season as any)?.anime?.title || 'Unknown',
          episodeNumber: ep.episode_number,
          createdAt: ep.created_at,
          analysis: analyzeVideoUrl(videoUrl),
        };
      });

      setVideos(videoFiles);
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast.error('Failed to load videos');
    } finally {
      setIsLoading(false);
    }
  };

  // Mock video analysis based on URL patterns
  const analyzeVideoUrl = (url: string): VideoAnalysis => {
    const isHls = url.includes('.m3u8');
    const isSupabaseStorage = url.includes('supabase');
    
    // Mock analysis - in production, this would analyze actual file metadata
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (!url.includes('faststart') && !isHls) {
      issues.push('Missing faststart flag');
      recommendations.push('Re-encode with -movflags +faststart');
    }
    
    if (url.includes('1080') || url.includes('1920')) {
      // Likely high quality
    } else if (!isHls) {
      issues.push('Unknown resolution');
      recommendations.push('Consider adding resolution variants');
    }

    if (!isHls && !url.includes('baseline') && !url.includes('main')) {
      recommendations.push('Consider using H.264 Main Profile for better compatibility');
    }

    return {
      hasValidCodec: true,
      codecProfile: isHls ? 'HLS Adaptive' : 'H.264 Main',
      codecLevel: '4.0',
      hasFastStart: isHls || url.includes('faststart'),
      resolution: isHls ? 'Adaptive' : '720p', // Mock
      bitrate: 2500000, // Mock 2.5 Mbps
      duration: 1440, // Mock 24 min
      audioCodec: 'AAC-LC',
      issues,
      recommendations,
    };
  };

  const toggleVideoSelection = (videoId: string) => {
    const newSelection = new Set(selectedVideos);
    if (newSelection.has(videoId)) {
      newSelection.delete(videoId);
    } else {
      newSelection.add(videoId);
    }
    setSelectedVideos(newSelection);
  };

  const selectAllVideos = () => {
    if (selectedVideos.size === filteredVideos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(filteredVideos.map(v => v.id)));
    }
  };

  const startBulkEncoding = () => {
    if (selectedVideos.size === 0) {
      toast.error('No videos selected');
      return;
    }

    // Create mock encoding jobs
    const jobs: EncodingJob[] = Array.from(selectedVideos).map((videoId, index) => ({
      id: `job-${Date.now()}-${index}`,
      videoId,
      status: 'pending',
      progress: 0,
      startedAt: new Date().toISOString(),
    }));

    setEncodingJobs(prev => [...jobs, ...prev]);
    setActiveTab('jobs');
    toast.success(`Started ${jobs.length} encoding job(s)`);

    // Simulate encoding progress
    simulateEncodingProgress(jobs);
  };

  const simulateEncodingProgress = (jobs: EncodingJob[]) => {
    jobs.forEach((job, index) => {
      // Stagger job starts
      setTimeout(() => {
        const interval = setInterval(() => {
          setEncodingJobs(prev => {
            const updated = [...prev];
            const jobIndex = updated.findIndex(j => j.id === job.id);
            if (jobIndex !== -1) {
              const currentProgress = updated[jobIndex].progress;
              if (currentProgress >= 100) {
                updated[jobIndex] = {
                  ...updated[jobIndex],
                  status: 'completed',
                  progress: 100,
                  completedAt: new Date().toISOString(),
                };
                clearInterval(interval);
              } else {
                updated[jobIndex] = {
                  ...updated[jobIndex],
                  status: 'processing',
                  progress: Math.min(currentProgress + Math.random() * 15, 100),
                };
              }
            }
            return updated;
          });
        }, 1000);
      }, index * 2000);
    });
  };

  const getFFmpegCommand = (video: VideoFile, outputType: 'mp4' | 'hls' = 'mp4'): string => {
    const inputFile = video.name;
    const outputFile = inputFile.replace(/\.[^.]+$/, outputType === 'hls' ? '.m3u8' : '_optimized.mp4');
    
    if (outputType === 'hls') {
      return `ffmpeg -i "${inputFile}" \\
  -c:v libx264 -profile:v main -level:v 4.0 \\
  -preset fast -crf 23 -pix_fmt yuv420p \\
  -c:a aac -b:a 128k -ac 2 \\
  -vf "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease" \\
  -f hls -hls_time 10 -hls_playlist_type vod \\
  -hls_segment_filename 'segment_%03d.ts' \\
  "${outputFile}"`;
    }
    
    return `ffmpeg -i "${inputFile}" \\
  -c:v libx264 -profile:v main -level:v 4.0 \\
  -preset fast -crf 23 -pix_fmt yuv420p \\
  -c:a aac -b:a 128k -ac 2 \\
  -movflags +faststart \\
  -vf "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease" \\
  "${outputFile}"`;
  };

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    toast.success('FFmpeg command copied to clipboard');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredVideos = videos.filter(video => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      video.name.toLowerCase().includes(query) ||
      video.animeTitle?.toLowerCase().includes(query)
    );
  });

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Admin access required</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
            <FileVideo className="h-6 w-6 text-primary" />
            Video Encoding Dashboard
          </h2>
          <p className="text-muted-foreground">
            Analyze and re-encode videos for optimal playback
          </p>
        </div>
        <Button onClick={fetchVideos} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileVideo className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{videos.length}</p>
              <p className="text-sm text-muted-foreground">Total Videos</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xl font-bold">
                {videos.filter(v => v.analysis?.issues.length === 0).length}
              </p>
              <p className="text-sm text-muted-foreground">Optimized</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-xl font-bold">
                {videos.filter(v => (v.analysis?.issues.length || 0) > 0).length}
              </p>
              <p className="text-sm text-muted-foreground">Needs Work</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Zap className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold">
                {encodingJobs.filter(j => j.status === 'processing').length}
              </p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="videos">
            Videos ({videos.length})
          </TabsTrigger>
          <TabsTrigger value="jobs">
            Encoding Jobs ({encodingJobs.length})
          </TabsTrigger>
          <TabsTrigger value="commands">
            FFmpeg Commands
          </TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="space-y-4">
          {/* Search and actions */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllVideos}
            >
              {selectedVideos.size === filteredVideos.length ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              onClick={startBulkEncoding}
              disabled={selectedVideos.size === 0}
              className="bg-primary"
            >
              <Play className="h-4 w-4 mr-2" />
              Re-encode Selected ({selectedVideos.size})
            </Button>
          </div>

          {/* Video list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredVideos.map(video => (
                  <Card 
                    key={video.id}
                    className={`cursor-pointer transition-colors ${
                      selectedVideos.has(video.id) ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                    onClick={() => toggleVideoSelection(video.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={selectedVideos.has(video.id)}
                            onChange={() => {}}
                            className="h-4 w-4 rounded border-border"
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">
                              {video.animeTitle} - Episode {video.episodeNumber}
                            </h4>
                            {video.mimeType.includes('mpegURL') && (
                              <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                                HLS
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate mb-2">
                            {video.name}
                          </p>
                          
                          {/* Analysis results */}
                          {video.analysis && (
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={video.analysis.hasValidCodec ? 'secondary' : 'destructive'}>
                                {video.analysis.codecProfile}
                              </Badge>
                              <Badge variant={video.analysis.hasFastStart ? 'secondary' : 'destructive'}>
                                {video.analysis.hasFastStart ? '✓ FastStart' : '✗ No FastStart'}
                              </Badge>
                              <Badge variant="outline">
                                {video.analysis.resolution}
                              </Badge>
                              {video.analysis.issues.map((issue, i) => (
                                <Badge key={i} variant="destructive" className="text-xs">
                                  {issue}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(video.size)}
                          </p>
                          {video.analysis && (
                            <p className="text-xs text-muted-foreground">
                              {formatDuration(video.analysis.duration)}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          {encodingJobs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No encoding jobs</p>
                <p className="text-muted-foreground">Select videos and start re-encoding</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {encodingJobs.map(job => {
                const video = videos.find(v => v.id === job.videoId);
                return (
                  <Card key={job.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          {job.status === 'completed' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : job.status === 'failed' ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : job.status === 'processing' ? (
                            <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                          ) : (
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">
                              {video?.animeTitle || 'Unknown'} - Episode {video?.episodeNumber || '?'}
                            </h4>
                            <Badge 
                              variant={
                                job.status === 'completed' ? 'secondary' :
                                job.status === 'failed' ? 'destructive' :
                                job.status === 'processing' ? 'default' : 'outline'
                              }
                            >
                              {job.status}
                            </Badge>
                          </div>
                          
                          {job.status === 'processing' && (
                            <div className="space-y-1">
                              <Progress value={job.progress} className="h-2" />
                              <p className="text-xs text-muted-foreground">
                                {Math.round(job.progress)}% complete
                              </p>
                            </div>
                          )}
                          
                          {job.error && (
                            <p className="text-sm text-destructive mt-1">{job.error}</p>
                          )}
                        </div>

                        <div className="flex-shrink-0 text-right text-sm text-muted-foreground">
                          <p>Started: {new Date(job.startedAt).toLocaleTimeString()}</p>
                          {job.completedAt && (
                            <p>Completed: {new Date(job.completedAt).toLocaleTimeString()}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="commands" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                FFmpeg Commands
              </CardTitle>
              <CardDescription>
                Use these commands to manually re-encode videos for optimal playback
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* MP4 with FastStart */}
              <div>
                <h4 className="font-medium mb-2">MP4 with FastStart (Universal Compatibility)</h4>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`ffmpeg -i "input.mp4" \\
  -c:v libx264 -profile:v main -level:v 4.0 \\
  -preset fast -crf 23 -pix_fmt yuv420p \\
  -c:a aac -b:a 128k -ac 2 \\
  -movflags +faststart \\
  -vf "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease" \\
  "output_720p.mp4"`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyCommand(`ffmpeg -i "input.mp4" -c:v libx264 -profile:v main -level:v 4.0 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -ac 2 -movflags +faststart -vf "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease" "output_720p.mp4"`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* HLS for Streaming */}
              <div>
                <h4 className="font-medium mb-2">HLS for Adaptive Streaming</h4>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`ffmpeg -i "input.mp4" \\
  -c:v libx264 -profile:v main -level:v 4.0 \\
  -preset fast -crf 23 -pix_fmt yuv420p \\
  -c:a aac -b:a 128k -ac 2 \\
  -vf "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease" \\
  -f hls -hls_time 10 -hls_playlist_type vod \\
  -hls_segment_filename 'segment_%03d.ts' \\
  "stream.m3u8"`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyCommand(`ffmpeg -i "input.mp4" -c:v libx264 -profile:v main -level:v 4.0 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -ac 2 -vf "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease" -f hls -hls_time 10 -hls_playlist_type vod -hls_segment_filename 'segment_%03d.ts' "stream.m3u8"`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Baseline for Maximum Compatibility */}
              <div>
                <h4 className="font-medium mb-2">Baseline Profile (Older Devices)</h4>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`ffmpeg -i "input.mp4" \\
  -c:v libx264 -profile:v baseline -level:v 3.1 \\
  -preset fast -crf 25 -pix_fmt yuv420p \\
  -c:a aac -b:a 96k -ac 2 \\
  -movflags +faststart \\
  -vf "scale='min(720,iw)':'min(480,ih)':force_original_aspect_ratio=decrease" \\
  "output_480p_baseline.mp4"`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyCommand(`ffmpeg -i "input.mp4" -c:v libx264 -profile:v baseline -level:v 3.1 -preset fast -crf 25 -pix_fmt yuv420p -c:a aac -b:a 96k -ac 2 -movflags +faststart -vf "scale='min(720,iw)':'min(480,ih)':force_original_aspect_ratio=decrease" "output_480p_baseline.mp4"`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Verification */}
              <div>
                <h4 className="font-medium mb-2">Verify Encoding</h4>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`ffprobe -v error -select_streams v:0 \\
  -show_entries stream=codec_name,profile,level,pix_fmt \\
  -of default=noprint_wrappers=1 video.mp4`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyCommand(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,profile,level,pix_fmt -of default=noprint_wrappers=1 video.mp4`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
