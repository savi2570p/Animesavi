import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Play, ChevronRight, Clock, Sparkles, Check, User } from 'lucide-react';
import crunchyrollLogo from '@/assets/crunchyroll-logo.png';
import { toast } from 'sonner';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
}

interface Season {
  id: string;
  season_number: number;
}

interface Episode {
  id: string;
  title: string;
  episode_number: number;
  duration: number | null;
  season_id: string;
  thumbnail: string | null;
}

interface WatchHistoryItem {
  id: string;
  anime: Anime;
  episode: Episode;
  progress: number | null;
  watched_at: string;
  season?: Season;
}

interface ContinueWatchingProps {
  showOnHomeOnly?: boolean;
}

export function ContinueWatching({ showOnHomeOnly = false }: ContinueWatchingProps) {
  const { user } = useAuth();
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ username: string | null; avatar_url: string | null } | null>(null);
  

  // Only show on home page if specified
  const isHomePage = typeof window !== 'undefined' && window.location.pathname === '/';
  const shouldRender = showOnHomeOnly ? isHomePage : true;

  useEffect(() => {
    if (user && shouldRender) {
      fetchRecentHistory();
      fetchUserProfile();
    } else {
      setIsLoading(false);
    }
  }, [user, shouldRender]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();
    if (data) setUserProfile(data);
  };

  const fetchRecentHistory = async () => {
    setIsLoading(true);
    // Now we have ONE entry per anime per user (unique constraint enforced)
    // No need for client-side deduplication
    const { data } = await supabase
      .from('watch_history')
      .select('*, anime:anime_id(*), episode:episode_id(*)')
      .eq('user_id', user!.id)
      .eq('completed', false)
      .order('watched_at', { ascending: false })
      .limit(12);

    if (data) {
      // Fetch season info for each episode
      const itemsWithSeason = await Promise.all(
        (data as WatchHistoryItem[]).map(async (item) => {
          if (item.episode?.season_id) {
            const { data: seasonData } = await supabase
              .from('seasons')
              .select('id, season_number')
              .eq('id', item.episode.season_id)
              .single();
            return { ...item, season: seasonData || undefined };
          }
          return item;
        })
      );
      
      setHistory(itemsWithSeason);
    }
    setIsLoading(false);
  };

  const handleMarkCompleted = async (e: React.MouseEvent, historyId: string, animeTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { error } = await supabase
      .from('watch_history')
      .update({ completed: true })
      .eq('id', historyId);
    
    if (error) {
      toast.error('Failed to mark as completed');
      return;
    }
    
    // Remove from local state immediately
    setHistory(prev => prev.filter(item => item.id !== historyId));
    toast.success(`${animeTitle} marked as completed`);
  };

  const formatTimeLeft = (progress: number | null, duration: number | null) => {
    if (!progress || !duration) return null;
    const remaining = Math.max(0, duration - (duration * progress / 100));
    const minutes = Math.floor(remaining / 60);
    return `${minutes}m left`;
  };

  if (!user || !shouldRender || (!isLoading && history.length === 0)) return null;

  if (isLoading) {
    return (
      <section className="py-10 md:py-14">
        <div className="container">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-8 w-8 bg-primary/20 rounded-lg animate-pulse" />
            <div className="h-8 w-56 bg-muted animate-pulse rounded-lg" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-video bg-muted animate-pulse rounded-xl skeleton-shimmer" />
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 md:py-14 relative overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      
      <div className="container relative">
        {/* Crunchy Tab Link */}
        <div className="mb-4">
          <Link
            to="/crunchy"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border bg-card/50 text-muted-foreground border-border/50 hover:bg-primary/10 hover:border-primary/50 hover:text-primary"
          >
            <img
              src={crunchyrollLogo}
              alt="Crunchy"
              className="h-5 w-auto object-contain"
            />
            Crunchy
          </Link>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {/* User Profile Avatar */}
            <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-primary/30">
              <AvatarImage src={userProfile?.avatar_url || undefined} alt={userProfile?.username || 'User'} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {userProfile?.username?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>
            <div className="relative">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Sparkles className="h-3 w-3 text-primary animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-heading font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Continue Watching
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Pick up where you left off</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            asChild 
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300 group"
          >
            <Link to="/history" className="flex items-center gap-1">
              View all 
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        <Carousel
          opts={{
            align: "start",
            loop: false,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {history.map((item, index) => (
              <CarouselItem key={item.id} className="pl-2 md:pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/6">
                <Link
                  to={`/watch/${item.episode.id}?t=${item.progress || 0}`}
                  className="group relative block"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="anime-card opacity-0 animate-fade-in">
                    {/* Thumbnail container */}
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-muted/50 border border-border/50 group-hover:border-primary/50 transition-all duration-500">
                      <img
                        src={item.episode.thumbnail || item.anime.cover_image || '/placeholder.svg'}
                        alt={item.anime.title}
                        className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110"
                        loading="lazy"
                      />
                      
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
                      
                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="relative">
                          <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl scale-150 animate-pulse" />
                          <div className="relative w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/50 transform group-hover:scale-110 transition-transform duration-300">
                            <Play className="h-5 w-5 text-primary-foreground fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Season & Episode badge */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-primary/90 text-[10px] font-bold text-primary-foreground">
                        S{item.season?.season_number || 1} E{item.episode.episode_number}
                      </div>

                      {/* Progress percentage badge */}
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-medium text-white/90">
                        {Math.round(item.progress || 0)}%
                      </div>

                      {/* Mark as Completed button */}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute bottom-3 right-2 h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-medium z-10"
                        onClick={(e) => handleMarkCompleted(e, item.id, item.anime.title)}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Done
                      </Button>

                      {/* Premium progress bar */}
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 backdrop-blur-sm">
                        <div className="relative h-full overflow-hidden">
                          <div className="absolute inset-0 bg-white/10" />
                          <div 
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-primary/80 transition-all duration-500 ease-out"
                            style={{ width: `${Math.min(item.progress || 0, 100)}%` }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shine" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Title and info below card */}
                    <div className="mt-2 px-1">
                      <h3 className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {item.anime.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Episode {item.episode.episode_number}
                        {formatTimeLeft(item.progress, item.episode.duration) && (
                          <span className="ml-2 text-primary/80">
                            • {formatTimeLeft(item.progress, item.episode.duration)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-4 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-primary/10 hover:border-primary/50" />
          <CarouselNext className="hidden md:flex -right-4 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-primary/10 hover:border-primary/50" />
        </Carousel>
      </div>
    </section>
  );
}
