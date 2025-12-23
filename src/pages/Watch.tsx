import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { VideoPlayer, ServerType } from '@/components/video/VideoPlayer';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Send,
  Share2,
  Edit,
  Server,
  X,
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
  audio_language: string | null;
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
  type: string | null;
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

const TELEGRAM_POPUP_KEY = 'telegram_popup_last_shown';

export default function Watch() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const { user, isAdmin, isUploader } = useAuth();
  const navigate = useNavigate();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [anime, setAnime] = useState<Anime | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [watchHistoryId, setWatchHistoryId] = useState<string | null>(null);
  const [activeServer, setActiveServer] = useState<ServerType>('PLAY');
  const [serverLoading, setServerLoading] = useState(false);
  const [showTelegramPopup, setShowTelegramPopup] = useState(false);

  // Check if Telegram popup should be shown (once per day)
  useEffect(() => {
    const lastShown = localStorage.getItem(TELEGRAM_POPUP_KEY);
    const today = new Date().toDateString();
    
    if (lastShown !== today) {
      // Show popup after a short delay when page loads
      const timer = setTimeout(() => {
        setShowTelegramPopup(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleTelegramJoin = () => {
    window.open('https://t.me/AnimeSaviInhindiDUB', '_blank');
    localStorage.setItem(TELEGRAM_POPUP_KEY, new Date().toDateString());
    setShowTelegramPopup(false);
  };

  const handleTelegramDismiss = () => {
    localStorage.setItem(TELEGRAM_POPUP_KEY, new Date().toDateString());
    setShowTelegramPopup(false);
  };

  // Handle server change with loading
  const handleServerChange = (server: ServerType) => {
    if (server === activeServer) return;
    
    setServerLoading(true);
    setActiveServer(server);
    
    // Simulate loading for 2-3 seconds
    const loadTime = 2000 + Math.random() * 1000;
    setTimeout(() => {
      setServerLoading(false);
    }, loadTime);
  };

  useEffect(() => {
    if (episodeId) {
      fetchEpisodeData();
      fetchComments();
    }
  }, [episodeId]);

  const updateWatchProgress = useCallback(async (currentTime: number, duration: number) => {
    if (!user || !episodeId || !anime) return;

    const progressPercent = Math.floor((currentTime / duration) * 100);
    const completed = progressPercent >= 90;

    try {
      if (watchHistoryId) {
        await supabase
          .from('watch_history')
          .update({ 
            progress: progressPercent,
            completed,
            watched_at: new Date().toISOString()
          })
          .eq('id', watchHistoryId);
      }
    } catch (error) {
      console.error('Error updating watch progress:', error);
    }
  }, [user, episodeId, anime, watchHistoryId]);

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

      // Record watch history immediately
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
            })
            .eq('id', existingHistory.id);
          setWatchHistoryId(existingHistory.id);
        } else {
          // Insert new record
          const { data: newHistory } = await supabase
            .from('watch_history')
            .insert({
              user_id: user.id,
              anime_id: animeId,
              episode_id: episodeId,
              progress: 0,
            })
            .select('id')
            .single();

          if (newHistory) {
            setWatchHistoryId(newHistory.id);
          }
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

  const getCurrentEpisodeIndex = () => allEpisodes.findIndex((ep) => ep.id === episodeId);

  const prevEpisode = allEpisodes[getCurrentEpisodeIndex() - 1];
  const nextEpisode = allEpisodes[getCurrentEpisodeIndex() + 1];

  const isMovie = anime?.type?.toLowerCase() === 'movie';

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
      {/* Telegram Popup */}
      {showTelegramPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-xl animate-scale-in">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-foreground">Join the Telegram Channel</h3>
              <button 
                onClick={handleTelegramDismiss}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-muted-foreground mb-6">
              Get more updates, new anime releases, and exclusive content!
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={handleTelegramJoin}
                className="flex-1 anime-button"
              >
                Join
              </Button>
              <Button 
                onClick={handleTelegramDismiss}
                variant="outline"
                className="flex-1"
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Video Player */}
      <VideoPlayer
        videoUrl={episode.video_url}
        externalUrl={episode.external_url}
        title={episode.title}
        animeTitle={anime?.title || ''}
        episodeNumber={episode.episode_number}
        episodeId={episode.id}
        poster={anime?.cover_image || undefined}
        isMovie={isMovie}
        activeServer={activeServer}
        isLoading={serverLoading}
        audioLanguage={episode.audio_language || undefined}
        onTimeUpdate={updateWatchProgress}
      />

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

            {/* Anime Title */}
            <h1 className="text-2xl md:text-3xl font-heading font-bold mb-4">
              {episode.title}
            </h1>

            {/* Server Selection - Below Title */}
            <div className="flex items-center gap-3 mb-6">
              <Server className="h-5 w-5 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">Server:</span>
              <div className="flex gap-2">
                {(['PLAY', 'SHORT', 'Zex'] as ServerType[]).map((server) => (
                  <Button
                    key={server}
                    size="sm"
                    variant={activeServer === server ? 'default' : 'outline'}
                    onClick={() => handleServerChange(server)}
                    disabled={serverLoading}
                    className={activeServer === server ? 'anime-button' : ''}
                  >
                    {server}
                  </Button>
                ))}
              </div>
            </div>

            {/* Edit Episode (Admin/Uploader only) */}
            <div className="flex items-center gap-4 mb-4">
              {(isAdmin || isUploader) && anime && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/upload/anime/${anime.id}/episode/${episode.id}/edit`)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Episode
                </Button>
              )}
            </div>

            {episode.description && (
              <p className="text-muted-foreground mb-6">{episode.description}</p>
            )}

            {/* Episode Navigation */}
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
                  const shareText = `Watch "${anime?.title}" - Episode ${episode.episode_number}: ${episode.title} on Anime.Savi.me!`;

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

          {/* Sidebar - Episode List */}
          <div className="lg:w-80">
            <div className="sticky top-20">
              <h3 className="font-heading font-bold mb-4">Episodes</h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {allEpisodes.map((ep) => (
                  <Link
                    key={ep.id}
                    to={`/watch/${ep.id}`}
                    className={`block p-3 rounded-lg transition-colors ${
                      ep.id === episodeId
                        ? 'bg-primary/20 border border-primary/50'
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        EP {ep.episode_number}
                      </span>
                      <span className="text-sm font-medium truncate">{ep.title}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
