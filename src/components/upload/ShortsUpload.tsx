import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Scissors, Upload, Loader2, Play, Trash2, Film, Clock } from 'lucide-react';

interface AnimeOption {
  id: string;
  title: string;
}

interface EpisodeOption {
  id: string;
  title: string;
  episode_number: number;
  video_url: string | null;
  season_id: string;
  duration: number | null;
}

interface SeasonOption {
  id: string;
  season_number: number;
  title: string | null;
}

interface Short {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  duration: number;
  created_at: string;
  video_url: string;
  view_count: number;
}

export function ShortsUpload() {
  const { user } = useAuth();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [animeList, setAnimeList] = useState<AnimeOption[]>([]);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeOption[]>([]);
  const [myShorts, setMyShorts] = useState<Short[]>([]);

  const [selectedAnimeId, setSelectedAnimeId] = useState('');
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('');
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeOption | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Check if user is allowed to upload shorts
  useEffect(() => {
    if (!user) return;
    const checkAccess = async () => {
      const { data } = await supabase
        .from('allowed_short_uploaders')
        .select('email')
        .limit(100);

      if (data) {
        const allowedEmails = data.map(d => d.email.toLowerCase());
        setIsAllowed(allowedEmails.includes(user.email?.toLowerCase() ?? ''));
      }
    };
    checkAccess();
  }, [user]);

  // Fetch anime list
  useEffect(() => {
    const fetchAnime = async () => {
      const { data } = await supabase
        .from('anime')
        .select('id, title')
        .order('title');
      if (data) setAnimeList(data);
    };
    fetchAnime();
  }, []);

  // Fetch user's shorts
  useEffect(() => {
    if (!user) return;
    const fetchShorts = async () => {
      const { data } = await supabase
        .from('shorts')
        .select('*')
        .eq('uploader_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setMyShorts(data as Short[]);
    };
    fetchShorts();
  }, [user]);

  // Fetch seasons when anime changes
  useEffect(() => {
    if (!selectedAnimeId) { setSeasons([]); setSelectedSeasonId(''); return; }
    const fetch = async () => {
      const { data } = await supabase
        .from('seasons')
        .select('id, season_number, title')
        .eq('anime_id', selectedAnimeId)
        .order('season_number');
      if (data) {
        setSeasons(data);
        if (data.length > 0) setSelectedSeasonId(data[0].id);
      }
    };
    fetch();
  }, [selectedAnimeId]);

  // Fetch episodes when season changes
  useEffect(() => {
    if (!selectedSeasonId) { setEpisodes([]); setSelectedEpisodeId(''); return; }
    const fetch = async () => {
      const { data } = await supabase
        .from('episodes')
        .select('id, title, episode_number, video_url, season_id, duration')
        .eq('season_id', selectedSeasonId)
        .order('episode_number');
      if (data) setEpisodes(data);
    };
    fetch();
  }, [selectedSeasonId]);

  // Update selected episode
  useEffect(() => {
    const ep = episodes.find(e => e.id === selectedEpisodeId);
    setSelectedEpisode(ep ?? null);
    if (ep) {
      setStartTime(0);
      setEndTime(Math.min(120, ep.duration ?? 120));
    }
  }, [selectedEpisodeId, episodes]);

  const duration = Math.max(0, endTime - startTime);
  const isValidDuration = duration > 0 && duration <= 120;

  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const handleSubmit = async () => {
    if (!user || !selectedEpisode?.video_url || !title.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!isValidDuration) {
      toast.error('Short duration must be between 1 and 120 seconds');
      return;
    }

    setIsSubmitting(true);
    try {
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);

      const { error } = await supabase
        .from('shorts')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          tags: tagArray,
          episode_id: selectedEpisode.id,
          video_url: selectedEpisode.video_url,
          start_time: startTime,
          end_time: endTime,
          duration,
          uploader_id: user.id,
        });

      if (error) {
        console.error('Error creating short:', error);
        toast.error('Failed to create short');
      } else {
        toast.success('Short created successfully!');
        setTitle('');
        setDescription('');
        setTags('');
        setStartTime(0);
        setEndTime(0);
        setSelectedEpisodeId('');
        // Refresh shorts list
        const { data } = await supabase
          .from('shorts')
          .select('*')
          .eq('uploader_id', user.id)
          .order('created_at', { ascending: false });
        if (data) setMyShorts(data as Short[]);
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShort = async (id: string) => {
    if (!confirm('Delete this short?')) return;
    const { error } = await supabase.from('shorts').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      setMyShorts(prev => prev.filter(s => s.id !== id));
      toast.success('Short deleted');
    }
  };

  if (isAllowed === null) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!isAllowed) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Scissors className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">
            Shorts uploading is restricted to authorized accounts only.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Create Short
          </CardTitle>
          <CardDescription>
            Select an episode and clip a segment (max 120 seconds / 2 minutes)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Anime & Episode Selection */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Anime *</Label>
              <Select value={selectedAnimeId} onValueChange={setSelectedAnimeId}>
                <SelectTrigger><SelectValue placeholder="Select anime" /></SelectTrigger>
                <SelectContent>
                  {animeList.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Season</Label>
              <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId} disabled={!seasons.length}>
                <SelectTrigger><SelectValue placeholder="Select season" /></SelectTrigger>
                <SelectContent>
                  {seasons.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      Season {s.season_number}{s.title ? ` - ${s.title}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Episode *</Label>
              <Select value={selectedEpisodeId} onValueChange={setSelectedEpisodeId} disabled={!episodes.length}>
                <SelectTrigger><SelectValue placeholder="Select episode" /></SelectTrigger>
                <SelectContent>
                  {episodes.filter(e => e.video_url).map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      Ep {e.episode_number}: {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Video Preview & Clip Selector */}
          {selectedEpisode?.video_url && (
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={selectedEpisode.video_url}
                  className="w-full h-full"
                  controls
                  playsInline
                />
              </div>

              {/* Time Range Selector */}
              <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Clip Range
                  </h4>
                  <Badge variant={isValidDuration ? 'default' : 'destructive'}>
                    {duration.toFixed(1)}s / 120s max
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time (seconds)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={selectedEpisode.duration ?? 9999}
                        step={0.1}
                        value={startTime}
                        onChange={e => setStartTime(parseFloat(e.target.value) || 0)}
                        className="bg-background"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (videoRef.current) setStartTime(Math.round(videoRef.current.currentTime * 10) / 10);
                        }}
                      >
                        Set
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleSeek(startTime)}>
                        <Play className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>End Time (seconds)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={selectedEpisode.duration ?? 9999}
                        step={0.1}
                        value={endTime}
                        onChange={e => setEndTime(parseFloat(e.target.value) || 0)}
                        className="bg-background"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (videoRef.current) setEndTime(Math.round(videoRef.current.currentTime * 10) / 10);
                        }}
                      >
                        Set
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleSeek(endTime)}>
                        <Play className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {!isValidDuration && duration > 120 && (
                  <p className="text-sm text-destructive">Duration exceeds 120 seconds maximum</p>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Short title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input
                placeholder="action, fight, epic"
                value={tags}
                onChange={e => setTags(e.target.value)}
                className="bg-muted/50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Short description..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="bg-muted/50"
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !selectedEpisode?.video_url || !isValidDuration}
            className="anime-button w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Short...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Create Short ({duration.toFixed(1)}s)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* My Shorts List */}
      {myShorts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5" />
              My Shorts ({myShorts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {myShorts.map(short => (
                <div
                  key={short.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{short.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {short.duration}s
                      </Badge>
                      {short.tags?.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      <span className="text-xs text-muted-foreground">
                        {new Date(short.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteShort(short.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
