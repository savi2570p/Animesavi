import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { TrendingUp, ChevronRight, Play, Eye, Filter } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TrailerPreview } from '@/components/home/TrailerPreview';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PopularAnime {
  id: string;
  title: string;
  cover_image: string | null;
  view_count: number | null;
  status: string | null;
  genres: string[] | null;
}

const ALL_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 
  'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller'
];

export function MostPopular() {
  const [animeList, setAnimeList] = useState<PopularAnime[]>([]);
  const [filteredList, setFilteredList] = useState<PopularAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [hoveredAnimeId, setHoveredAnimeId] = useState<string | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchPopularAnime();
  }, []);

  useEffect(() => {
    if (selectedGenre) {
      const filtered = animeList.filter(anime => 
        anime.genres?.some(g => g.toLowerCase() === selectedGenre.toLowerCase())
      );
      setFilteredList(filtered);
    } else {
      setFilteredList(animeList);
    }
  }, [selectedGenre, animeList]);

  const fetchPopularAnime = async () => {
    try {
      const { data, error } = await supabase
        .from('anime')
        .select('id, title, cover_image, view_count, status, genres')
        .order('view_count', { ascending: false })
        .limit(12);

      if (error) throw error;
      
      // Assign specific view counts for featured anime
      const viewCountMap: Record<string, number> = {
        'Your Name': 9500000,
        'Your lie in April': 3400000,
        'The angel next door spoils me rotten': 1200000,
        'The Angel Next Door Spoils me Rotten': 1200000,
        'Mechanical Marie': 977000,
        'Solo Leveling': 730000,
        'BOFURI: I Don\'t Want to Get Hurt, so I\'ll Max Out My Defense.': 2300000,
        'A Gatherer\'s Adventure in Isekai': 267000,
        'Jujutsu Kaisen': 8700000,
        'My Dress-Up Darling': 6200000,
        'Reborn to Master the Blade: From Hero-King to Extraordinary Squire': 1800000,
      };
      
      const animeWithViews = (data || []).map(anime => ({
        ...anime,
        view_count: viewCountMap[anime.title] || Math.floor(Math.random() * (900000 - 100000) + 100000)
      }));
      
      // Sort by view count after assigning values (highest first)
      animeWithViews.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
      
      setAnimeList(animeWithViews);
      setFilteredList(animeWithViews);
    } catch (error) {
      console.error('Error fetching popular anime:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenreFilter = (genre: string | null) => {
    setSelectedGenre(genre);
  };

  const handleMouseEnter = (animeId: string) => {
    // Set a delay before showing trailer to avoid accidental triggers
    const timeout = setTimeout(() => {
      setHoveredAnimeId(animeId);
    }, 800);
    setHoverTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setHoveredAnimeId(null);
  };

  if (loading) {
    return (
      <section className="py-10 md:py-14">
        <div className="container">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">Most Popular</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[3/4] rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (animeList.length === 0) return null;

  return (
    <section className="py-10 md:py-14">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">Most Popular</h2>
            <span className="px-2 py-1 text-xs font-medium bg-primary/20 text-primary rounded-full">
              Trending
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Genre Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  {selectedGenre || 'All Genres'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 max-h-64 overflow-y-auto bg-popover z-50">
                <DropdownMenuItem 
                  onClick={() => handleGenreFilter(null)}
                  className={!selectedGenre ? 'bg-primary/10' : ''}
                >
                  All Genres
                </DropdownMenuItem>
                {ALL_GENRES.map(genre => (
                  <DropdownMenuItem 
                    key={genre}
                    onClick={() => handleGenreFilter(genre)}
                    className={selectedGenre === genre ? 'bg-primary/10' : ''}
                  >
                    {genre}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button asChild variant="ghost" className="group">
              <Link to="/browse?sort=popular" className="flex items-center gap-1">
                See All
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No anime found for "{selectedGenre}" genre.</p>
            <Button 
              variant="link" 
              onClick={() => setSelectedGenre(null)}
              className="mt-2"
            >
              Clear filter
            </Button>
          </div>
        ) : (
          <div className="flex md:grid md:grid-cols-4 gap-3 md:gap-4 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
            {filteredList.slice(0, 4).map((anime, index) => (
              <AnimeCardContextMenu
                key={anime.id}
                animeTitle={anime.title}
                animeUrl={`/anime/${anime.id}`}
                coverImage={anime.cover_image}
              >
                <Link
                  to={`/anime/${anime.id}`}
                  className={`group relative block stagger-${Math.min(index + 1, 4)} animate-fade-in w-[140px] md:w-auto shrink-0`}
                  onMouseEnter={() => handleMouseEnter(anime.id)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted shadow-md group-hover:shadow-xl transition-all duration-500">
                    {/* Trailer Preview on Hover */}
                    {hoveredAnimeId === anime.id && (
                      <TrailerPreview
                        animeId={anime.id}
                        coverImage={anime.cover_image}
                        title={anime.title}
                        onClose={() => setHoveredAnimeId(null)}
                      />
                    )}
                    
                    <img
                      src={anime.cover_image || '/placeholder.svg'}
                      alt={anime.title}
                      className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                    {/* 4K Badge */}
                    <div className="absolute bottom-1.5 right-1.5 z-10">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg">4K</span>
                    </div>
                    
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-60 group-hover:opacity-90 transition-all duration-300" />
                    
                    {/* Play overlay - hide when trailer is showing */}
                    {hoveredAnimeId !== anime.id && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="p-4 rounded-full bg-primary/90 shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                          <Play className="h-6 w-6 text-primary-foreground fill-current" />
                        </div>
                      </div>
                    )}

                    {/* Rank Badge */}
                    <div className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-lg shadow-md z-20">
                      #{index + 1}
                    </div>

                    {/* View Count */}
                    {anime.view_count && anime.view_count > 0 && (
                      <div className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-black/60 text-white rounded-lg flex items-center gap-1 z-20">
                        <Eye className="h-3 w-3" />
                        {anime.view_count >= 1000000 
                          ? `${(anime.view_count / 1000000).toFixed(1)}M` 
                          : `${(anime.view_count / 1000).toFixed(0)}K`}
                      </div>
                    )}

                    {/* Token Crown Badge */}
                    <TokenCrownBadge />

                    {/* Title at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
                      <h3 className="text-sm md:text-base font-semibold text-white line-clamp-2 drop-shadow-lg">
                        {anime.title}
                      </h3>
                    </div>
                  </div>
                </Link>
              </AnimeCardContextMenu>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
