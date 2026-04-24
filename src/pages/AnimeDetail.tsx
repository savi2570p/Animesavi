import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { preloadImages } from '@/lib/imageOptimization';
import { BatchDownload } from '@/components/download/BatchDownload';
import { AnimeReviews } from '@/components/anime/AnimeReviews';
import { ShareEmbedPopup } from '@/components/ShareEmbedPopup';
import {
  Play,
  Heart,
  Share2,
  Calendar,
  Clock,
  Star,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Download,
  ListVideo,
  Flame,
  CalendarClock,
} from 'lucide-react';

// Helper to create slug from title
const createSlug = (title: string): string => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

interface Anime {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  banner_image: string | null;
  genres: string[];
  release_year: number | null;
  status: string | null;
  type: string | null;
  view_count: number | null;
  like_count: number | null;
  studio?: string | null;
  total_episodes?: number | null;
}

interface Season {
  id: string;
  season_number: number;
  title: string | null;
  anime_id: string;
}

interface Episode {
  id: string;
  episode_number: number;
  title: string;
  description: string | null;
  thumbnail: string | null;
  duration: number | null;
  video_url: string | null;
  external_url: string | null;
  season_id: string;
}

interface WatchProgress {
  episode_id: string;
  progress: number;
  completed: boolean;
}

export default function AnimeDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isInWatchList, setIsInWatchList] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Anime[]>([]);
  const [watchProgress, setWatchProgress] = useState<Map<string, WatchProgress>>(new Map());
  
  // Long press for mobile thumbnail download
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  
  // Download thumbnail handler
  const handleDownloadThumbnail = useCallback(async () => {
    if (!anime?.cover_image) {
      toast.error('No image available to download');
      return;
    }
    
    try {
      const response = await fetch(anime.cover_image);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${anime.title.replace(/[^a-z0-9]/gi, '_')}_poster.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Downloading poster...');
    } catch (error) {
      toast.error('Failed to download image');
    }
  }, [anime]);
  
  // Mobile long press handlers
  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setIsLongPressing(true);
      handleDownloadThumbnail();
    }, 600);
  }, [handleDownloadThumbnail]);
  
  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setTimeout(() => setIsLongPressing(false), 100);
  }, []);
  
  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (id) {
      fetchAnimeDetails();
      if (user) {
        checkFavorite();
        fetchWatchProgress();
      }
    }
  }, [id, user]);

  useEffect(() => {
    if (selectedSeason) {
      fetchEpisodes(selectedSeason);
    }
  }, [selectedSeason]);

  useEffect(() => {
    if (user && episodes.length > 0) {
      checkWatchList();
    }
  }, [episodes, user]);

  const fetchAnimeDetails = async () => {
    setIsLoading(true);
    
    const [animeRes, extrasRes] = await Promise.all([
      supabase.from('anime_public').select('*').eq('id', id).single(),
      supabase.from('anime').select('studio, total_episodes').eq('id', id).maybeSingle(),
    ]);
    const animeData = animeRes.data;
    const animeError = animeRes.error;

    if (animeError || !animeData) {
      toast.error('Failed to load anime details');
      setIsLoading(false);
      return;
    }

    const merged: Anime = {
      ...(animeData as any),
      studio: extrasRes.data?.studio ?? null,
      total_episodes: extrasRes.data?.total_episodes ?? null,
    };
    setAnime(merged);
    // Preload cover and banner for instant display
    preloadImages([animeData.cover_image, animeData.banner_image]);

    // Replace URL with slug-based URL for clean sharing
    if (animeData.title) {
      const slug = createSlug(animeData.title);
      const slugUrl = `/${slug}`;
      if (window.location.pathname !== slugUrl) {
        window.history.replaceState(null, '', slugUrl);
      }
    }

    const { data: seasonsData } = await supabase
      .from('seasons')
      .select('*')
      .eq('anime_id', id)
      .order('season_number');

    if (seasonsData && seasonsData.length > 0) {
      setSeasons(seasonsData);
      setSelectedSeason(seasonsData[0].id);
    }

    if (animeData.genres && animeData.genres.length > 0) {
      const { data: recData } = await supabase
        .from('anime_public')
        .select('*')
        .neq('id', id)
        .overlaps('genres', animeData.genres)
        .limit(6);

      if (recData) {
        setRecommendations(recData);
      }
    }

    await supabase
      .from('anime')
      .update({ view_count: (animeData.view_count || 0) + 1 })
      .eq('id', id);

    setIsLoading(false);
  };

  const fetchEpisodes = async (seasonId: string) => {
    const { data } = await supabase
      .from('episodes')
      .select('*')
      .eq('season_id', seasonId)
      .order('episode_number');

    if (data) {
      setEpisodes(data);
      // Preload first 8 episode thumbnails
      preloadImages(data.slice(0, 8).map(ep => ep.thumbnail));
    }
  };

  const fetchWatchProgress = async () => {
    if (!user || !id) return;

    const { data } = await supabase
      .from('watch_history')
      .select('episode_id, progress, completed')
      .eq('user_id', user.id)
      .eq('anime_id', id);

    if (data) {
      const progressMap = new Map<string, WatchProgress>();
      data.forEach(item => {
        progressMap.set(item.episode_id, {
          episode_id: item.episode_id,
          progress: item.progress || 0,
          completed: item.completed || false,
        });
      });
      setWatchProgress(progressMap);
    }
  };

  const checkFavorite = async () => {
    const { data } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', user!.id)
      .eq('anime_id', id)
      .maybeSingle();

    setIsFavorite(!!data);
  };

  const toggleFavorite = async () => {
    if (!user) {
      toast.error('Please sign in to add favorites');
      return;
    }

    if (isFavorite) {
      await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('anime_id', id);
      setIsFavorite(false);
      toast.success('Removed from favorites');
    } else {
      await supabase
        .from('user_favorites')
        .insert({ user_id: user.id, anime_id: id });
      setIsFavorite(true);
      toast.success('Added to favorites');
    }
  };

  const checkWatchList = async () => {
    if (!user || episodes.length === 0) return;
    const firstEp = episodes[0];
    if (!firstEp) return;
    const { data } = await supabase
      .from('watch_later')
      .select('id')
      .eq('user_id', user.id)
      .eq('episode_id', firstEp.id)
      .maybeSingle();
    setIsInWatchList(!!data);
  };

  const toggleWatchList = async () => {
    if (!user) {
      toast.error('Please sign in to use Watch List');
      return;
    }
    const firstEp = episodes[0];
    if (!firstEp) return;

    if (isInWatchList) {
      await supabase
        .from('watch_later')
        .delete()
        .eq('user_id', user.id)
        .eq('episode_id', firstEp.id);
      setIsInWatchList(false);
      toast.success('Removed from Watch List');
    } else {
      await supabase
        .from('watch_later')
        .insert({ user_id: user.id, episode_id: firstEp.id });
      setIsInWatchList(true);
      toast.success('Added to Watch List');
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '';
    return `${minutes} min`;
  };

  const getEpisodeProgress = (episodeId: string): number => {
    const progress = watchProgress.get(episodeId);
    return progress?.progress || 0;
  };

  const isEpisodeCompleted = (episodeId: string): boolean => {
    const progress = watchProgress.get(episodeId);
    return progress?.completed || false;
  };

  const markAsWatched = async (episodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast.error('Please sign in to track your progress');
      return;
    }

    const isCompleted = isEpisodeCompleted(episodeId);
    
    // Check if entry exists
    const { data: existing } = await supabase
      .from('watch_history')
      .select('id')
      .eq('user_id', user.id)
      .eq('episode_id', episodeId)
      .maybeSingle();

    if (existing) {
      // Update existing
      await supabase
        .from('watch_history')
        .update({ 
          completed: !isCompleted,
          progress: !isCompleted ? 100 : 0,
        })
        .eq('id', existing.id);
    } else {
      // Insert new
      await supabase
        .from('watch_history')
        .insert({
          user_id: user.id,
          episode_id: episodeId,
          anime_id: id!,
          completed: true,
          progress: 100,
        });
    }

    // Update local state
    setWatchProgress(prev => {
      const newMap = new Map(prev);
      newMap.set(episodeId, {
        episode_id: episodeId,
        progress: !isCompleted ? 100 : 0,
        completed: !isCompleted,
      });
      return newMap;
    });

    toast.success(!isCompleted ? 'Marked as watched' : 'Marked as unwatched');
  };

  const getFirstUnwatchedEpisode = (): Episode | null => {
    for (const ep of episodes) {
      if (!isEpisodeCompleted(ep.id)) {
        return ep;
      }
    }
    return episodes[0] || null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen animate-fade-in">
        {/* Hero backdrop skeleton */}
        <div className="relative h-[42vh] md:h-[85vh] overflow-hidden">
          <div className="absolute inset-0 skeleton-shimmer" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,hsl(var(--primary)/0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/55 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/80 to-transparent" />
        </div>

        {/* Content skeleton mirrors real layout */}
        <div className="container relative -mt-[28vh] md:-mt-[55vh] z-10 pb-8 md:pb-12">
          <div className="flex flex-col lg:flex-row gap-5 md:gap-10">
            {/* Poster skeleton */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="absolute -inset-3 rounded-2xl bg-primary/10 blur-2xl" />
                <Skeleton className="relative w-28 md:w-72 h-40 md:h-[26rem] rounded-xl md:rounded-2xl border border-border/40" />
              </div>
            </div>

            {/* Info skeleton */}
            <div className="flex-1 space-y-4 md:space-y-5">
              {/* Status pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <Skeleton className="h-6 w-32 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              {/* Title */}
              <div className="space-y-2">
                <Skeleton className="h-8 md:h-14 w-3/4" />
                <Skeleton className="h-8 md:h-14 w-1/2 md:hidden" />
              </div>
              {/* Genre chips */}
              <div className="flex flex-wrap gap-1.5">
                {[60, 80, 70, 90, 65].map((w, i) => (
                  <Skeleton key={i} className="h-6 rounded-full" style={{ width: `${w}px` }} />
                ))}
              </div>
              {/* Meta chips */}
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {[70, 60, 50, 90, 110].map((w, i) => (
                  <Skeleton key={i} className="h-7 rounded-lg" style={{ width: `${w}px` }} />
                ))}
              </div>
              {/* Description lines */}
              <div className="space-y-2 max-w-3xl pl-3 md:pl-4 border-l-[3px] border-primary/20 rounded-l">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-[95%]" />
                <Skeleton className="h-3.5 w-[88%]" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 md:gap-3 pt-2 md:pt-3">
                <Skeleton className="h-11 md:h-14 w-32 md:w-44 rounded-xl" />
                <Skeleton className="h-11 md:h-14 w-24 md:w-32 rounded-xl" />
                <Skeleton className="h-11 md:h-14 w-24 md:w-32 rounded-xl" />
                <Skeleton className="h-11 md:h-14 w-32 md:w-40 rounded-xl" />
              </div>
            </div>
          </div>

          {/* Episodes section skeleton */}
          <div className="mt-12 md:mt-16">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 md:h-8 bg-primary/30 rounded-full" />
                <Skeleton className="h-7 md:h-9 w-32 md:w-44" />
              </div>
              <Skeleton className="h-10 w-[200px] md:w-[240px] rounded-md" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-border/30 bg-card/40">
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <div className="p-2.5 space-y-1.5">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="container py-20 text-center">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
          <Play className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Anime not found</h1>
        <p className="text-muted-foreground mb-6">The anime you're looking for doesn't exist or has been removed.</p>
        <Button asChild className="anime-button">
          <Link to="/browse">Browse Anime</Link>
        </Button>
      </div>
    );
  }

  const nextEpisode = getFirstUnwatchedEpisode();

  return (
    <div className="min-h-screen detail-fade-swap">
      {/* Hero Banner — cinematic backdrop */}
      <div className="relative h-[42vh] md:h-[85vh] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center scale-110 animate-[float_24s_ease-in-out_infinite]"
          style={{
            backgroundImage: `url(${anime.banner_image || anime.cover_image || '/placeholder.svg'})`,
            filter: 'saturate(1.05) contrast(1.05)',
          }}
        />
        {/* Dark vignette + radial accent */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,hsl(var(--primary)/0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/55 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/80 to-transparent" />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary/40 rounded-full animate-float" />
          <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-primary/25 rounded-full animate-float animation-delay-200" />
          <div className="absolute bottom-1/3 left-1/2 w-2 h-2 bg-accent/30 rounded-full animate-float animation-delay-400" />
        </div>
      </div>

      {/* Content */}
      <div className="container relative -mt-[28vh] md:-mt-[55vh] z-10 pb-8 md:pb-12">
        <div className="flex flex-col lg:flex-row gap-5 md:gap-10">
          {/* Poster */}
          <div className="flex-shrink-0 animate-fade-in">
            <div
              className="relative group"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
            >
              {/* Glow halo behind poster */}
              <div className="absolute -inset-3 rounded-2xl bg-gradient-to-br from-primary/40 via-primary/10 to-transparent blur-2xl opacity-60 group-hover:opacity-90 transition-opacity duration-500" />
              <img
                src={anime.cover_image || '/placeholder.svg'}
                alt={anime.title}
                className="relative w-28 md:w-72 rounded-xl md:rounded-2xl shadow-[0_25px_60px_-15px_hsl(var(--primary)/0.5),0_15px_40px_-15px_hsl(0_0%_0%/0.7)] border border-border/40 transition-transform duration-500 group-hover:scale-[1.03] cursor-pointer"
              />
              <div className="absolute inset-0 rounded-xl md:rounded-2xl bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Quick play */}
              {nextEpisode && (
                <Link
                  to={`/watch/${nextEpisode.id}`}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                >
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-2xl shadow-primary/60 hover:scale-110 transition-transform ring-4 ring-primary/30">
                    <Play className="w-7 h-7 text-primary-foreground fill-current ml-1" />
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4 md:space-y-5 detail-stagger">
            {/* Status pill row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 backdrop-blur-md px-2.5 py-1 text-[10px] md:text-xs font-bold uppercase tracking-[0.18em] text-primary shadow-lg shadow-primary/10">
                <Sparkles className="h-3 w-3" />
                Featured Anime
              </div>
              {anime.status === 'ongoing' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 backdrop-blur-md px-2.5 py-1 text-[10px] md:text-xs font-bold uppercase tracking-wider text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Airing Now
                </span>
              )}
            </div>

            {/* Title — gradient */}
            <h1 className="text-2xl md:text-6xl font-heading font-extrabold leading-[1.05] tracking-tight">
              <span className="bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                {anime.title}
              </span>
            </h1>

            {/* Genres — chips */}
            <div className="flex flex-wrap gap-1.5">
              {anime.genres?.map((genre, i) => (
                <Badge
                  key={genre}
                  className="genre-badge animate-fade-in text-[10px] md:text-xs px-2.5 py-1 rounded-full border border-foreground/15 bg-foreground/5 backdrop-blur-md text-foreground/85 hover:border-primary/50 hover:text-primary transition-colors"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {genre}
                </Badge>
              ))}
            </div>

            {/* Meta info — glass chips */}
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              {anime.release_year && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] md:text-sm font-semibold bg-foreground/5 border border-foreground/10 backdrop-blur-md text-foreground/85">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  {anime.release_year}
                </span>
              )}
              {anime.type && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] md:text-sm font-bold capitalize bg-primary/10 border border-primary/30 text-primary backdrop-blur-md">
                  {anime.type}
                </span>
              )}
              {anime.status && (
                <span className={cn(
                  anime.status === 'ongoing' ? 'badge-glass-og' :
                  anime.status === 'completed' ? 'badge-glass-com' :
                  'bg-primary text-primary-foreground px-2.5 py-1 rounded-lg text-[11px] md:text-sm'
                )}>
                  {anime.status === 'ongoing' ? 'OG' : anime.status === 'completed' ? 'COM' : anime.status}
                </span>
              )}
              {anime.total_episodes != null && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] md:text-sm font-semibold bg-foreground/5 border border-foreground/10 backdrop-blur-md text-foreground/85">
                  <ListVideo className="h-3.5 w-3.5 text-primary" />
                  {anime.total_episodes} EP{anime.total_episodes === 1 ? '' : 's'}
                </span>
              )}
              {anime.studio && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] md:text-sm font-semibold bg-foreground/5 border border-foreground/10 backdrop-blur-md text-foreground/85 max-w-[200px] truncate">
                  <Flame className="h-3.5 w-3.5 text-amber-400" />
                  {anime.studio}
                </span>
              )}
              <span className="badge-glass-hdub">H-DUB</span>
            </div>

            {/* Description — accent border card */}
            <div className="relative max-w-3xl">
              <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-gradient-to-b from-primary via-primary/60 to-transparent" />
              <p className="text-foreground/80 leading-relaxed text-[13px] md:text-base pl-3 md:pl-4">
                {anime.description}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 md:gap-3 pt-2 md:pt-3">
              {nextEpisode && (
                <Button asChild size="sm" className="group bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground hover:scale-[1.03] h-11 md:h-14 px-5 md:px-8 text-sm md:text-base rounded-xl shadow-2xl shadow-primary/40 transition-all">
                  <Link to={`/watch/${nextEpisode.id}`}>
                    <Play className="h-4 w-4 md:h-5 md:w-5 mr-2 fill-current group-hover:translate-x-0.5 transition-transform" />
                    {watchProgress.size > 0 ? 'Continue' : 'Watch Now'}
                  </Link>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={toggleFavorite}
                className={cn(
                  "h-11 md:h-14 px-4 md:px-5 rounded-xl border backdrop-blur-md transition-all duration-300 text-xs md:text-sm",
                  isFavorite
                    ? 'text-anime-pink border-anime-pink/60 bg-anime-pink/10 hover:bg-anime-pink/20'
                    : 'border-foreground/20 bg-foreground/5 hover:border-anime-pink/60 hover:text-anime-pink'
                )}
              >
                <Heart className={cn("h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2", isFavorite && 'fill-current')} />
                {isFavorite ? 'Favorited' : 'Favorite'}
              </Button>
              <ShareEmbedPopup
                type="series"
                pageUrl={window.location.pathname}
                animeTitle={anime.title}
                size="lg"
                className="h-11 md:h-14 px-4 md:px-5 rounded-xl border border-foreground/20 bg-foreground/5 backdrop-blur-md hover:border-primary/40"
              />

              {/* Watch List Button */}
              {nextEpisode && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={toggleWatchList}
                  className={cn(
                    "h-11 md:h-14 px-4 md:px-5 rounded-xl border backdrop-blur-md transition-all duration-300 text-xs md:text-sm",
                    isInWatchList
                      ? 'text-primary border-primary/60 bg-primary/10 hover:bg-primary/20'
                      : 'border-foreground/20 bg-foreground/5 hover:border-primary/40 hover:text-primary'
                  )}
                >
                  <ListVideo className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2" />
                  {isInWatchList ? 'In Watch List' : 'Watch List'}
                </Button>
              )}

              {/* Batch Download */}
              {episodes.length > 0 && (
                <BatchDownload episodes={episodes} animeTitle={anime.title} />
              )}
            </div>
          </div>
        </div>

        {/* Episodes Section */}
        <div className="mt-16">
          <Tabs value={selectedSeason || undefined} onValueChange={setSelectedSeason}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
              <h2 className="text-xl md:text-3xl font-heading font-bold flex items-center gap-3">
                <span className="w-1.5 h-6 md:h-8 bg-primary rounded-full" />
                Episodes
              </h2>
              {seasons.length > 0 && (
                <Select value={selectedSeason || undefined} onValueChange={setSelectedSeason}>
                  <SelectTrigger className="w-[240px] bg-secondary/50">
                    <SelectValue placeholder="Select Season">
                      {(() => {
                        const s = seasons.find((x) => x.id === selectedSeason);
                        if (!s) return null;
                        const label = s.title || `Season ${s.season_number}`;
                        const count = s.id === selectedSeason ? episodes.length : null;
                        return (
                          <span className="flex items-center gap-2">
                            <span className="truncate">{label}</span>
                            {count != null && (
                              <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                                {count} EP
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((season) => (
                      <SelectItem key={season.id} value={season.id}>
                        <span className="flex items-center gap-2">
                          <span>{season.title || `Season ${season.season_number}`}</span>
                          {anime.total_episodes != null && season.id === seasons[0]?.id && seasons.length === 1 && (
                            <span className="text-[10px] font-semibold text-primary">· {anime.total_episodes} EP</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {seasons.map((season) => (
              <TabsContent key={season.id} value={season.id} className="mt-0">
                {episodes.length === 0 ? (
                  <div className="text-center py-16 bg-card/50 rounded-2xl border border-border/30">
                    <Clock className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground text-lg">No episodes available yet.</p>
                    <p className="text-muted-foreground/70 text-sm mt-2">Check back soon for new episodes!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {episodes.map((episode, index) => {
                      const progress = getEpisodeProgress(episode.id);
                      const completed = isEpisodeCompleted(episode.id);
                      
                      return (
                        <Link
                          key={episode.id}
                          to={`/watch/${episode.id}`}
                          className="episode-card group animate-fade-in"
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          {/* Thumbnail */}
                          <div className="relative aspect-video overflow-hidden rounded-t-lg">
                            <img
                              src={episode.thumbnail || anime.cover_image || '/placeholder.svg'}
                              alt={episode.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              loading="lazy"
                            />
                            
                            {/* Play overlay */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300">
                              <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300">
                                <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                              </div>
                            </div>
                            
                            {/* 4K Badge */}
                            <div className="absolute bottom-1 right-1 z-10">
                              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg">4K</span>
                            </div>
                            
                            {/* Duration badge */}
                            {episode.duration && (
                              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] font-medium bg-black/80 text-white rounded backdrop-blur-sm">
                                {formatDuration(episode.duration)}
                              </span>
                            )}
                            
                            {/* Completed badge */}
                            {completed && (
                              <div className="absolute top-1 right-1 p-1 bg-green-500/90 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              </div>
                            )}
                            
                            {/* Mark as Watched button */}
                            <button
                              onClick={(e) => markAsWatched(episode.id, e)}
                              className="absolute top-1 left-1 p-1 bg-black/70 hover:bg-black/90 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 z-10"
                              title={completed ? 'Mark as unwatched' : 'Mark as watched'}
                            >
                              {completed ? (
                                <EyeOff className="w-3 h-3 text-white" />
                              ) : (
                                <Eye className="w-3 h-3 text-white" />
                              )}
                            </button>
                            
                            {/* Progress bar */}
                            {progress > 0 && !completed && (
                              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/50">
                                <div 
                                  className="h-full bg-primary transition-all duration-300"
                                  style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                          
                          {/* Info */}
                          <div className="p-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                EP {episode.episode_number}
                              </span>
                              {progress > 0 && !completed && (
                                <span className="text-[10px] text-muted-foreground">
                                  {Math.round(progress)}%
                                </span>
                              )}
                            </div>
                            <h3 className="font-medium text-xs line-clamp-1 group-hover:text-primary transition-colors">
                              {episode.title}
                            </h3>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-12 md:mt-20 relative">
            {/* Section header */}
            <div className="flex items-end justify-between mb-5 md:mb-8 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-[10px] md:text-xs font-bold uppercase tracking-wider text-primary">
                    <Sparkles className="h-3 w-3" />
                    For You
                  </span>
                </div>
                <h2 className="text-xl md:text-4xl font-heading font-bold flex items-center gap-3 leading-tight">
                  <span className="w-1 md:w-1.5 h-6 md:h-9 bg-gradient-to-b from-primary via-accent to-primary rounded-full" />
                  You Might Also Like
                </h2>
                <p className="text-xs md:text-sm text-muted-foreground pl-3 md:pl-4">
                  Hand-picked anime based on this title's vibe
                </p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-card/40 border border-border/40 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                {recommendations.length} picks
              </span>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 md:gap-5">
              {recommendations.map((rec, index) => (
                <Link
                  key={rec.id}
                  to={`/anime/${rec.id}`}
                  className="group relative animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg md:rounded-2xl bg-card/60 border border-border/40 shadow-lg shadow-black/20 transition-all duration-500 group-hover:border-primary/60 group-hover:shadow-primary/20 group-hover:-translate-y-1">
                    {/* Rank badge */}
                    <div className="absolute top-1.5 left-1.5 md:top-2.5 md:left-2.5 z-20 w-6 h-6 md:w-8 md:h-8 rounded-md md:rounded-lg bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center text-[10px] md:text-xs font-black text-white shadow-lg">
                      #{index + 1}
                    </div>

                    {/* Cover */}
                    <img
                      src={rec.cover_image || '/placeholder.svg'}
                      alt={rec.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                    />

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* Bottom info */}
                    <div className="absolute inset-x-0 bottom-0 p-2 md:p-3 space-y-1">
                      <h3 className="font-bold text-[11px] md:text-sm leading-tight line-clamp-2 text-white drop-shadow-lg group-hover:text-primary transition-colors">
                        {rec.title}
                      </h3>
                      {rec.release_year && (
                        <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-white/70">
                          <CalendarClock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          <span>{rec.release_year}</span>
                        </div>
                      )}
                    </div>

                    {/* Hover play button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-primary/95 flex items-center justify-center shadow-xl shadow-primary/50 scale-90 group-hover:scale-100 transition-transform">
                        <Play className="h-4 w-4 md:h-6 md:w-6 text-white fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <AnimeReviews animeId={anime.id} />
      </div>
    </div>
  );
}
