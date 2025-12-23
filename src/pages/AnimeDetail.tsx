import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Play,
  Heart,
  Share2,
  Calendar,
  Clock,
  Star,
  ChevronRight,
  BookmarkPlus,
  Eye,
} from 'lucide-react';

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

  useEffect(() => {
    if (id) {
      fetchAnimeDetails();
      if (user) {
        checkFavorite();
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
    
    // Use anime_public view to avoid exposing uploader_id
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

    // Fetch seasons
    const { data: seasonsData } = await supabase
      .from('seasons')
      .select('*')
      .eq('anime_id', id)
      .order('season_number');

    if (seasonsData && seasonsData.length > 0) {
      setSeasons(seasonsData);
      setSelectedSeason(seasonsData[0].id);
    }

    // Fetch recommendations based on genres
    if (animeData.genres && animeData.genres.length > 0) {
      // Use anime_public view to avoid exposing uploader_id
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

    // Increment view count
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

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Skeleton className="h-[50vh] w-full" />
        <div className="container py-8">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-24 w-full mb-8" />
          <div className="grid gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Anime not found</h1>
        <Button asChild>
          <Link to="/browse">Browse Anime</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <div className="relative h-[50vh] md:h-[60vh]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${anime.banner_image || anime.cover_image || '/placeholder.svg'})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="container relative -mt-64 z-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Poster */}
          <div className="flex-shrink-0">
            <img
              src={anime.cover_image || '/placeholder.svg'}
              alt={anime.title}
              className="w-48 md:w-64 rounded-xl shadow-2xl"
            />
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap gap-2">
              {anime.genres?.map((genre) => (
                <Badge key={genre} variant="secondary" className="genre-badge">
                  {genre}
                </Badge>
              ))}
            </div>

            <h1 className="text-3xl md:text-5xl font-heading font-bold">
              {anime.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              {anime.release_year && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {anime.release_year}
                </span>
              )}
              {anime.type && (
                <Badge variant="outline" className="capitalize">
                  {anime.type}
                </Badge>
              )}
              {anime.status && (
                <Badge className={anime.status === 'ongoing' ? 'bg-anime-orange' : 'bg-primary'}>
                  {anime.status}
                </Badge>
              )}
              {anime.view_count !== null && (
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {anime.view_count.toLocaleString()} views
                </span>
              )}
            </div>

            <p className="text-muted-foreground leading-relaxed max-w-3xl">
              {anime.description}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4">
              {episodes.length > 0 && (
                <Button asChild size="lg" className="anime-button">
                  <Link to={`/watch/${episodes[0].id}`}>
                    <Play className="h-5 w-5 mr-2 fill-current" />
                    Watch Now
                  </Link>
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                onClick={toggleFavorite}
                className={isFavorite ? 'text-anime-pink border-anime-pink' : ''}
              >
                <Heart className={`h-5 w-5 mr-2 ${isFavorite ? 'fill-current' : ''}`} />
                {isFavorite ? 'In Favorites' : 'Add to Favorites'}
              </Button>
              <Button size="lg" variant="outline">
                <Share2 className="h-5 w-5 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>

        {/* Episodes */}
        <div className="mt-12">
          <Tabs value={selectedSeason || undefined} onValueChange={setSelectedSeason}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-heading font-bold">Episodes</h2>
              {seasons.length > 1 && (
                <TabsList>
                  {seasons.map((season) => (
                    <TabsTrigger key={season.id} value={season.id}>
                      {season.title || `Season ${season.season_number}`}
                    </TabsTrigger>
                  ))}
                </TabsList>
              )}
            </div>

            {seasons.map((season) => (
              <TabsContent key={season.id} value={season.id}>
                {episodes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No episodes available yet.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {episodes.map((episode) => (
                      <Link
                        key={episode.id}
                        to={`/watch/${episode.id}`}
                        className="anime-card flex gap-4 p-4 hover:bg-muted/50 transition-colors group"
                      >
                        <div className="relative flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden bg-muted">
                          <img
                            src={episode.thumbnail || anime.cover_image || '/placeholder.svg'}
                            alt={episode.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="h-8 w-8 text-white fill-current" />
                          </div>
                          {episode.duration && (
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 text-xs bg-black/80 rounded">
                              {formatDuration(episode.duration)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-muted-foreground">
                              Episode {episode.episode_number}
                            </span>
                          </div>
                          <h3 className="font-semibold group-hover:text-primary transition-colors">
                            {episode.title}
                          </h3>
                          {episode.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {episode.description}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground self-center" />
                      </Link>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-12 pb-12">
            <h2 className="text-2xl font-heading font-bold mb-6">
              You Might Also Like
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {recommendations.map((rec) => (
                <Link key={rec.id} to={`/anime/${rec.id}`} className="anime-card group">
                  <div className="aspect-[3/4] relative overflow-hidden rounded-xl">
                    <img
                      src={rec.cover_image || '/placeholder.svg'}
                      alt={rec.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold line-clamp-2 text-sm group-hover:text-primary transition-colors">
                      {rec.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
