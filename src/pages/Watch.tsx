import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserProfileHoverCard } from '@/components/UserProfileHoverCard';
import { toast } from 'sonner';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { ServerType } from '@/hooks/useServerAutoSelect';
import { EpisodeList } from '@/components/video/EpisodeList';
import { RecommendedAnime } from '@/components/home/RecommendedAnime';
import { WatchParty } from '@/components/WatchParty';
import { OfflineDownloadButton } from '@/components/video/OfflineDownloadButton';
import { VideoFormatIndicator } from '@/components/video/VideoFormatIndicator';
import { ServerStatusIndicator } from '@/components/video/ServerStatusIndicator';
import { useDeviceOptimizedVideo } from '@/hooks/useDeviceOptimizedVideo';
import { useServerAutoSelect, SERVER_CONFIGS, getAvailableServers } from '@/hooks/useServerAutoSelect';
import { z } from 'zod';
import { hasValidAccess, isSuperAdmin } from '@/components/AccessBanner';
import { TokenExpiredPopup } from '@/components/TokenExpiredPopup';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Send,
  Share2,
  Edit,
  Server,
  X,
  ThumbsUp,
  ThumbsDown,
  ArrowUpDown,
  Clock,
  TrendingUp,
  Flag,
  Bell,
  BellDot,
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
  uploader_id: string | null;
}

interface CommentLike {
  comment_id: string;
  is_like: boolean;
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
  isOwner?: boolean;
  replies?: Comment[];
  likes: number;
  dislikes: number;
  userLike?: boolean | null; // true = liked, false = disliked, null = no vote
}

type CommentSortOption = 'newest' | 'oldest' | 'most_liked';

// Telegram popup key for localStorage

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
  const [commentSort, setCommentSort] = useState<CommentSortOption>('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [watchHistoryId, setWatchHistoryId] = useState<string | null>(null);
  const {
    activeServer,
    isServerLoading: serverLoading,
    availableServers,
    failedServers,
    fallbackOccurred,
    fallbackFrom,
    switchServer: handleServerSwitch,
    onVideoLoadSuccess,
    onVideoLoadError,
    startFallbackTimer,
  } = useServerAutoSelect({
    onServerSwitch: (from, to, reason) => {
      console.log(`Server auto-switched: ${from} → ${to} (${reason})`);
      if (reason === 'timeout') {
        toast.info(`Switched to ${SERVER_CONFIGS[to].name} (${SERVER_CONFIGS[from].name} was slow)`);
      } else if (reason === 'error') {
        toast.info(`Switched to ${SERVER_CONFIGS[to].name} (${SERVER_CONFIGS[from].name} failed)`);
      }
    },
  });
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [commentNotifications, setCommentNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTelegramPopup, setShowTelegramPopup] = useState(false);
  const [initialSeekDone, setInitialSeekDone] = useState(false);
  const [showResumeNotification, setShowResumeNotification] = useState(false);
  const [savedPlaybackProgress, setSavedPlaybackProgress] = useState(0);
  const [userProfile, setUserProfile] = useState<{ avatar_url: string | null } | null>(null);
  const ensureHistoryInFlightRef = useRef(false);

  // Device-optimized video URL for iOS compatibility
  const deviceOptimizedVideo = useDeviceOptimizedVideo(episodeId, episode?.video_url || null);
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

  // Handle server change - delegates to useServerAutoSelect
  const handleServerChange = useCallback((server: ServerType) => {
    handleServerSwitch(server);
  }, [handleServerSwitch]);

  useEffect(() => {
    if (episodeId) {
      fetchEpisodeData();
      fetchComments();
      // Start fallback timer for the current server when episode loads
      startFallbackTimer();
    }
  }, [episodeId, commentSort]);

  // Fetch current user's profile for avatar
  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setUserProfile(data);
        });
    }
  }, [user]);

  // Fetch comment notifications
  useEffect(() => {
    if (user) {
      fetchCommentNotifications();
    }
  }, [user]);

  const fetchCommentNotifications = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('comment_notifications')
      .select(`
        *,
        episode:episodes(id, title, season_id),
        replier:profiles!comment_notifications_replier_id_fkey(username)
      `)
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data) {
      setCommentNotifications(data);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    await supabase
      .from('comment_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    fetchCommentNotifications();
  };

  const markAllNotificationsAsRead = async () => {
    if (!user) return;
    
    await supabase
      .from('comment_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id);
    
    setCommentNotifications([]);
    toast.success('All notifications marked as read');
  };

  // Ensure watch history gets created/updated - ONE entry per anime per user
  useEffect(() => {
    if (!user || !episodeId || !anime?.id || !currentSeason) return;
    if (watchHistoryId || ensureHistoryInFlightRef.current) return;

    ensureHistoryInFlightRef.current = true;

    (async () => {
      try {
        // Use UPSERT to ensure one entry per user+anime - update episode if watching different one
        const { data: upsertedHistory, error: upsertError } = await supabase
          .from('watch_history')
          .upsert({
            user_id: user.id,
            anime_id: anime.id,
            episode_id: episodeId,
            progress: 0,
            completed: false,
            watched_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,anime_id',
            ignoreDuplicates: false,
          })
          .select('id')
          .maybeSingle();

        if (upsertError) {
          console.error('Error upserting watch history:', upsertError);
          toast.error('Could not save watch history');
          return;
        }

        if (upsertedHistory?.id) {
          setWatchHistoryId(upsertedHistory.id);
        }
      } finally {
        ensureHistoryInFlightRef.current = false;
      }
    })();
  }, [user, episodeId, anime?.id, currentSeason, watchHistoryId]);

  const updateWatchProgress = useCallback(async (currentTime: number, duration: number) => {
    if (!user || !episodeId || !anime) return;

    // Handle initial seek from resume progress - "Remember Playback Position" feature
    if (!initialSeekDone && resumeProgress && duration > 0) {
      const progressPercent = parseInt(resumeProgress, 10);
      if (!isNaN(progressPercent) && progressPercent > 0 && progressPercent < 95) {
        const seekTime = (progressPercent / 100) * duration;
        // Find video element and seek
        const videoElement = document.querySelector('video');
        if (videoElement && Math.abs(videoElement.currentTime - seekTime) > 5) {
          videoElement.currentTime = seekTime;
          // Show resume notification
          setShowResumeNotification(true);
          toast.success(`Resuming from ${Math.round(progressPercent)}%`, {
            description: 'Your playback position was remembered',
            duration: 3000,
          });
          // Hide notification after 3 seconds
          setTimeout(() => setShowResumeNotification(false), 3000);
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

      // Record watch history using UPSERT - ONE entry per anime per user
      if (user && seasonData.anime) {
        const animeId = (seasonData.anime as Anime).id;

        // First check for existing entry to get saved progress for resume
        const { data: existingHistory } = await supabase
          .from('watch_history')
          .select('id, progress, episode_id')
          .eq('user_id', user.id)
          .eq('anime_id', animeId)
          .maybeSingle();

        // Set saved progress for resume overlay if same episode
        if (existingHistory && existingHistory.episode_id === episodeId) {
          if (!resumeProgress && existingHistory.progress && existingHistory.progress > 5 && existingHistory.progress < 95) {
            setSavedPlaybackProgress(existingHistory.progress);
          }
        }

        // UPSERT - creates new or updates existing entry for this anime
        const { data: upsertedHistory, error: upsertError } = await supabase
          .from('watch_history')
          .upsert({
            user_id: user.id,
            anime_id: animeId,
            episode_id: episodeId,
            progress: existingHistory?.episode_id === episodeId ? (existingHistory.progress || 0) : 0,
            completed: false,
            watched_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,anime_id',
            ignoreDuplicates: false,
          })
          .select('id')
          .maybeSingle();

        if (upsertError) {
          console.error('Error upserting watch history:', upsertError);
        } else if (upsertedHistory) {
          console.log('Watch history upserted:', upsertedHistory.id);
          setWatchHistoryId(upsertedHistory.id);
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
      .order('created_at', { ascending: commentSort === 'oldest' });

    if (data) {
      // Fetch profiles for comments
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const commentIds = data.map((c) => c.id);
      
      const [profilesResult, likesResult, userLikesResult] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url').in('id', userIds),
        // Get like/dislike counts for all comments
        supabase.from('comment_likes').select('comment_id, is_like').in('comment_id', commentIds),
        // Get current user's likes if logged in
        user ? supabase.from('comment_likes').select('comment_id, is_like').eq('user_id', user.id).in('comment_id', commentIds) : Promise.resolve({ data: [] as CommentLike[] }),
      ]);

      const profileMap = new Map(profilesResult.data?.map((p) => [p.id, p]));
      
      // Calculate likes/dislikes per comment
      const likeCounts = new Map<string, { likes: number; dislikes: number }>();
      likesResult.data?.forEach((like) => {
        const current = likeCounts.get(like.comment_id) || { likes: 0, dislikes: 0 };
        if (like.is_like) {
          current.likes++;
        } else {
          current.dislikes++;
        }
        likeCounts.set(like.comment_id, current);
      });
      
      // Map user's likes
      const userLikesMap = new Map<string, boolean>();
      (userLikesResult.data as CommentLike[] || []).forEach((like) => {
        userLikesMap.set(like.comment_id, like.is_like);
      });

      const commentsWithProfiles = data.map((c) => ({
        ...c,
        profile: profileMap.get(c.user_id) || { username: null, avatar_url: null },
        isOwner: false,
        likes: likeCounts.get(c.id)?.likes || 0,
        dislikes: likeCounts.get(c.id)?.dislikes || 0,
        userLike: userLikesMap.has(c.id) ? userLikesMap.get(c.id) : null,
      }));

      // For a proper owner check, check if the uploader_id of the anime matches the commenter's user_id
      // or if the commenter is in the OWNER_EMAILS list
      const updatedComments = await Promise.all(
        commentsWithProfiles.map(async (comment) => {
          // Check if this commenter is the anime uploader
          const isAnimeUploader = anime?.uploader_id === comment.user_id;
          
          // Check if user is an admin
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', comment.user_id);
          
          const isAdmin = roles?.some(r => r.role === 'admin') || false;
          
          return {
            ...comment,
            isOwner: isAnimeUploader || isAdmin,
          };
        })
      );

      // Organize comments into threads (parent comments with replies)
      let parentComments = updatedComments.filter(c => !c.parent_id);
      const replies = updatedComments.filter(c => c.parent_id);
      
      // Sort based on selected option
      if (commentSort === 'most_liked') {
        parentComments = parentComments.sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
      } else if (commentSort === 'oldest') {
        parentComments = parentComments.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      } else {
        // newest first (default)
        parentComments = parentComments.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      
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

  const handleLikeComment = async (commentId: string, isLike: boolean) => {
    if (!user) {
      toast.error('Please sign in to like/dislike comments');
      return;
    }

    // Check if user already has a like/dislike on this comment
    const comment = comments.find(c => c.id === commentId) || 
      comments.flatMap(c => c.replies || []).find(c => c.id === commentId);
    
    if (!comment) return;

    if (comment.userLike === isLike) {
      // User is clicking the same button - remove the like/dislike
      const { error } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', user.id);
      
      if (error) {
        toast.error('Failed to remove vote');
      } else {
        fetchComments();
      }
    } else if (comment.userLike !== null) {
      // User is switching their vote
      const { error } = await supabase
        .from('comment_likes')
        .update({ is_like: isLike })
        .eq('comment_id', commentId)
        .eq('user_id', user.id);
      
      if (error) {
        toast.error('Failed to update vote');
      } else {
        fetchComments();
      }
    } else {
      // New vote
      const { error } = await supabase
        .from('comment_likes')
        .insert({
          comment_id: commentId,
          user_id: user.id,
          is_like: isLike,
        });
      
      if (error) {
        toast.error('Failed to add vote');
      } else {
        fetchComments();
      }
    }
  };

  const handleReportComment = async (commentId: string) => {
    if (!user) {
      toast.error('Please sign in to report comments');
      return;
    }

    if (!reportReason.trim()) {
      toast.error('Please provide a reason for the report');
      return;
    }

    const { error } = await supabase.from('comment_reports').insert({
      comment_id: commentId,
      reporter_id: user.id,
      reason: reportReason.trim(),
    });

    if (error) {
      if (error.code === '23505') {
        toast.error('You have already reported this comment');
      } else {
        toast.error('Failed to report comment');
      }
    } else {
      toast.success('Comment reported successfully');
      setReportingCommentId(null);
      setReportReason('');
    }
  };


  const getDisplayName = (comment: Comment): string => {
    // Check if the commenter is an owner (uploader/admin)
    if (comment.isOwner) {
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

  // Token access check - super admins bypass
  const accessValid = hasValidAccess(user?.email);

  if (!accessValid) {
    return <TokenExpiredPopup />;
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
        {/* Episode List - Desktop Left Sidebar - Ends at video player border */}
        <div className="hidden lg:block w-72 shrink-0 border-r border-border/50 bg-card/30">
          <EpisodeList
            episodes={allEpisodes}
            currentEpisodeId={episodeId || ''}
            className="sticky top-16 max-h-[60vh]"
          />
        </div>

        {/* Video Player */}
        <div className="flex-1">
          <VideoPlayer
            key={`${episodeId}-${activeServer}`}
            videoUrl={deviceOptimizedVideo.videoUrl || episode.video_url}
            externalUrl={episode.external_url}
            title={episode.title}
            animeTitle={anime?.title || ''}
            episodeNumber={episode.episode_number}
            seasonNumber={currentSeason?.season_number || 1}
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
            savedPlaybackProgress={savedPlaybackProgress}
            onResumeChoice={(resume) => {
              if (!resume) {
                setSavedPlaybackProgress(0);
              }
            }}
            onVideoLoadSuccess={onVideoLoadSuccess}
            onVideoLoadError={onVideoLoadError}
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
            <div className="flex gap-2 flex-wrap">
              {availableServers.map((server) => {
                const config = SERVER_CONFIGS[server];
                const isFailed = failedServers.has(server);
                return (
                  <Button
                    key={server}
                    size="sm"
                    variant={activeServer === server ? 'default' : 'outline'}
                    onClick={() => handleServerChange(server)}
                    disabled={serverLoading}
                    className={`${activeServer === server ? 'anime-button' : ''} ${isFailed ? 'opacity-60 line-through' : ''}`}
                    title={config.description}
                  >
                    {config.name}
                    {activeServer === server && (
                      <span className="ml-1.5 text-[10px] opacity-75">●</span>
                    )}
                  </Button>
                );
              })}
            </div>
            {/* Live server status indicator */}
            <ServerStatusIndicator
              activeServer={activeServer}
              failedServers={failedServers}
              isServerLoading={serverLoading}
              fallbackOccurred={fallbackOccurred}
              fallbackFrom={fallbackFrom}
            />
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
          {/* Breadcrumb with Format Indicator */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to={`/anime/${anime?.id}`} className="hover:text-primary">
                {anime?.title}
              </Link>
              <ChevronRight className="h-4 w-4" />
              <span>Episode {episode.episode_number}</span>
            </div>
            
            {/* Video Format Indicator - Only visible to admin/uploader */}
            {(isAdmin || isUploader) && (
              <VideoFormatIndicator
                servedFormat={deviceOptimizedVideo.servedFormat}
                device={deviceOptimizedVideo.device}
                conversionStatus={deviceOptimizedVideo.conversionStatus}
                isHLS={deviceOptimizedVideo.videoUrl?.includes('.m3u8') || false}
              />
            )}
          </div>

          {/* Anime Title */}
          <h1 className="text-2xl md:text-3xl font-heading font-bold">
            {episode.title}
          </h1>

          {/* Edit Episode and Watch Party */}
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
            
            {/* Watch Party Button */}
            {anime && (
              <WatchParty
                episodeId={episode.id}
                videoRef={{ current: document.querySelector('video') } as React.RefObject<HTMLVideoElement>}
                animeTitle={anime.title || ''}
                episodeNumber={episode.episode_number}
                seasonNumber={currentSeason?.season_number || 1}
                animeId={anime.id}
              />
            )}
          </div>

          {episode.description && (
            <p className="text-muted-foreground">{episode.description}</p>
          )}

          {/* Episode Navigation */}
          <div className="flex flex-wrap items-center gap-4">
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
            
            {/* Offline Download Button */}
            <OfflineDownloadButton
              videoUrl={episode.video_url}
              iosVideoUrl={deviceOptimizedVideo.device === 'iOS' ? deviceOptimizedVideo.videoUrl : null}
              episodeId={episode.id}
              episodeTitle={episode.title}
              animeTitle={anime?.title || 'Unknown'}
              isIOSDevice={deviceOptimizedVideo.device === 'iOS'}
            />
            
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
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comments ({comments.length})
                </h2>
                
                {/* Notification Bell */}
                {user && (
                  <div className="relative">
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="relative p-2 rounded-full hover:bg-muted transition-colors"
                    >
                      {commentNotifications.length > 0 ? (
                        <BellDot className="h-5 w-5 text-primary" />
                      ) : (
                        <Bell className="h-5 w-5 text-muted-foreground" />
                      )}
                      {commentNotifications.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {commentNotifications.length}
                        </span>
                      )}
                    </button>
                    
                    {/* Notifications Dropdown */}
                    {showNotifications && (
                      <div className="absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                        <div className="p-3 border-b border-border flex items-center justify-between">
                          <span className="font-medium">Reply Notifications</span>
                          {commentNotifications.length > 0 && (
                            <button
                              onClick={markAllNotificationsAsRead}
                              className="text-xs text-primary hover:underline"
                            >
                              Mark all as read
                            </button>
                          )}
                        </div>
                        {commentNotifications.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            No new notifications
                          </div>
                        ) : (
                          <div className="divide-y divide-border">
                            {commentNotifications.map((notification) => (
                              <div
                                key={notification.id}
                                className="p-3 hover:bg-muted/50 cursor-pointer"
                                onClick={() => {
                                  markNotificationAsRead(notification.id);
                                  navigate(`/watch/${notification.episode_id}`);
                                  setShowNotifications(false);
                                }}
                              >
                                <p className="text-sm">
                                  <span className="font-medium">{notification.replier?.username || 'Someone'}</span>
                                  {' '}replied to your comment
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(notification.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Sort Options */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={commentSort === 'newest' ? 'default' : 'ghost'}
                    onClick={() => setCommentSort('newest')}
                    className="text-xs"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Newest
                  </Button>
                  <Button
                    size="sm"
                    variant={commentSort === 'oldest' ? 'default' : 'ghost'}
                    onClick={() => setCommentSort('oldest')}
                    className="text-xs"
                  >
                    Oldest
                  </Button>
                  <Button
                    size="sm"
                    variant={commentSort === 'most_liked' ? 'default' : 'ghost'}
                    onClick={() => setCommentSort('most_liked')}
                    className="text-xs"
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Top
                  </Button>
                </div>
              </div>
            </div>

            {/* Add Comment */}
            {user ? (
              <div className="flex gap-4">
                <Avatar>
                  <AvatarImage src={userProfile?.avatar_url || undefined} alt="Your avatar" />
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
                    <UserProfileHoverCard username={comment.profile?.username || null} avatarUrl={comment.profile?.avatar_url || null}>
                      <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                        <AvatarImage src={comment.profile?.avatar_url || undefined} alt={comment.profile?.username || 'User'} />
                        <AvatarFallback className="bg-secondary">
                          {comment.profile?.username?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </UserProfileHoverCard>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <UserProfileHoverCard username={comment.profile?.username || null} avatarUrl={comment.profile?.avatar_url || null}>
                          <span className="font-medium cursor-pointer hover:text-primary transition-colors">
                            {getDisplayName(comment)}
                          </span>
                        </UserProfileHoverCard>
                        {comment.isOwner && (
                          <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">Owner</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground mb-2">{comment.content}</p>
                      <div className="flex items-center gap-3">
                        {/* Like/Dislike Buttons */}
                        <button
                          onClick={() => handleLikeComment(comment.id, true)}
                          className={`flex items-center gap-1 text-xs transition-colors ${comment.userLike === true ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                          {comment.likes > 0 && <span>{comment.likes}</span>}
                        </button>
                        <button
                          onClick={() => handleLikeComment(comment.id, false)}
                          className={`flex items-center gap-1 text-xs transition-colors ${comment.userLike === false ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                          {comment.dislikes > 0 && <span>{comment.dislikes}</span>}
                        </button>
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
                        {user && user.id !== comment.user_id && (
                          <button
                            onClick={() => setReportingCommentId(reportingCommentId === comment.id ? null : comment.id)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive/80 transition-colors"
                          >
                            <Flag className="h-3 w-3" />
                            Report
                          </button>
                        )}
                      </div>
                      
                      {/* Report Input */}
                      {reportingCommentId === comment.id && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2">
                          <p className="text-sm font-medium">Report this comment</p>
                          <Input
                            placeholder="Reason for reporting..."
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            className="text-sm"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="destructive" onClick={() => handleReportComment(comment.id)}>
                              Submit Report
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => {
                              setReportingCommentId(null);
                              setReportReason('');
                            }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
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
                          <UserProfileHoverCard username={reply.profile?.username || null} avatarUrl={reply.profile?.avatar_url || null}>
                            <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                              <AvatarImage src={reply.profile?.avatar_url || undefined} alt={reply.profile?.username || 'User'} />
                              <AvatarFallback className="bg-secondary text-xs">
                                {reply.profile?.username?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          </UserProfileHoverCard>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <UserProfileHoverCard username={reply.profile?.username || null} avatarUrl={reply.profile?.avatar_url || null}>
                                <span className="font-medium text-sm cursor-pointer hover:text-primary transition-colors">
                                  {getDisplayName(reply)}
                                </span>
                              </UserProfileHoverCard>
                              {reply.isOwner && (
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

          {/* Recommended Anime Section */}
          <div className="mt-8">
            <RecommendedAnime />
          </div>
        </div>
      </div>
    </div>
  );
}