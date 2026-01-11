import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { VideoPlayer, ServerType } from '@/components/video/VideoPlayer';
import { EpisodeList } from '@/components/video/EpisodeList';
import { z } from 'zod';
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

// Comment validation schema
const commentSchema = z.string()
  .min(1, 'Comment cannot be empty')
  .max(1000, 'Comment must be at most 1000 characters');

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
  intro_start_time: number | null;
  intro_end_time: number | null;
  outro_start_time: number | null;
  outro_end_time: number | null;
}

interface Season {
  id: string;
  anime_id: string;
  season_number: number;
  title: string | null;
  episode_count?: number;
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
  parent_id: string | null;
  profile?: {
    username: string | null;
    avatar_url: string | null;
  };
  userEmail?: string;
  replies?: Comment[];
}

// Owner email addresses
const OWNER_EMAILS = ['savi2570p@gmail.com', 'savipanjeta2@gmail.com'];

const TELEGRAM_POPUP_KEY = 'telegram_popup_last_shown';

export default function Watch() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [searchParams] = useSearchParams();
  const { user, isAdmin, isUploader } = useAuth();
  const navigate = useNavigate();
  const resumeProgress = searchParams.get('t');

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [anime, setAnime] = useState<Anime | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [allSeasons, setAllSeasons] = useState<Season[]>([]);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [watchHistoryId, setWatchHistoryId] = useState<string | null>(null);
  const [activeServer, setActiveServer] = useState<ServerType>('PLAY');
  const [serverLoading, setServerLoading] = useState(false);
  const [showTelegramPopup, setShowTelegramPopup] = useState(false);
  const [initialSeekDone, setInitialSeekDone] = useState(false);
  const ensureHistoryInFlightRef = useRef(false);

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

  // Ensure watch history gets created even if auth loads AFTER the episode data
  useEffect(() => {
    if (!user || !episodeId || !anime?.id) return;
    if (watchHistoryId || ensureHistoryInFlightRef.current) return;

    ensureHistoryInFlightRef.current = true;

    (async () => {
      try {
        const { data: existingHistory, error: checkError } = await supabase
          .from('watch_history')
          .select('id')
          .eq('user_id', user.id)
          .eq('episode_id', episodeId)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking watch history:', checkError);
          return;
        }

        if (existingHistory?.id) {
          setWatchHistoryId(existingHistory.id);
          await supabase
            .from('watch_history')
            .update({ watched_at: new Date().toISOString() })
            .eq('id', existingHistory.id);
          return;
        }

        const { data: newHistory, error: insertError } = await supabase
          .from('watch_history')
          .insert({
            user_id: user.id,
            anime_id: anime.id,
            episode_id: episodeId,
            progress: 0,
          })
          .select('id')
          .maybeSingle();

        if (insertError) {
          console.error('Error inserting watch history:', insertError);
          toast.error('Could not save watch history');
          return;
        }

        if (newHistory?.id) {
          setWatchHistoryId(newHistory.id);
        }
      } finally {
        ensureHistoryInFlightRef.current = false;
      }
    })();
  }, [user, episodeId, anime?.id, watchHistoryId]);

  const updateWatchProgress = useCallback(async (currentTime: number, duration: number) => {
    if (!user || !episodeId || !anime) return;

    // Handle initial seek from resume progress
    if (!initialSeekDone && resumeProgress && duration > 0) {
      const progressPercent = parseInt(resumeProgress, 10);
      if (!isNaN(progressPercent) && progressPercent > 0 && progressPercent < 95) {
        const seekTime = (progressPercent / 100) * duration;
        // Find video element and seek
        const videoElement = document.querySelector('video');
        if (videoElement && Math.abs(videoElement.currentTime - seekTime) > 5) {
          videoElement.currentTime = seekTime;
        }
      }
      setInitialSeekDone(true);
    }

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
  }, [user, episodeId, anime, watchHistoryId, resumeProgress, initialSeekDone]);

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
      setCurrentSeason(seasonData as Season);

      // Fetch all seasons for this anime with episode counts
      const { data: seasonsData } = await supabase
        .from('seasons')
        .select('*')
        .eq('anime_id', (seasonData.anime as Anime).id)
        .order('season_number');

      if (seasonsData) {
        // Fetch episode counts for each season
        const seasonsWithCounts = await Promise.all(
          seasonsData.map(async (season) => {
            const { count } = await supabase
              .from('episodes')
              .select('id', { count: 'exact', head: true })
              .eq('season_id', season.id);
            return { ...season, episode_count: count || 0 };
          })
        );
        setAllSeasons(seasonsWithCounts);
      }

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
        const { data: existingHistory, error: checkError } = await supabase
          .from('watch_history')
          .select('id')
          .eq('user_id', user.id)
          .eq('episode_id', episodeId)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking watch history:', checkError);
        }

        if (existingHistory) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('watch_history')
            .update({
              watched_at: new Date().toISOString(),
            })
            .eq('id', existingHistory.id);
          
          if (updateError) {
            console.error('Error updating watch history:', updateError);
          } else {
            console.log('Watch history updated:', existingHistory.id);
          }
          setWatchHistoryId(existingHistory.id);
        } else {
          // Insert new record
          const { data: newHistory, error: insertError } = await supabase
            .from('watch_history')
            .insert({
              user_id: user.id,
              anime_id: animeId,
              episode_id: episodeId,
              progress: 0,
            })
            .select('id')
            .single();

          if (insertError) {
            console.error('Error inserting watch history:', insertError);
          } else if (newHistory) {
            console.log('Watch history created:', newHistory.id);
            setWatchHistoryId(newHistory.id);
          }
        }
      } else {
        console.log('Watch history not recorded - user:', !!user, 'anime:', !!seasonData?.anime);
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

      // Fetch user emails to check for owners
      const { data: { users } } = await supabase.auth.admin.listUsers?.() || { data: { users: [] } };
      
      // For non-admin access, we'll check email differently
      const profileMap = new Map(profiles?.map((p) => [p.id, p]));

      const commentsWithProfiles = data.map((c) => ({
        ...c,
        profile: profileMap.get(c.user_id) || { username: null, avatar_url: null },
      }));

      // Organize comments into threads (parent comments with replies)
      const parentComments = commentsWithProfiles.filter(c => !c.parent_id);
      const replies = commentsWithProfiles.filter(c => c.parent_id);
      
      const commentsWithReplies = parentComments.map(parent => ({
        ...parent,
        replies: replies.filter(r => r.parent_id === parent.id).sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      }));

      setComments(commentsWithReplies);
    }
  };

  const handleAddComment = async (parentId?: string) => {
    if (!user) {
      toast.error('Please sign in to comment');
      return;
    }

    const content = parentId ? replyContent : newComment;
    const trimmedComment = content.trim();
    
    // Validate comment
    const commentResult = commentSchema.safeParse(trimmedComment);
    if (!commentResult.success) {
      toast.error(commentResult.error.errors[0]?.message || 'Invalid comment');
      return;
    }

    const { error } = await supabase.from('comments').insert({
      user_id: user.id,
      episode_id: episodeId,
      content: trimmedComment,
      parent_id: parentId || null,
    });

    if (error) {
      toast.error('Failed to add comment');
    } else {
      if (parentId) {
        setReplyContent('');
        setReplyingTo(null);
      } else {
        setNewComment('');
      }
      fetchComments();
      toast.success(parentId ? 'Reply added' : 'Comment added');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to delete comment');
    } else {
      fetchComments();
      toast.success('Comment deleted');
    }
  };

  // Check if a user is an owner based on their email
  const isOwnerEmail = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return OWNER_EMAILS.includes(email.toLowerCase());
  };

  const getDisplayName = (comment: Comment): string => {
    // Check if current user's email is in owner list
    if (user?.email && isOwnerEmail(user.email) && comment.user_id === user.id) {
      return 'Owner';
    }
    return comment.profile?.username || 'Anonymous';
  };

  // Handle season change - fetch episodes for the new season
  const handleSeasonChange = async (seasonId: string) => {
    const newSeason = allSeasons.find(s => s.id === seasonId);
    if (!newSeason || newSeason.id === currentSeason?.id) return;

    // Fetch first episode of the new season
    const { data: episodesData } = await supabase
      .from('episodes')
      .select('*')
      .eq('season_id', seasonId)
      .order('episode_number')
      .limit(1);

    if (episodesData && episodesData.length > 0) {
      navigate(`/watch/${episodesData[0].id}`);
    } else {
      toast.error('No episodes found in this season');
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

      {/* Main Watch Area - Video + Episode List */}
      <div className="flex">
        {/* Episode List - Desktop Left Sidebar - Match video player height */}
        <div className="hidden lg:block w-72 shrink-0 border-r border-border/50 bg-card/30">
          <EpisodeList
            episodes={allEpisodes}
            currentEpisodeId={episodeId || ''}
            className="max-h-[70vh] sticky top-16"
          />
        </div>

        {/* Video Player */}
        <div className="flex-1">
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
            hasNextEpisode={!!nextEpisode}
            onNextEpisode={nextEpisode ? () => navigate(`/watch/${nextEpisode.id}`) : undefined}
            introStartTime={episode.intro_start_time}
            introEndTime={episode.intro_end_time}
            outroStartTime={episode.outro_start_time}
            outroEndTime={episode.outro_end_time}
          />
        </div>
      </div>

      {/* Mobile Episode List - Below Player */}
      <div className="lg:hidden container py-4 border-b border-border/30">
        <EpisodeList
          episodes={allEpisodes}
          currentEpisodeId={episodeId || ''}
          className="max-h-[250px]"
        />
      </div>
      {/* Below Player - Server Selection & Season Switcher */}
      <div className="container py-4 border-b border-border/30">
        <div className="flex flex-wrap items-center gap-4">
          {/* Server Selection */}
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Server:</span>
            <div className="flex gap-2">
              {(['PLAY', 'SHORT', 'Zex'] as ServerType[]).map((server) => {
                const displayName = server === 'SHORT' ? 'SAVI.IN' : server;
                return (
                  <Button
                    key={server}
                    size="sm"
                    variant={activeServer === server ? 'default' : 'outline'}
                    onClick={() => handleServerChange(server)}
                    disabled={serverLoading}
                    className={activeServer === server ? 'anime-button' : ''}
                  >
                    {displayName}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Season Switcher */}
          {allSeasons.length > 1 && (
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-muted-foreground font-medium">Season:</span>
              <div className="flex gap-2 overflow-x-auto">
                {allSeasons.map((season) => (
                  <Button
                    key={season.id}
                    size="sm"
                    variant={currentSeason?.id === season.id ? 'default' : 'outline'}
                    onClick={() => handleSeasonChange(season.id)}
                    className={`shrink-0 ${currentSeason?.id === season.id ? 'anime-button' : ''}`}
                    title={season.title || `Season ${season.season_number}`}
                  >
                    S{season.season_number}
                    {season.episode_count !== undefined && (
                      <span className="ml-1 text-xs opacity-70">({season.episode_count})</span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Episode Info & Navigation */}
      <div className="container py-6">
        <div className="flex flex-col gap-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to={`/anime/${anime?.id}`} className="hover:text-primary">
              {anime?.title}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span>Episode {episode.episode_number}</span>
          </div>

          {/* Anime Title */}
          <h1 className="text-2xl md:text-3xl font-heading font-bold">
            {episode.title}
          </h1>

          {/* Edit Episode (Admin/Uploader only) */}
          <div className="flex items-center gap-4">
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
            <p className="text-muted-foreground">{episode.description}</p>
          )}

          {/* Episode Navigation */}
          <div className="flex flex-wrap gap-4">
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
                // Create clean URL with anime name, season, and episode number
                const animeSlug = anime?.title
                  ? anime.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                  : '';
                const seasonNum = currentSeason?.season_number || 1;
                const shareUrl = `${window.location.origin}/${animeSlug}/season-${seasonNum}-episode-${episode.episode_number}`;
                const shareText = `Watch "${anime?.title}" - S${seasonNum} E${episode.episode_number}: ${episode.title} on AnimeSavi!`;

                if (navigator.share) {
                  navigator.share({
                    title: `${anime?.title} - S${seasonNum} E${episode.episode_number}`,
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
                  <Button onClick={() => handleAddComment()} className="anime-button">
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
            <div className="space-y-6">
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-3">
                  {/* Parent Comment */}
                  <div className="flex gap-4">
                    <Avatar>
                      <AvatarFallback className="bg-secondary">
                        {comment.profile?.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {getDisplayName(comment)}
                        </span>
                        {user?.email && isOwnerEmail(user.email) && comment.user_id === user.id && (
                          <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">Owner</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground mb-2">{comment.content}</p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          Reply
                        </button>
                        {user?.id === comment.user_id && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>

                      {/* Reply Input */}
                      {replyingTo === comment.id && user && (
                        <div className="mt-3 flex gap-2">
                          <Input
                            placeholder="Write a reply..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            className="flex-1 text-sm"
                          />
                          <Button size="sm" onClick={() => handleAddComment(comment.id)}>
                            Reply
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-12 space-y-3 border-l-2 border-border/50 pl-4">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-secondary text-xs">
                              {reply.profile?.username?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {getDisplayName(reply)}
                              </span>
                              {user?.email && isOwnerEmail(user.email) && reply.user_id === user.id && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-primary/20 text-primary rounded-full">Owner</span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {new Date(reply.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{reply.content}</p>
                            {user?.id === reply.user_id && (
                              <button
                                onClick={() => handleDeleteComment(reply.id)}
                                className="text-xs text-muted-foreground hover:text-destructive transition-colors mt-1"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}