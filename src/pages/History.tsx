import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  History as HistoryIcon,
  Play,
  Clock,
  Trash2,
  User,
  Check,
  Download,
  Film,
  Tv,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
}

interface Episode {
  id: string;
  title: string;
  episode_number: number;
  duration: number | null;
}

interface WatchHistoryItem {
  id: string;
  watched_at: string;
  progress: number | null;
  completed: boolean | null;
  anime: Anime;
  episode: Episode;
}

export default function History() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ username: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchHistory();
    fetchUserProfile();
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();
    if (data) setUserProfile(data);
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('watch_history')
        .select(`id, watched_at, progress, completed, anime_id, episode_id`)
        .eq('user_id', user!.id)
        .order('watched_at', { ascending: false });

      if (error) {
        console.error('Error fetching watch history:', error);
        setIsLoading(false);
        return;
      }

      if (data && data.length > 0) {
        const animeIds = [...new Set(data.map((h) => h.anime_id))];
        const episodeIds = [...new Set(data.map((h) => h.episode_id))];

        const [animeResponse, episodeResponse] = await Promise.all([
          supabase.from('anime').select('id, title, cover_image').in('id', animeIds),
          supabase.from('episodes').select('id, title, episode_number, duration').in('id', episodeIds),
        ]);

        const animeMap = new Map(animeResponse.data?.map((a) => [a.id, a]) || []);
        const episodeMap = new Map(episodeResponse.data?.map((e) => [e.id, e]) || []);

        const historyWithDetails = data.map((h) => ({
          id: h.id,
          watched_at: h.watched_at,
          progress: h.progress,
          completed: h.completed,
          anime: animeMap.get(h.anime_id) || { id: h.anime_id, title: 'Unknown', cover_image: null },
          episode:
            episodeMap.get(h.episode_id) || {
              id: h.episode_id,
              title: 'Unknown',
              episode_number: 0,
              duration: null,
            },
        }));

        setHistory(historyWithDetails as WatchHistoryItem[]);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
    setIsLoading(false);
  };

  const deleteHistoryItem = async (historyId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if ('nativeEvent' in e && e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
    try {
      const { error } = await supabase.from('watch_history').delete().eq('id', historyId);
      if (error) {
        toast.error('Failed to delete history item');
      } else {
        setHistory((prev) => prev.filter((item) => item.id !== historyId));
        toast.success('Removed from history');
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete history item');
    }
  };

  const markAsWatched = async (historyId: string, animeTitle: string) => {
    const { error } = await supabase
      .from('watch_history')
      .update({ completed: true, progress: 100 })
      .eq('id', historyId);

    if (!error) {
      setHistory((prev) =>
        prev.map((item) =>
          item.id === historyId ? { ...item, completed: true, progress: 100 } : item,
        ),
      );
      toast.success(`Marked "${animeTitle}" as watched`);
    } else {
      toast.error('Failed to mark as watched');
    }
  };

  const saveOffline = async (item: WatchHistoryItem) => {
    const episodeUrl = `/watch/${item.episode.id}`;
    toast.info(
      `Opening "${item.anime.title}" EP ${item.episode.episode_number} — use the download button in the player to save offline.`,
    );
    navigate(episodeUrl);
  };

  const clearAllHistory = async () => {
    const { error } = await supabase.from('watch_history').delete().eq('user_id', user!.id);
    if (error) {
      toast.error('Failed to clear history');
    } else {
      setHistory([]);
      toast.success('Watch history cleared');
    }
  };

  const buildResumeUrl = (item: WatchHistoryItem) => {
    try {
      const raw = localStorage.getItem(`resume:${item.episode.id}`);
      const sec = raw ? parseFloat(raw) : NaN;
      if (Number.isFinite(sec) && sec > 5) {
        return `/watch/${item.episode.id}?ts=1&t=${Math.floor(sec)}`;
      }
    } catch {}
    return `/watch/${item.episode.id}?t=${item.progress || 0}`;
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 },
    ];
    for (const interval of intervals) {
      const count = Math.floor(seconds / interval.seconds);
      if (count > 0) return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
    }
    return 'Just now';
  };

  // Episode duration is stored in MINUTES. Use a 24-min fallback for legacy rows
  // where duration was never populated, so stats and the "watched" label aren't 0.
  const FALLBACK_EP_MINUTES = 24;

  const formatWatchedTime = (progress: number | null, duration: number | null) => {
    if (!progress) return null;
    const durMin = duration && duration > 0 ? duration : FALLBACK_EP_MINUTES;
    const totalMin = Math.max(1, Math.round((progress / 100) * durMin));
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    if (hours > 0) return `${hours}h ${minutes}m watched`;
    return `${totalMin}m watched`;
  };

  const formatTotalTime = (totalMinutes: number) => {
    const totalMin = Math.round(totalMinutes);
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${totalMin}m`;
  };

  // Stats
  const stats = useMemo(() => {
    const totalEpisodes = history.length;
    const completed = history.filter((h) => h.completed).length;
    const inProgress = totalEpisodes - completed;
    const uniqueAnime = new Set(history.map((h) => h.anime.id)).size;
    const totalMinutes = history.reduce((acc, h) => {
      if (!h.progress && !h.completed) return acc;
      const durMin = h.episode.duration && h.episode.duration > 0 ? h.episode.duration : FALLBACK_EP_MINUTES;
      // Completed episodes count as full runtime even if progress saved as 90-95%.
      const effective = h.completed ? 100 : (h.progress || 0);
      return acc + (effective / 100) * durMin;
    }, 0);
    return {
      totalEpisodes,
      completed,
      inProgress,
      uniqueAnime,
      totalWatched: formatTotalTime(totalMinutes),
    };
  }, [history]);

  if (isLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-48 w-full rounded-2xl mb-8" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Cinematic hero */}
      <div className="relative h-[240px] md:h-[300px] overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-rose-500/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.3),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(0_85%_50%/0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />

        <div className="relative container h-full flex flex-col justify-end pb-6 md:pb-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-rose-500 blur-xl opacity-60" />
                <Avatar className="relative h-16 w-16 md:h-20 md:w-20 rounded-2xl border-2 border-primary/40 shadow-2xl">
                  <AvatarImage
                    src={userProfile?.avatar_url || undefined}
                    alt={userProfile?.username || 'User'}
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary to-rose-500 text-white text-xl font-bold">
                    {userProfile?.username?.charAt(0).toUpperCase() || <User className="h-7 w-7" />}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1 flex items-center gap-2">
                  <HistoryIcon className="h-3 w-3" />
                  Your Journey
                </p>
                <h1 className="text-3xl md:text-5xl font-heading font-bold tracking-tight">
                  Watch <span className="anime-gradient-text">History</span>
                </h1>
                {userProfile?.username && (
                  <p className="text-sm md:text-base text-muted-foreground mt-1">
                    Welcome back, <span className="text-foreground font-medium">{userProfile.username}</span>
                  </p>
                )}
              </div>
            </div>

            {history.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive backdrop-blur-md bg-card/40"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Watch History?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all your watch
                      history and remove all your progress data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={clearAllHistory}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      <div className="container py-6 md:py-8">
        {history.length === 0 ? (
          <div className="text-center py-20">
            <div className="relative inline-flex mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-rose-500 blur-2xl opacity-40" />
              <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-rose-500/10 border border-primary/30 flex items-center justify-center">
                <HistoryIcon className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-heading font-bold mb-2">No watch history yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start watching anime to track your progress and pick up right where you left off.
            </p>
            <Button asChild className="bg-gradient-to-r from-primary to-rose-500 hover:opacity-90 text-white">
              <Link to="/browse">
                <Play className="h-4 w-4 mr-2 fill-current" />
                Browse Anime
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {[
                { icon: Film, label: 'Episodes', value: stats.totalEpisodes },
                { icon: Tv, label: 'Anime', value: stats.uniqueAnime },
                { icon: Check, label: 'Completed', value: stats.completed },
                { icon: Clock, label: 'Time Watched', value: stats.totalWatched },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/40 backdrop-blur-md p-4 hover:border-primary/40 transition-all"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <stat.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {stat.label}
                      </p>
                      <p className="text-xl font-bold tabular-nums">{stat.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                Recent Activity
              </h2>
              <div className="flex-1 h-px bg-gradient-to-r from-border via-border/40 to-transparent" />
            </div>

            {/* Desktop list */}
            <div className="hidden md:block space-y-3">
              {history.map((item) => (
                <ContextMenu key={item.id}>
                  <ContextMenuTrigger asChild>
                    <div className="relative group">
                      <Link
                        to={buildResumeUrl(item)}
                        className="relative flex gap-4 p-3 rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm hover:border-primary/40 hover:bg-card/70 transition-all overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="relative flex-shrink-0 w-36 aspect-video rounded-lg overflow-hidden bg-muted ring-1 ring-border/40">
                          <img
                            src={item.anime.cover_image || '/placeholder.svg'}
                            alt={item.anime.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="h-12 w-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                              <Play className="h-5 w-5 text-white fill-current ml-0.5" />
                            </div>
                          </div>
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-primary/90 backdrop-blur-sm text-[10px] font-bold text-primary-foreground">
                            EP {item.episode.episode_number}
                          </div>
                          {item.completed && (
                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-500/90 backdrop-blur-sm text-[10px] font-bold text-white flex items-center gap-1">
                              <Check className="h-2.5 w-2.5" />
                              DONE
                            </div>
                          )}
                          {item.progress !== null && item.progress > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                              <div
                                className="h-full bg-gradient-to-r from-primary to-rose-500"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="relative flex-1 min-w-0 flex flex-col justify-center">
                          <h3 className="font-semibold text-base group-hover:text-primary transition-colors line-clamp-1">
                            {item.anime.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                            EP {item.episode.episode_number} · {item.episode.title}
                          </p>
                          <div className="flex items-center flex-wrap gap-3 mt-2 text-xs">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatTimeAgo(item.watched_at)}
                            </span>
                            {item.progress !== null && item.progress > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                                {item.completed ? 'Completed' : `${item.progress}% watched`}
                              </span>
                            )}
                            {formatWatchedTime(item.progress, item.episode.duration) && (
                              <span className="text-muted-foreground">
                                {formatWatchedTime(item.progress, item.episode.duration)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="relative flex items-center gap-2 pr-2">
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-primary to-rose-500 hover:opacity-90 text-white shadow-lg"
                            asChild
                          >
                            <span>
                              <Play className="h-3.5 w-3.5 mr-1 fill-current" />
                              Resume
                            </span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => deleteHistoryItem(item.id, e)}
                            type="button"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Link>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-52">
                    <ContextMenuItem
                      onClick={() => markAsWatched(item.id, item.anime.title)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Check className="h-4 w-4 text-emerald-500" />
                      <span>Mark as Watched</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => saveOffline(item)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="h-4 w-4 text-blue-500" />
                      <span>Save Offline</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>

            {/* Mobile grid */}
            <div className="md:hidden grid grid-cols-2 sm:grid-cols-3 gap-3">
              {history.map((item) => (
                <ContextMenu key={item.id}>
                  <ContextMenuTrigger asChild>
                    <div className="relative group">
                      <Link to={buildResumeUrl(item)} className="block">
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-muted ring-1 ring-border/40">
                          <img
                            src={item.anime.cover_image || '/placeholder.svg'}
                            alt={item.anime.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-active:opacity-100 transition-opacity">
                            <Play className="h-8 w-8 text-white fill-current" />
                          </div>
                          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-primary/90 backdrop-blur-sm text-[9px] font-bold text-primary-foreground">
                            EP {item.episode.episode_number}
                          </div>
                          {item.completed && (
                            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-emerald-500/90 text-[8px] font-bold text-white">
                              ✓
                            </div>
                          )}
                          {item.progress !== null && item.progress > 0 && !item.completed && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                              <div
                                className="h-full bg-gradient-to-r from-primary to-rose-500"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs font-medium line-clamp-2 leading-tight">
                          {item.anime.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatTimeAgo(item.watched_at)}
                        </p>
                      </Link>
                      {!item.completed && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute top-1 right-1 h-6 w-6 text-white/90 hover:text-destructive bg-black/50 hover:bg-black/70 backdrop-blur-sm z-20"
                          onClick={(e) => deleteHistoryItem(item.id, e)}
                          type="button"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-52">
                    <ContextMenuItem
                      onClick={() => markAsWatched(item.id, item.anime.title)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Check className="h-4 w-4 text-emerald-500" />
                      <span>Mark as Watched</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => saveOffline(item)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="h-4 w-4 text-blue-500" />
                      <span>Save Offline</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
