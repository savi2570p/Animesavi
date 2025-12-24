import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Play, Star, Eye, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const ALLOWED_GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports'] as const;
const MAX_SEARCH_LENGTH = 100;

type SortOption = 'newest' | 'popular' | 'trending';

interface Anime {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  genres: string[];
  release_year: number | null;
  status: string | null;
  view_count: number | null;
}

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedGenre, setSelectedGenre] = useState(searchParams.get('genre') || '');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    fetchAnime();
  }, [searchParams, sortBy]);

  const fetchAnime = async () => {
    setIsLoading(true);
    let query = supabase.from('anime_public').select('*');

    // Apply sorting
    switch (sortBy) {
      case 'popular':
        query = query.order('view_count', { ascending: false, nullsFirst: false });
        break;
      case 'trending':
        query = query.order('like_count', { ascending: false, nullsFirst: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    const q = searchParams.get('q');
    const genre = searchParams.get('genre');

    if (q) {
      const sanitizedQuery = q.slice(0, MAX_SEARCH_LENGTH).trim();
      if (sanitizedQuery) {
        query = query.ilike('title', `%${sanitizedQuery}%`);
      }
    }

    if (genre) {
      const normalizedGenre = genre.charAt(0).toUpperCase() + genre.slice(1).toLowerCase();
      const isValidGenre = ALLOWED_GENRES.some(g => g.toLowerCase() === genre.toLowerCase());
      if (isValidGenre) {
        query = query.contains('genres', [normalizedGenre]);
      }
    }

    const { data, error } = await query;

    if (!error && data) {
      setAnimeList(data);
    }
    setIsLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchQuery) {
      params.set('q', searchQuery);
    } else {
      params.delete('q');
    }
    setSearchParams(params);
  };

  const handleGenreFilter = (genre: string) => {
    const params = new URLSearchParams(searchParams);
    if (selectedGenre === genre.toLowerCase()) {
      params.delete('genre');
      setSelectedGenre('');
    } else {
      params.set('genre', genre.toLowerCase());
      setSelectedGenre(genre.toLowerCase());
    }
    setSearchParams(params);
  };

  const sortOptions = [
    { value: 'newest' as const, label: 'New Releases', icon: Clock },
    { value: 'popular' as const, label: 'Most Popular', icon: TrendingUp },
    { value: 'trending' as const, label: 'Trending', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero header */}
      <div className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="container relative">
          <h1 className="text-5xl md:text-6xl font-heading font-bold mb-4 animate-fade-in">
            Browse <span className="anime-gradient-text">Anime</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl animate-fade-in animation-delay-100">
            Discover your next favorite series from our extensive collection
          </p>
        </div>
      </div>

      <div className="container pb-12">
        {/* Search & Filters */}
        <div className="mb-10 space-y-6">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl animate-fade-in-up stagger-1">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for anime..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 bg-card/50 border-border/50 rounded-xl text-base focus:border-primary/50 focus:bg-card transition-all"
              />
            </div>
            <Button type="submit" className="anime-button h-14 px-8 rounded-xl">
              <Search className="h-5 w-5 mr-2" />
              Search
            </Button>
          </form>

          {/* Sort options */}
          <div className="flex flex-wrap items-center gap-3 animate-fade-in-up stagger-2">
            <span className="text-sm text-muted-foreground font-medium">Sort by:</span>
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value)}
                className={cn("filter-btn flex items-center gap-2", sortBy === option.value && "active")}
              >
                <option.icon className="h-4 w-4" />
                {option.label}
              </button>
            ))}
          </div>

          {/* Genre filters */}
          <div className="flex flex-wrap items-center gap-3 animate-fade-in-up stagger-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <Filter className="h-4 w-4" />
              Genres:
            </div>
            {ALLOWED_GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => handleGenreFilter(genre)}
                className={cn("filter-btn", selectedGenre === genre.toLowerCase() && "active")}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        {!isLoading && (
          <div className="mb-6 text-muted-foreground animate-fade-in">
            Found <span className="text-foreground font-semibold">{animeList.length}</span> anime
            {selectedGenre && <span> in <span className="text-primary font-medium capitalize">{selectedGenre}</span></span>}
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl skeleton-shimmer" />
            ))}
          </div>
        ) : animeList.length === 0 ? (
          <div className="text-center py-24 animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold mb-2">No anime found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {animeList.map((anime, index) => (
              <Link 
                key={anime.id} 
                to={`/anime/${anime.id}`} 
                className="browse-card animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="aspect-[3/4] relative overflow-hidden rounded-t-xl">
                  <img
                    src={anime.cover_image || '/placeholder.svg'}
                    alt={anime.title}
                    className="browse-card-image"
                    loading="lazy"
                  />
                  
                  {/* Status badge */}
                  {anime.status === 'ongoing' && (
                    <div className="browse-card-badge">
                      <Sparkles className="w-3 h-3 mr-1 inline" />
                      Ongoing
                    </div>
                  )}

                  {/* Rating/Views badge */}
                  {anime.view_count !== null && anime.view_count > 0 && (
                    <div className="browse-card-rating">
                      <Eye className="w-3.5 h-3.5 text-primary" />
                      <span>{anime.view_count.toLocaleString()}</span>
                    </div>
                  )}
                  
                  {/* Hover overlay */}
                  <div className="browse-card-overlay" />
                  
                  {/* Hover content */}
                  <div className="browse-card-content">
                    <Button size="sm" className="anime-button w-full">
                      <Play className="h-4 w-4 mr-2 fill-current" />
                      Watch Now
                    </Button>
                  </div>
                </div>

                {/* Card info */}
                <div className="p-4">
                  <h3 className="font-bold text-base line-clamp-2 group-hover:text-primary transition-colors mb-2">
                    {anime.title}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {anime.release_year && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {anime.release_year}
                      </span>
                    )}
                    {anime.genres && anime.genres.length > 0 && (
                      <span className="px-2 py-0.5 bg-secondary/50 rounded text-xs">
                        {anime.genres[0]}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
