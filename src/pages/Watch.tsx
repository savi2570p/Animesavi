import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Send,
  Settings,
  ExternalLink,
  Share2,
} from 'lucide-react';

interface Episode {
  id: string;
  episode_number: number;
  title: string;
  description: string | null;
  video_url: string | null;
  external_url: string | null;
  duration: number | null;
  season_id: string;
}

interface Season {
  id: string;
  anime_id: string;
  season_number: number;
}

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: {
    username: string | null;
    avatar_url: string | null;
  };
}

export default function Watch() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [anime, setAnime] = useState<Anime | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Video player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (episodeId) {
      fetchEpisodeData();
      fetchComments();
    }
  }, [episodeId]);

  const fetchEpisodeData = async () => {
    setIsLoading(true);

    const { data: episodeData, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('id', episodeId)
      .single();

    if (error || !episodeData) {
      toast.error('Episode not found');
      setIsLoading(false);
      return;
    }

    setEpisode(episodeData);

    // Fetch season and anime info
    const { data: seasonData } = await supabase
      .from('seasons')
      .select('*, anime:anime_id(*)')
      .eq('id', episodeData.season_id)
      .single();

    if (seasonData) {
      setAnime(seasonData.anime as Anime);

      // Fetch all episodes in this season
      const { data: episodesData } = await supabase
        .from('episodes')
        .select('*')
        .eq('season_id', episodeData.season_id)
        .order('episode_number');

      if (episodesData) {
        setAllEpisodes(episodesData);
      }

      // Record watch history
      if (user && seasonData.anime) {
        const animeId = (seasonData.anime as Anime).id;
        
        // Check if record exists
        const { data: existingHistory } = await supabase
          .from('watch_history')
          .select('id')
          .eq('user_id', user.id)
          .eq('episode_id', episodeId)
          .maybeSingle();

        if (existingHistory) {
          // Update existing record
          await supabase
            .from('watch_history')
            .update({ 
              watched_at: new Date().toISOString(),
              progress: 0 
            })
            .eq('id', existingHistory.id);
        } else {
          // Insert new record
          await supabase
            .from('watch_history')
            .insert({
              user_id: user.id,
              anime_id: animeId,
              episode_id: episodeId,
              progress: 0,
            });
        }
      }
    }

    setIsLoading(false);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('episode_id', episodeId)
      .order('created_at', { ascending: false });

    if (data) {
      // Fetch profiles for comments
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]));
      
      setComments(
        data.map((c) => ({
          ...c,
          profile: profileMap.get(c.user_id) || { username: null, avatar_url: null },
        }))
      );
    }
  };

  const handleAddComment = async () => {
    if (!user) {
      toast.error('Please sign in to comment');
      return;
    }

    if (!newComment.trim()) return;

    const { error } = await supabase.from('comments').insert({
      user_id: user.id,
      episode_id: episodeId,
      content: newComment.trim(),
    });

    if (error) {
      toast.error('Failed to add comment');
    } else {
      setNewComment('');
      fetchComments();
      toast.success('Comment added');
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(progress);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const time = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = time;
      setProgress(parseFloat(e.target.value));
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const getCurrentEpisodeIndex = () => allEpisodes.findIndex((ep) => ep.id === episodeId);

  const prevEpisode = allEpisodes[getCurrentEpisodeIndex() - 1];
  const nextEpisode = allEpisodes[getCurrentEpisodeIndex() + 1];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        <Skeleton className="aspect-video w-full max-h-[70vh]" />
        <div className="container py-8">
          <Skeleton className="h-8 w-96 mb-4" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Episode not found</h1>
        <Button asChild>
          <Link to="/browse">Browse Anime</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Video Player */}
      <div className="relative bg-black">
        {episode.external_url ? (
          // External URL - play in embedded iframe player with autoplay
          <div className="aspect-video w-full max-h-[70vh] bg-black">
            <iframe
              src={`${episode.external_url}${episode.external_url.includes('?') ? '&' : '?'}autoplay=1`}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title={`${anime?.title} - Episode ${episode.episode_number}`}
              style={{ border: 'none' }}
            />
          </div>
        ) : episode.video_url ? (
          // Native video player
          <div className="relative aspect-video w-full max-h-[70vh] group">
            <video
              ref={videoRef}
              src={episode.video_url}
              className="w-full h-full"
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              poster={anime?.cover_image || undefined}
              autoPlay
              playsInline
            />

            {/* Custom Controls */}
            <div className="absolute inset-0 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/80 via-transparent to-transparent">
              {/* Progress Bar */}
              <div className="px-4 mb-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={handleSeek}
                  className="w-full h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between px-4 pb-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlay}
                    className="text-white hover:bg-white/20"
                  >
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className="text-white hover:bg-white/20"
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>

                  <span className="text-white text-sm">
                    Episode {episode.episode_number}: {episode.title}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleFullscreen}
                    className="text-white hover:bg-white/20"
                  >
                    <Maximize className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // No video available
          <div className="aspect-video w-full max-h-[70vh] flex items-center justify-center bg-muted">
            <p className="text-muted-foreground">Video not available</p>
          </div>
        )}
      </div>

      {/* Episode Info & Navigation */}
      <div className="container py-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Link to={`/anime/${anime?.id}`} className="hover:text-primary">
                {anime?.title}
              </Link>
              <ChevronRight className="h-4 w-4" />
              <span>Episode {episode.episode_number}</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-heading font-bold mb-4">
              {episode.title}
            </h1>

            {episode.description && (
              <p className="text-muted-foreground mb-6">{episode.description}</p>
            )}

            {/* Episode Navigation & Share */}
            <div className="flex flex-wrap gap-4 mb-8">
              {prevEpisode && (
                <Button variant="outline" asChild>
                  <Link to={`/watch/${prevEpisode.id}`}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous Episode
                  </Link>
                </Button>
              )}
              {nextEpisode && (
                <Button asChild className="anime-button">
                  <Link to={`/watch/${nextEpisode.id}`}>
                    Next Episode
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={() => {
                  const shareUrl = `${window.location.origin}/watch/${episode.id}`;
                  const shareText = `Watch "${anime?.title}" - Episode ${episode.episode_number}: ${episode.title} on AnimeStreamHub!`;
                  
                  if (navigator.share) {
                    navigator.share({
                      title: `${anime?.title} - Episode ${episode.episode_number}`,
                      text: shareText,
                      url: shareUrl,
                    }).catch(() => {
                      navigator.clipboard.writeText(shareUrl);
                      toast.success('Link copied to clipboard!');
                    });
                  } else {
                    navigator.clipboard.writeText(shareUrl);
                    toast.success('Link copied to clipboard!');
                  }
                }}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Episode
              </Button>
            </div>

            {/* Comments */}
            <div className="space-y-6">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments ({comments.length})
              </h2>

              {/* Add Comment */}
              {user ? (
                <div className="flex gap-4">
                  <Avatar>
                    <AvatarFallback className="bg-gradient-primary text-white">
                      {user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="bg-muted/50"
                    />
                    <Button onClick={handleAddComment} className="anime-button">
                      <Send className="h-4 w-4 mr-2" />
                      Post Comment
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-muted-foreground mb-2">Sign in to leave a comment</p>
                  <Button asChild variant="outline">
                    <Link to="/auth">Sign In</Link>
                  </Button>
                </div>
              )}

              {/* Comments List */}
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-4">
                    <Avatar>
                      <AvatarFallback className="bg-secondary">
                        {comment.profile?.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {comment.profile?.username || 'Anonymous'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Episode List Sidebar */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <h3 className="text-lg font-semibold mb-4">All Episodes</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-hide">
              {allEpisodes.map((ep) => (
                <Link
                  key={ep.id}
                  to={`/watch/${ep.id}`}
                  className={`block p-3 rounded-lg transition-colors ${
                    ep.id === episodeId
                      ? 'bg-primary/20 border border-primary'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      EP {ep.episode_number}
                    </span>
                    <span className="font-medium line-clamp-1">{ep.title}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
