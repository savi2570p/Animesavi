import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isIOSDevice } from '@/lib/deviceUtils';
import { preloadImages } from '@/lib/imageOptimization';
import { BatchDownload } from '@/components/download/BatchDownload';
import { AnimeReviews } from '@/components/anime/AnimeReviews';
import { AnimeDetailLoader } from '@/components/anime/AnimeDetailLoader';
import { MoreInfoDrawer } from '@/components/anime/MoreInfoDrawer';
import { EpisodeGrid } from '@/components/anime/EpisodeGrid';
import { ShareEmbedPopup } from '@/components/ShareEmbedPopup';
import { SEO } from '@/components/SEO';
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
  ArrowLeft,
} from 'lucide-react';
import { DubBadge } from '@/components/anime/DubBadge';

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
  const navigate = useNavigate();
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

  // Fetch anime details only when id changes — NOT when user resolves.
  // Previously this depended on [id, user] which restarted the loader the
  // moment the auth context hydrated, causing the visible "loading restart".
  useEffect(() => {
    if (id) fetchAnimeDetails();
  }, [id]);

  // User-scoped data is fetched independently so it never interrupts the page.
  useEffect(() => {
    if (id && user) {
      checkFavorite();
      fetchWatchProgress();
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
      supabase.from('anime').select('studio, total_episodes, is_eng_dub, is_sub_only').eq('id', id).maybeSingle(),
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
      is_eng_dub: (extrasRes.data as any)?.is_eng_dub ?? false,
      is_sub_only: (extrasRes.data as any)?.is_sub_only ?? false,
    } as any;
    setAnime(merged);
    // Preload cover and banner for instant display
    preloadImages([animeData.cover_image, animeData.banner_image]);

    // Replace URL with slug-based URL for clean sharing.
    // Only rewrite when we are still on this anime's own /anime/:id route —
    // otherwise a rewrite can race a navigation the user just triggered
    // (e.g. picking a different search suggestion) and bounce them home.
    if (animeData.title && window.location.pathname === `/anime/${id}`) {
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
    setSeasonLoading(true);
    setEpisodes([]);
    try {
      const { data } = await supabase
        .from('episodes')
        .select('*')
        .eq('season_id', seasonId)
        .order('episode_number');

      if (data) {
        setEpisodes(data);
        preloadImages(data.slice(0, 8).map(ep => ep.thumbnail));
      }
    } finally {
      // Small min-delay so the skeleton is perceptible even on fast networks
      setTimeout(() => setSeasonLoading(false), 250);
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
    if (!user) return;
    const { data } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', user.id)
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
    const episodeDuration = episodes.find((episode) => episode.id === episodeId)?.duration || 0;
    const now = new Date().toISOString();
    
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
          completed_at: !isCompleted ? now : null,
          last_position: !isCompleted ? episodeDuration : 0,
          duration: episodeDuration,
          watched_at: now,
        })
        .eq('id', existing.id);
    } else {
      // Insert new
      await supabase
        .from('watch_history')
        .insert({
          user_id: user.id,
          episode_id: episodeId,
          anime_id: id,
          completed: true,
          progress: 100,
          completed_at: now,
          last_position: episodeDuration,
          duration: episodeDuration,
          watched_at: now,
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
    return <AnimeDetailLoader isReady={false} title="Loading anime details" />;
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

  const seoDesc = (anime.description || `Watch ${anime.title} in Hindi DUB on AnimeSavi.`).replace(/<[^>]+>/g, '').slice(0, 160);
  const seoTitle = `${anime.title} — Watch in Hindi DUB | AnimeSavi`;
  const seriesLd = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: anime.title,
    description: seoDesc,
    image: anime.cover_image || anime.banner_image || undefined,
    genre: (anime as any).genres || undefined,
    url: `https://animesavi.com/anime/${anime.id}`,
  };

  return (
    <div className="min-h-screen detail-fade-swap">
      <SEO
        title={seoTitle}
        description={seoDesc}
        path={`/anime/${anime.id}`}
        image={anime.cover_image || anime.banner_image || undefined}
        type="video.tv_show"
        jsonLd={seriesLd}
      />
      <section className="detail-v3-hero relative isolate">
        <img src={anime.banner_image || anime.cover_image || '/placeholder.svg'} alt={anime.title} className="absolute inset-0 w-full h-full object-cover" decoding="async" fetchPriority="high" />
        <div className="detail-v3-scrim absolute inset-0 pointer-events-none" />
        <div className="container relative pt-4 pb-8 md:pb-12 h-full flex flex-col justify-between">
          <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')} className="hero-v3-glass rounded-full h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex items-end gap-5 md:gap-8 mt-8">
            <div className="hidden md:block shrink-0" onTouchStart={isIOSDevice() ? undefined : handleTouchStart} onTouchEnd={isIOSDevice() ? undefined : handleTouchEnd} onTouchMove={isIOSDevice() ? undefined : handleTouchMove}>
              <img src={anime.cover_image || '/placeholder.svg'} alt={`${anime.title} poster`} className="w-40 lg:w-48 aspect-[2/3] object-contain rounded-lg border border-border" draggable={isIOSDevice()} />
            </div>
            <div className="min-w-0 max-w-3xl">
              <div className="flex items-center gap-2 flex-wrap mb-3"><DubBadge size="md" isEngDub={(anime as any).is_eng_dub} isSubOnly={(anime as any).is_sub_only} genres={anime.genres} />{anime.status && <span className={anime.status === 'ongoing' ? 'badge-glass-og' : 'badge-glass-com'}>{anime.status === 'ongoing' ? 'OG' : anime.status === 'completed' ? 'COM' : anime.status}</span>}{anime.type && <span className="text-xs text-foreground/80 capitalize">{anime.type}</span>}</div>
              <h1 className="font-heading font-extrabold text-2xl md:text-4xl lg:text-5xl leading-tight break-words">{anime.title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/75 mt-3">{anime.release_year && <span>{anime.release_year}</span>}{anime.total_episodes != null && <span>{anime.total_episodes} episodes</span>}{anime.studio && <span>{anime.studio}</span>}{anime.like_count != null && anime.like_count > 0 && <span className="flex gap-1 items-center"><Heart className="h-3 w-3" />{anime.like_count}</span>}</div>
              <div className="detail-v3-actions flex flex-wrap gap-2 mt-5">
                {nextEpisode && <Button asChild className="gap-2"><Link to={`/watch/${nextEpisode.id}`}><Play className="h-4 w-4 fill-current" />{watchProgress.size > 0 ? 'Continue' : 'Watch Now'}</Link></Button>}
                <Button variant="outline" size="icon" aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'} title={isFavorite ? 'Remove favorite' : 'Add favorite'} onClick={toggleFavorite} className={cn('hero-v3-glass',isFavorite && 'text-primary')}><Heart className={cn('h-4 w-4',isFavorite && 'fill-current')} /></Button>
                {nextEpisode && <Button variant="outline" size="icon" aria-label={isInWatchList ? 'Remove from Watch List' : 'Add to Watch List'} title="Watch List" onClick={toggleWatchList} className={cn('hero-v3-glass',isInWatchList && 'text-primary')}><ListVideo className="h-4 w-4" /></Button>}
                <ShareEmbedPopup type="series" pageUrl={`/${createSlug(anime.title)}`} animeTitle={anime.title} className="hero-v3-glass h-10" />
                <MoreInfoDrawer anime={anime as any} totalSeasons={seasons.length} totalAvailableEpisodes={anime.total_episodes ?? episodes.length} />
                {episodes.length > 0 && <BatchDownload episodes={episodes} animeTitle={anime.title} />}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="border-b border-border"><div className="container py-6 md:py-8 grid md:grid-cols-[1fr_260px] gap-5 md:gap-10">
        <div><h2 className="text-sm font-semibold mb-3">Story</h2><p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{anime.description}</p></div>
        <div className="flex flex-wrap gap-1.5 content-start">{anime.genres?.map(genre => <Badge key={genre} variant="outline" className="catalogue-chip rounded text-[10px] font-medium">{genre}</Badge>)}</div>
      </div></section>
      <div className="container py-6 md:py-9">
        <section aria-label="Episode library">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5"><div><span className="text-[10px] text-muted-foreground uppercase">{episodes.length} available</span><h2 className="font-heading text-xl md:text-2xl font-semibold mt-1">Episodes</h2></div>
            {seasons.length > 0 && <Select value={selectedSeason || undefined} onValueChange={setSelectedSeason}><SelectTrigger className="catalogue-glass w-[210px] max-w-full"><SelectValue placeholder="Season" /></SelectTrigger><SelectContent>{seasons.map(season => <SelectItem key={season.id} value={season.id}>{season.title || `Season ${season.season_number}`}</SelectItem>)}</SelectContent></Select>}
          </div>
          {seasonLoading ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({length:8},(_,i)=><Skeleton key={i} className="aspect-video rounded-lg" />)}</div> : episodes.length === 0 ? <div className="py-14 text-center border-y border-border"><Clock className="h-7 w-7 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">No episodes available yet.</p></div> : <div className="detail-v3-episodes"><EpisodeGrid episodes={episodes} fallbackImage={anime.banner_image || anime.cover_image} getProgress={getEpisodeProgress} isCompleted={isEpisodeCompleted} onToggleWatched={(episodeId,e) => markAsWatched(episodeId,e)} /></div>}
        </section>
        {recommendations.length > 0 && <section className="mt-9 md:mt-12" aria-label="You Might Also Like"><h2 className="font-heading text-xl md:text-2xl font-semibold mb-5">You Might Also Like</h2><div className="snap-row flex gap-3 overflow-x-auto pb-3">
          {recommendations.map(rec => <Link key={rec.id} to={`/anime/${rec.id}`} className="catalogue-glass rounded-lg overflow-hidden w-[120px] shrink-0"><div className="relative h-[180px]"><img src={rec.cover_image || '/placeholder.svg'} alt={rec.title} className="w-full h-full object-contain" loading="lazy" /><div className="absolute left-1.5 top-1.5"><DubBadge isEngDub={(rec as any).is_eng_dub} isSubOnly={(rec as any).is_sub_only} genres={rec.genres} /></div></div><h3 className="text-xs font-semibold line-clamp-2 min-h-10 p-2">{rec.title}</h3></Link>)}
        </div></section>}
        <AnimeReviews animeId={anime.id} />
      </div>
    </div>
  );
}
