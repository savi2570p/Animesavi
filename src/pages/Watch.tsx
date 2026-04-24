import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ShareEmbedPopup } from '@/components/ShareEmbedPopup';
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
import { isEmbedLikeUrl } from '@/components/video/PureEmbedPlayer';
import { z } from 'zod';
import { hasValidTokenAccess, isSuperAdmin, fetchTokenSystemStatus } from '@/components/AccessBanner';
import { TokenExpiredPopup } from '@/components/TokenExpiredPopup';
import { useCastDetection } from '@/hooks/useCastDetection';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Send,
  
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
  captions_url: string | null;
  thumbnail: string | null;
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
  is_crunchyroll?: boolean;
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

// Telegram popup keys
// - daily key (localStorage): limits how often we re-prompt across days
// - session key (sessionStorage): once dismissed, don't show again this session
const TELEGRAM_POPUP_KEY = 'telegram_popup_last_shown';
const TELEGRAM_POPUP_SESSION_KEY = 'telegram_popup_dismissed_session';

// Language-aware Telegram toast copy.
// Resolution order: episode audio_language -> stored preferred_audio_language -> navigator.language.
// Falls back to English. Pure function: no side effects, never touches the player.
type TelegramCopy = { title: string; subtitle: string; cta: string; aria: string };
const TELEGRAM_COPY: Record<string, TelegramCopy> = {
  en: { title: 'Join our Telegram', subtitle: 'New episodes & updates', cta: 'Join', aria: 'Join Telegram' },
  hi: { title: 'हमारा टेलीग्राम जॉइन करें', subtitle: 'नए एपिसोड और अपडेट्स', cta: 'जॉइन', aria: 'टेलीग्राम जॉइन करें' },
  ja: { title: 'Telegram に参加', subtitle: '新エピソードと更新情報', cta: '参加', aria: 'Telegram に参加' },
  es: { title: 'Únete a nuestro Telegram', subtitle: 'Nuevos episodios y novedades', cta: 'Unirse', aria: 'Unirse a Telegram' },
  fr: { title: 'Rejoignez notre Telegram', subtitle: 'Nouveaux épisodes et mises à jour', cta: 'Rejoindre', aria: 'Rejoindre Telegram' },
  pt: { title: 'Entre no nosso Telegram', subtitle: 'Novos episódios e atualizações', cta: 'Entrar', aria: 'Entrar no Telegram' },
  de: { title: 'Tritt unserem Telegram bei', subtitle: 'Neue Folgen & Updates', cta: 'Beitreten', aria: 'Telegram beitreten' },
  ar: { title: 'انضم إلى تيليجرام', subtitle: 'حلقات جديدة وتحديثات', cta: 'انضم', aria: 'انضم إلى تيليجرام' },
};
function resolveTelegramCopy(_audioLanguage?: string | null): TelegramCopy {
  // Telegram popup is intentionally always shown in English so the CTA stays consistent
  // across all audio languages and locales.
  return TELEGRAM_COPY.en;
}

export default function Watch() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [searchParams] = useSearchParams();
  const { user, isAdmin, isUploader } = useAuth();
  const navigate = useNavigate();
  const isCastingScreen = useCastDetection();
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
    reloadToken,
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
  const [showFreeAccessPopup, setShowFreeAccessPopup] = useState(false);
  const [tokenSystemReady, setTokenSystemReady] = useState(false);
  const [tokenSystemActive, setTokenSystemActive] = useState(true);
  const [initialSeekDone, setInitialSeekDone] = useState(false);
  const [showResumeNotification, setShowResumeNotification] = useState(false);
  const [savedPlaybackProgress, setSavedPlaybackProgress] = useState(0);
  const [userProfile, setUserProfile] = useState<{ avatar_url: string | null } | null>(null);
  const [isVideoEncoding, setIsVideoEncoding] = useState(false);
  const [serverBlockMessage, setServerBlockMessage] = useState<string | null>(null);
  const ensureHistoryInFlightRef = useRef(false);
  

  // Device-optimized video URL for iOS compatibility
  const deviceOptimizedVideo = useDeviceOptimizedVideo(episodeId, episode?.video_url || null);

  // Check if video is still encoding — only for episodes created within the last 24 hours
  useEffect(() => {
    if (!episodeId) return;
    const checkEncoding = async () => {
      // First check if the episode was created recently (within 24 hours)
      const { data: ep } = await supabase
        .from('episodes')
        .select('created_at')
        .eq('id', episodeId)
        .maybeSingle();

      if (!ep) { setIsVideoEncoding(false); return; }

      const createdAt = new Date(ep.created_at).getTime();
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

      if (createdAt < twentyFourHoursAgo) {
        // Older episode — skip encoding overlay
        setIsVideoEncoding(false);
        return;
      }

      const { data } = await supabase
        .from('video_conversions')
        .select('status')
        .eq('episode_id', episodeId)
        .maybeSingle();
      if (data && data.status !== 'completed') {
        setIsVideoEncoding(true);
      } else {
        setIsVideoEncoding(false);
      }
    };
    checkEncoding();
  }, [episodeId]);

  // Fetch token system status directly from DB on every mount — no caching
  useEffect(() => {
    fetchTokenSystemStatus().then((enabled) => {
      setTokenSystemActive(enabled);
      setTokenSystemReady(true);
      if (!enabled && !isSuperAdmin(user?.email)) {
        setShowFreeAccessPopup(true);
      }
    });
  }, [user?.email]);

  // Check if Telegram popup should be shown (once per day, and not if dismissed this session)
  useEffect(() => {
    const dismissedThisSession = sessionStorage.getItem(TELEGRAM_POPUP_SESSION_KEY);
    if (dismissedThisSession) return;

    const lastShown = localStorage.getItem(TELEGRAM_POPUP_KEY);
    const today = new Date().toDateString();

    if (lastShown !== today) {
      const timer = setTimeout(() => {
        setShowTelegramPopup(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleTelegramJoin = () => {
    window.open('https://t.me/AnimeSaviInhindiDUB', '_blank');
    localStorage.setItem(TELEGRAM_POPUP_KEY, new Date().toDateString());
    sessionStorage.setItem(TELEGRAM_POPUP_SESSION_KEY, '1');
    setShowTelegramPopup(false);
  };

  const handleTelegramDismiss = () => {
    localStorage.setItem(TELEGRAM_POPUP_KEY, new Date().toDateString());
    sessionStorage.setItem(TELEGRAM_POPUP_SESSION_KEY, '1');
    setShowTelegramPopup(false);
  };

  // Handle server change - delegates to useServerAutoSelect.
  // Enforce source-type compatibility:
  //  - File-uploaded videos (video_url present) → only PLAY / SHORT / Zex / XPLUS allowed.
  //  - Embed-link episodes (no video_url, external_url is embed) → only EMBED allowed.
  const handleServerChange = useCallback((server: ServerType) => {
    const hasDirectVideo = !!episode?.video_url;
    const externalIsEmbed = isEmbedLikeUrl(episode?.external_url);
    const isEmbedOnlyEpisode = !hasDirectVideo && externalIsEmbed;
    const isFileOnlyEpisode = hasDirectVideo;

    if (server === 'EMBED' && isFileOnlyEpisode) {
      setServerBlockMessage('Embed link is not available. Please use other servers.');
      return;
    }

    if (server !== 'EMBED' && isEmbedOnlyEpisode) {
      setServerBlockMessage('The video file is not available. Please use "Embed" player for this episode.');
      return;
    }

    handleServerSwitch(server);
  }, [handleServerSwitch, episode]);

  // Show a one-time info message when entering an episode about Embed server status.
  const entryMessageShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!episode) return;
    if (entryMessageShownRef.current === episode.id) return;
    entryMessageShownRef.current = episode.id;
    toast.info('The [Embed] server is not working. It\u2019s under development. Please use other servers.');
  }, [episode]);

  // Auto-assign EMBED server when the loaded episode only has an external embed link.
  // Runs once per episode so the user can still manually switch away afterward.
  const autoEmbedAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!episode) return;
    if (autoEmbedAppliedRef.current === episode.id) return;

    const hasDirectVideo = !!episode.video_url;
    const externalIsEmbed = isEmbedLikeUrl(episode.external_url);

    if (!hasDirectVideo && externalIsEmbed && activeServer !== 'EMBED') {
      autoEmbedAppliedRef.current = episode.id;
      handleServerSwitch('EMBED');
    } else if (hasDirectVideo || !externalIsEmbed) {
      autoEmbedAppliedRef.current = episode.id;
    }
  }, [episode, activeServer, handleServerSwitch]);

  const prevEpisodeIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (episodeId) {
      const isSwitch = !!prevEpisodeIdRef.current && prevEpisodeIdRef.current !== episodeId;
      prevEpisodeIdRef.current = episodeId;
      // Reset watch history for new episode
      if (isSwitch) {
        setWatchHistoryId(null);
        ensureHistoryInFlightRef.current = false;
        setInitialSeekDone(false);
        setSavedPlaybackProgress(0);
        
      }
      fetchEpisodeData(isSwitch);
      fetchComments();
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

    // Handle initial seek from resume progress - "Remember Playback Position"
    // Priority: ?ts=1&t=<seconds>  >  localStorage exact seconds  >  ?t=<percent>
    if (!initialSeekDone && duration > 0) {
      const tsMode = searchParams.get('ts') === '1';
      const stored = (() => {
        try {
          const raw = localStorage.getItem(`resume:${episodeId}`);
          const n = raw ? parseFloat(raw) : NaN;
          return Number.isFinite(n) && n > 5 ? n : null;
        } catch { return null; }
      })();

      let seekTime: number | null = null;
      let label = '';
      if (resumeProgress && tsMode) {
        const sec = parseFloat(resumeProgress);
        if (Number.isFinite(sec) && sec > 5 && sec < duration - 10) {
          seekTime = sec;
          label = `Resuming from ${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
        }
      }
      if (seekTime === null && stored !== null && stored < duration - 10) {
        seekTime = stored;
        label = `Resuming from ${Math.floor(stored / 60)}:${String(Math.floor(stored % 60)).padStart(2, '0')}`;
      }
      if (seekTime === null && resumeProgress && !tsMode) {
        const pct = parseInt(resumeProgress, 10);
        if (!isNaN(pct) && pct > 0 && pct < 95) {
          seekTime = (pct / 100) * duration;
          label = `Resuming from ${Math.round(pct)}%`;
        }
      }

      if (seekTime !== null) {
        const videoElement = document.querySelector('video');
        if (videoElement && Math.abs(videoElement.currentTime - seekTime) > 3) {
          videoElement.currentTime = seekTime;
          setShowResumeNotification(true);
          toast.success(label, {
            description: 'Your exact position was remembered',
            duration: 3000,
          });
          setTimeout(() => setShowResumeNotification(false), 3000);
        }
      }
      setInitialSeekDone(true);
    }

    // Persist exact seconds locally for instant resume next time
    try {
      if (currentTime > 5) {
        localStorage.setItem(`resume:${episodeId}`, String(Math.floor(currentTime)));
      }
    } catch {}

    const progressPercent = Math.floor((currentTime / duration) * 100);
    const completed = progressPercent >= 90;

    // Clear checkpoint when finished so we don't resume completed episodes
    if (completed) {
      try { localStorage.removeItem(`resume:${episodeId}`); } catch {}
    }

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
  }, [user, episodeId, anime, watchHistoryId, resumeProgress, initialSeekDone, searchParams]);

  const fetchEpisodeData = async (isEpisodeSwitch = false) => {
    if (!isEpisodeSwitch) setIsLoading(true);

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

    // Profanity filter — block adult content and ban user
    const { isCommentClean } = await import('@/lib/profanityFilter');
    if (!isCommentClean(trimmedComment)) {
      // Clear the comment input
      if (parentId) {
        setReplyContent('');
        setReplyingTo(null);
      } else {
        setNewComment('');
      }
      
      // Ban user for 24 hours
      const { banUser } = await import('@/lib/banUtils');
      await banUser(user.id);
      
      toast.error('You are trying to promote adult content. You have been banned for 24 hours.', { duration: 8000 });
      
      // Force reload to show ban screen
      setTimeout(() => window.location.reload(), 2000);
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

  // Token access check - super admins bypass, disabled system = free access
  // Wait for DB sync before deciding
  if (!tokenSystemReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="w-16 h-16 rounded-full" />
      </div>
    );
  }

  const accessValid = hasValidTokenAccess(user?.email);

  // Bypass token gate when casting / mirroring to a TV — playback must continue
  if (tokenSystemActive && !accessValid && !isCastingScreen) {
    return <TokenExpiredPopup />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Telegram Mini Toast — non-blocking, sits at bottom corner so it never covers the player.
          SAFEGUARDS:
          - pointer-events-none on outer wrapper -> never blocks scroll/clicks/video playback.
          - No onClick on backdrop, no event listeners attached to player; show/dismiss never
            calls play()/pause() on the <video> element.
          - bottom offset uses max(controls-clearance, env(safe-area-inset-bottom)) so it
            clears iOS home-indicator and Android nav bar AND stays above player controls. */}
      {showTelegramPopup && (() => {
        const tgCopy = resolveTelegramCopy(episode?.audio_language);
        return (
          <div
            className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+1rem))] sm:left-auto sm:right-4 sm:translate-x-0 sm:bottom-[max(1.25rem,env(safe-area-inset-bottom))] w-[min(calc(100vw-1.5rem),22rem)] animate-slide-in-right pointer-events-none"
            role="status"
            aria-live="polite"
            aria-label={tgCopy.aria}
            dir={resolveTelegramCopy(episode?.audio_language) === TELEGRAM_COPY.ar ? 'rtl' : 'ltr'}
          >
            <div className="pointer-events-auto relative flex items-center gap-2.5 rounded-2xl border border-[#0088cc]/30 bg-card/95 backdrop-blur-xl shadow-2xl pl-3 pr-2 py-2.5">
              <button
                onClick={handleTelegramDismiss}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-md"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex-shrink-0 h-9 w-9 rounded-full bg-[#0088cc] flex items-center justify-center shadow-md">
                <Send className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0 pr-1">
                <p className="text-[13px] font-semibold text-foreground leading-tight truncate">{tgCopy.title}</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">{tgCopy.subtitle}</p>
              </div>
              <Button
                onClick={handleTelegramJoin}
                size="sm"
                className="flex-shrink-0 h-8 px-3 text-xs font-semibold bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-lg min-w-[3.5rem]"
              >
                {tgCopy.cta}
              </Button>
            </div>
          </div>
        );
      })()}


      {/* Free Access Popup — shown when token system is disabled */}
      {showFreeAccessPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-orange-500/30 bg-card backdrop-blur-xl shadow-2xl p-6 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center">
              <span className="text-2xl">🎉</span>
            </div>
            <h2 className="text-lg font-bold text-foreground">Token System Disabled</h2>
            <p className="text-sm text-muted-foreground">Token system is disabled now. You can watch any anime episodes/movies for free.</p>
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setShowFreeAccessPopup(false)}>
              OK
            </Button>
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
            onEpisodeSelect={(newEpId) => navigate(`/watch/${newEpId}`, { replace: true })}
            animeTitle={anime?.title}
            seasonNumber={currentSeason?.season_number}
          />
        </div>

        {/* Video Player */}
        <div className="flex-1">
          <VideoPlayer
            key={`${episodeId}-${activeServer}-${reloadToken}`}
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
            captionsUrl={episode.captions_url}
            isEncoding={isVideoEncoding}
            onTimeUpdate={updateWatchProgress}
            hasNextEpisode={!!nextEpisode}
            lockedQuality={2160}
            onNextEpisode={nextEpisode ? () => navigate(`/watch/${nextEpisode.id}`, { replace: true }) : undefined}
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

          {/* Player Strip — anime thumbnail + name (non-fullscreen) */}
          {anime && (
            <Link
              to={`/anime/${anime.id}`}
              className="group mt-2 md:mt-3 flex items-center gap-2.5 md:gap-3 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-border/40 bg-gradient-to-r from-card/70 via-card/40 to-transparent backdrop-blur-md hover:border-primary/40 hover:bg-card/80 transition-all"
            >
              <div className="relative w-9 h-12 md:w-11 md:h-14 rounded-md overflow-hidden shrink-0 ring-1 ring-border/60 group-hover:ring-primary/50 transition-all">
                {anime.cover_image ? (
                  <img
                    src={anime.cover_image}
                    alt={anime.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-primary/80 leading-none mb-1">
                  Now Watching
                </p>
                <p className="text-sm md:text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                  {anime.title}
                </p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate mt-0.5">
                  S{currentSeason?.season_number || 1} · E{episode.episode_number} — {episode.title}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          )}
        </div>
      </div>

      {/* Below Player - Server Selection & Season Switcher */}
      <div className="container py-3 md:py-4 border-b border-border/30">
        <div className="relative rounded-xl md:rounded-2xl border border-border/40 bg-gradient-to-br from-card/80 via-card/40 to-card/60 backdrop-blur-xl p-3 md:p-4 shadow-lg shadow-black/20 overflow-hidden">
          {/* Glow accent */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
            {/* Server Selection */}
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-md bg-primary/15 border border-primary/30">
                  <Server className="h-3 w-3 md:h-3.5 md:w-3.5 text-primary" />
                </div>
                <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-foreground/80">Streaming Server</span>
                <ServerStatusIndicator
                  activeServer={activeServer}
                  failedServers={failedServers}
                  isServerLoading={serverLoading}
                  fallbackOccurred={fallbackOccurred}
                  fallbackFrom={fallbackFrom}
                />
              </div>
              <div className="flex gap-1.5 md:gap-2 flex-wrap">
                {availableServers.map((server) => {
                  const config = SERVER_CONFIGS[server];
                  const isFailed = failedServers.has(server);
                  const isActive = activeServer === server;
                  return (
                    <button
                      key={server}
                      onClick={() => handleServerChange(server)}
                      disabled={serverLoading}
                      title={config.description}
                      className={`group relative px-2.5 md:px-3.5 py-1.5 md:py-2 rounded-lg border text-[11px] md:text-xs font-semibold transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-primary shadow-lg shadow-primary/30 scale-[1.02]'
                          : 'bg-background/40 text-foreground/80 border-border/50 hover:border-primary/50 hover:bg-primary/5 hover:text-foreground'
                      } ${isFailed ? 'opacity-50 line-through' : ''} ${serverLoading ? 'cursor-wait' : ''}`}
                    >
                      <span className="flex items-center gap-1.5">
                        {isActive && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-foreground" />
                          </span>
                        )}
                        {config.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Season Switcher */}
            {allSeasons.length > 0 && (
              <div className="flex items-center gap-2 md:gap-3 md:border-l md:border-border/40 md:pl-5 min-w-0 md:ml-auto">
                <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-foreground/80 shrink-0">Season</span>
                <div className="relative flex-1 md:flex-initial">
                  <select
                    value={currentSeason?.id || ''}
                    onChange={(e) => handleSeasonChange(e.target.value)}
                    className="w-full appearance-none bg-background/60 border border-border/50 rounded-lg pl-3 pr-9 py-1.5 md:py-2 text-xs md:text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/40 transition-colors cursor-pointer"
                  >
                    {allSeasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        Season {season.season_number} {season.episode_count !== undefined ? `· ${season.episode_count} eps` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rotate-90 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Episode List - Below Server/Season Selection */}
      <div className="lg:hidden container py-4 border-b border-border/30">
        <EpisodeList
          episodes={allEpisodes}
          currentEpisodeId={episodeId || ''}
          className="max-h-[250px]"
          onEpisodeSelect={(newEpId) => navigate(`/watch/${newEpId}`, { replace: true })}
          animeTitle={anime?.title}
          seasonNumber={currentSeason?.season_number}
        />
      </div>

      {/* Episode Info & Navigation */}
      <div className="container py-3 md:py-8">
        <div className="relative rounded-lg md:rounded-3xl border border-border/40 bg-gradient-to-br from-card/70 via-background/40 to-card/50 backdrop-blur-xl p-3 md:p-7 shadow-md md:shadow-xl shadow-black/20 overflow-hidden">
          {/* Decorative glows — desktop only */}
          <div className="hidden md:block absolute -top-20 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="hidden md:block absolute -bottom-20 -left-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col gap-2.5 md:gap-6">
            {/* Breadcrumb with Format Indicator */}
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <div className="flex items-center gap-1 md:gap-1.5 text-[11px] md:text-sm min-w-0">
                <Link to={`/anime/${anime?.id}`} className="text-muted-foreground hover:text-primary transition-colors font-medium truncate max-w-[140px] md:max-w-none">
                  {anime?.title}
                </Link>
                <ChevronRight className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground/60 shrink-0" />
                <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-md bg-primary/10 border border-primary/30 text-primary font-bold text-[10px] md:text-xs shrink-0">
                  S{currentSeason?.season_number || 1} · E{episode.episode_number}
                </span>
              </div>
              {(isAdmin || isUploader) && (
                <VideoFormatIndicator
                  servedFormat={deviceOptimizedVideo.servedFormat}
                  device={deviceOptimizedVideo.device}
                  conversionStatus={deviceOptimizedVideo.conversionStatus}
                  isHLS={deviceOptimizedVideo.videoUrl?.includes('.m3u8') || false}
                />
              )}
            </div>

            {/* Episode Title */}
            <div className="space-y-1.5 md:space-y-2">
              <span className="inline-flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-[9px] md:text-xs font-bold uppercase tracking-wider text-accent-foreground">
                <span className="w-1 h-1 rounded-full bg-accent animate-pulse" />
                Now Playing
              </span>
              <h1 className="text-base md:text-3xl font-heading font-bold leading-snug md:leading-tight text-foreground">
                {episode.title}
              </h1>
            </div>

            {/* Description */}
            {episode.description && (
              <p className="text-[11px] md:text-sm leading-relaxed text-muted-foreground border-l-2 border-primary/40 pl-2.5 md:pl-4 py-0.5 md:py-1">
                {episode.description}
              </p>
            )}

            {/* Quick actions row: Edit + Watch Party */}
            {((isAdmin || isUploader) || anime) && (
              <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                {(isAdmin || isUploader) && anime && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/upload/anime/${anime.id}/episode/${episode.id}/edit`)}
                    className="h-8 md:h-9 text-xs"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1.5" />
                    Edit
                  </Button>
                )}
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
            )}

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {/* Episode Navigation */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {prevEpisode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/watch/${prevEpisode.id}`, { replace: true })}
                  className="h-9 md:h-10 text-xs md:text-sm border-border/60 hover:border-primary/60 hover:bg-primary/5"
                >
                  <ChevronLeft className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5" />
                  Previous
                </Button>
              )}
              {nextEpisode && (
                <Button
                  size="sm"
                  className="anime-button h-9 md:h-10 text-xs md:text-sm shadow-lg shadow-primary/20"
                  onClick={() => navigate(`/watch/${nextEpisode.id}`, { replace: true })}
                >
                  Next Episode
                  <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 ml-1.5" />
                </Button>
              )}

              {/* Offline Download Button */}
              <OfflineDownloadButton
                videoUrl={episode.video_url}
                iosVideoUrl={deviceOptimizedVideo.device === 'iOS' ? deviceOptimizedVideo.videoUrl : null}
                episodeId={episode.id}
                episodeTitle={episode.title}
                animeTitle={anime?.title || 'Unknown'}
                thumbnail={episode.thumbnail}
                isIOSDevice={deviceOptimizedVideo.device === 'iOS'}
              />
            
            {(() => {
              const animeSlug = anime?.title
                ? anime.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                : '';
              const seasonNum = currentSeason?.season_number || 1;
              const pageUrl = `/${animeSlug}/season-${seasonNum}-episode-${episode.episode_number}`;
              const embedUrl = `/embed/${animeSlug}/season-${seasonNum}/episode-${episode.episode_number}`;
              return (
                <ShareEmbedPopup
                  type="episode"
                  pageUrl={pageUrl}
                  embedUrl={embedUrl}
                  animeTitle={anime?.title || 'Episode'}
                />
              );
            })()}
          </div>
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-6 mt-6 md:mt-8">
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
  );
}