import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Play, Star } from 'lucide-react';

const genres = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports'];

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

  useEffect(() => {
    fetchAnime();
  }, [searchParams]);

  const fetchAnime = async () => {
    setIsLoading(true);
    let query = supabase.from('anime').select('*').order('created_at', { ascending: false });

    const q = searchParams.get('q');
    const genre = searchParams.get('genre');

    if (q) {
      query = query.ilike('title', `%${q}%`);
    }

    if (genre) {
      query = query.contains('genres', [genre.charAt(0).toUpperCase() + genre.slice(1)]);
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

  return (
    <div className="container py-8">
      <h1 className="text-4xl font-heading font-bold mb-8">
        Browse <span className="anime-gradient-text">Anime</span>
      </h1>

      {/* Search & Filters */}
      <div className="mb-8 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search anime..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50"
            />
          </div>
          <Button type="submit" className="anime-button">Search</Button>
        </form>

        <div className="flex flex-wrap gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          {genres.map((genre) => (
            <Button
              key={genre}
              variant="outline"
              size="sm"
              onClick={() => handleGenreFilter(genre)}
              className={`genre-badge ${selectedGenre === genre.toLowerCase() ? 'bg-primary text-primary-foreground' : ''}`}
            >
              {genre}
            </Button>
          ))}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="anime-card aspect-[3/4] animate-pulse bg-muted" />
          ))}
        </div>
      ) : animeList.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-xl text-muted-foreground mb-4">No anime found</p>
          <p className="text-muted-foreground">Try a different search or check back later for new content.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {animeList.map((anime) => (
            <Link key={anime.id} to={`/anime/${anime.id}`} className="anime-card group">
              <div className="aspect-[3/4] relative overflow-hidden rounded-xl">
                <img
                  src={anime.cover_image || '/placeholder.svg'}
                  alt={anime.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <Button size="sm" className="w-full anime-button">
                      <Play className="h-4 w-4 mr-2 fill-current" /> Watch Now
                    </Button>
                  </div>
                </div>
                {anime.status === 'ongoing' && (
                  <Badge className="absolute top-2 left-2 bg-anime-orange">Ongoing</Badge>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                  {anime.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  {anime.release_year && <span>{anime.release_year}</span>}
                  {anime.view_count !== null && anime.view_count > 0 && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-anime-orange text-anime-orange" />
                        {anime.view_count}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
