import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
  const [isLoading, setIsLoading] = useState(true);
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

  const fetchAnimeDetails = async () => {
    setIsLoading(true);
    
    const { data: animeData, error: animeError } = await supabase
      .from('anime_public')
      .select('*')
      .eq('id', id)
      .single();

    if (animeError || !animeData) {
      toast.error('Failed to load anime details');
      setIsLoading(false);
      return;
    }

    setAnime(animeData);

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
      <div className="min-h-screen">
        <div className="h-[60vh] skeleton-shimmer" />
        <div className="container py-8">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-24 w-full mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-xl" />
            ))}
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
    <div className="min-h-screen">
      {/* Hero Banner */}
      <div className="relative h-[70vh] md:h-[80vh] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center scale-105 animate-[float_20s_ease-in-out_infinite]"
          style={{
            backgroundImage: `url(${anime.banner_image || anime.cover_image || '/placeholder.svg'})`,
          }}
        />
        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-transparent h-32" />
        
        {/* Floating particles effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary/30 rounded-full animate-float" />
          <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-primary/20 rounded-full animate-float animation-delay-200" />
          <div className="absolute bottom-1/3 left-1/2 w-2 h-2 bg-accent/30 rounded-full animate-float animation-delay-400" />
        </div>
      </div>

      {/* Content */}
      <div className="container relative -mt-[45vh] md:-mt-[50vh] z-10 pb-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Poster - Right-click to save on PC, long-press on mobile */}
          <div className="flex-shrink-0 animate-fade-in">
            <div 
              className="relative group"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
            >
              <img
                src={anime.cover_image || '/placeholder.svg'}
                alt={anime.title}
                className="w-48 md:w-72 rounded-2xl shadow-2xl border border-border/30 transition-transform duration-500 group-hover:scale-[1.02] cursor-pointer"
                onContextMenu={(e) => {
                  // Allow default right-click behavior on desktop for native save
                }}
              />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              {/* Quick play button on poster */}
              {nextEpisode && (
                <Link 
                  to={`/watch/${nextEpisode.id}`}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                    <Play className="w-7 h-7 text-white fill-current ml-1" />
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-5 animate-fade-in-up">
            {/* Genres */}
            <div className="flex flex-wrap gap-2">
              {anime.genres?.map((genre, i) => (
                <Badge 
                  key={genre} 
                  className="genre-badge animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {genre}
                </Badge>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-6xl font-heading font-bold leading-tight text-shadow-lg">
              {anime.title}
            </h1>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              {anime.release_year && (
                <span className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1.5 rounded-lg">
                  <Calendar className="h-4 w-4" />
                  {anime.release_year}
                </span>
              )}
              {anime.type && (
                <Badge variant="outline" className="capitalize px-3 py-1.5">
                  {anime.type}
                </Badge>
              )}
              {anime.status && (
                <Badge className={cn(
                  "px-3 py-1.5",
                  anime.status === 'ongoing' 
                    ? 'bg-anime-orange text-white' 
                    : 'bg-primary text-primary-foreground'
                )}>
                  <Sparkles className="w-3 h-3 mr-1" />
                  {anime.status}
                </Badge>
              )}
            </div>

            {/* Description */}
            <p className="text-foreground/80 leading-relaxed text-lg max-w-3xl">
              {anime.description}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 pt-4">
              {nextEpisode && (
                <Button asChild size="lg" className="anime-button h-14 px-8 text-lg">
                  <Link to={`/watch/${nextEpisode.id}`}>
                    <Play className="h-5 w-5 mr-2 fill-current" />
                    {watchProgress.size > 0 ? 'Continue Watching' : 'Start Watching'}
                  </Link>
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                onClick={toggleFavorite}
                className={cn(
                  "h-14 px-6 border-2 transition-all duration-300",
                  isFavorite 
                    ? 'text-anime-pink border-anime-pink bg-anime-pink/10 hover:bg-anime-pink/20' 
                    : 'hover:border-anime-pink hover:text-anime-pink'
                )}
              >
                <Heart className={cn("h-5 w-5 mr-2", isFavorite && 'fill-current')} />
                {isFavorite ? 'In Favorites' : 'Add to Favorites'}
              </Button>
              <ShareEmbedPopup
                type="series"
                pageUrl={window.location.pathname}
                animeTitle={anime.title}
                size="lg"
                className="h-14 px-6 border-2"
              />
              
              {/* Batch Download Button */}
              {episodes.length > 0 && (
                <BatchDownload episodes={episodes} animeTitle={anime.title} />
              )}
            </div>
          </div>
        </div>

        {/* Episodes Section */}
        <div className="mt-16">
          <Tabs value={selectedSeason || undefined} onValueChange={setSelectedSeason}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <h2 className="text-3xl font-heading font-bold flex items-center gap-3">
                <span className="w-1.5 h-8 bg-primary rounded-full" />
                Episodes
              </h2>
              {seasons.length > 0 && (
                <TabsList className="bg-secondary/50 p-1.5 rounded-xl">
                  {seasons.map((season) => (
                    <TabsTrigger 
                      key={season.id} 
                      value={season.id}
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2"
                    >
                      <span className="hidden md:inline">{season.title || `Season ${season.season_number}`}</span>
                      <span className="md:hidden">S{season.season_number}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {episodes.map((episode, index) => {
                      const progress = getEpisodeProgress(episode.id);
                      const completed = isEpisodeCompleted(episode.id);
                      
                      return (
                        <Link
                          key={episode.id}
                          to={`/watch/${episode.id}`}
                          className="episode-card group animate-fade-in"
                          style={{ animationDelay: `${index * 50}ms` }}
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
                              <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300">
                                <Play className="w-6 h-6 text-white fill-current ml-0.5" />
                              </div>
                            </div>
                            
                            {/* Duration badge */}
                            {episode.duration && (
                              <span className="absolute bottom-2 right-2 px-2 py-1 text-xs font-medium bg-black/80 text-white rounded-md backdrop-blur-sm">
                                {formatDuration(episode.duration)}
                              </span>
                            )}
                            
                            {/* Completed badge */}
                            {completed && (
                              <div className="absolute top-2 right-2 p-1.5 bg-green-500/90 rounded-full">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              </div>
                            )}
                            
                            {/* Mark as Watched button */}
                            <button
                              onClick={(e) => markAsWatched(episode.id, e)}
                              className="absolute top-2 left-2 p-1.5 bg-black/70 hover:bg-black/90 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 z-10"
                              title={completed ? 'Mark as unwatched' : 'Mark as watched'}
                            >
                              {completed ? (
                                <EyeOff className="w-4 h-4 text-white" />
                              ) : (
                                <Eye className="w-4 h-4 text-white" />
                              )}
                            </button>
                            
                            {/* Progress bar */}
                            {progress > 0 && !completed && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                                <div 
                                  className="h-full bg-primary transition-all duration-300"
                                  style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                          
                          {/* Info */}
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                S{seasons.find(s => s.id === selectedSeason)?.season_number || 1} [EP {episode.episode_number}]
                              </span>
                              {progress > 0 && !completed && (
                                <span className="text-xs text-muted-foreground">
                                  {Math.round(progress)}% watched
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
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
          <div className="mt-16">
            <h2 className="text-3xl font-heading font-bold mb-8 flex items-center gap-3">
              <span className="w-1.5 h-8 bg-accent rounded-full" />
              You Might Also Like
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
              {recommendations.map((rec, index) => (
                <Link 
                  key={rec.id} 
                  to={`/anime/${rec.id}`} 
                  className="browse-card animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="aspect-[3/4] relative overflow-hidden rounded-t-xl">
                    <img
                      src={rec.cover_image || '/placeholder.svg'}
                      alt={rec.title}
                      className="browse-card-image"
                      loading="lazy"
                    />
                    <div className="browse-card-overlay" />
                    <div className="browse-card-content">
                      <Button size="sm" className="anime-button w-full">
                        <Play className="h-4 w-4 mr-2 fill-current" />
                        Watch
                      </Button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                      {rec.title}
                    </h3>
                    {rec.release_year && (
                      <p className="text-xs text-muted-foreground mt-1">{rec.release_year}</p>
                    )}
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
