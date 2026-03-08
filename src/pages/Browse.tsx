import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Play, Star, Sparkles, TrendingUp, Clock, Film, Tv, CheckCircle2, Timer, CalendarClock, X, AlertCircle, History, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { MostPopularSection } from '@/components/browse/MostPopularSection';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';

const ALLOWED_GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Mysterious', 'Anime', 'Anime Series', 'Hindi', 'English', 'Tamil', 'Telugu', 'Japanese', 'Crunchyroll', 'Muse India', 'Amazon Prime'] as const;
const MAX_SEARCH_LENGTH = 100;
// Allowed characters: alphanumeric, spaces, hyphens, apostrophes, and common punctuation
const SEARCH_PATTERN = /^[a-zA-Z0-9\s\-'.,!?:]+$/;

// Sanitize search input to prevent ILIKE pattern abuse
const sanitizeSearchQuery = (query: string): string => {
  // Trim and limit length
  let sanitized = query.trim().slice(0, MAX_SEARCH_LENGTH);
  
  // Remove characters that aren't allowed
  if (!SEARCH_PATTERN.test(sanitized)) {
    sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-'.,!?:]/g, '');
  }
  
  // Escape special LIKE/ILIKE characters (%, _, \)
  sanitized = sanitized
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
  
  return sanitized;
};

type SortOption = 'newest' | 'popular' | 'trending';
type TypeFilter = 'all' | 'series' | 'movie';
type StatusFilter = 'all' | 'ongoing' | 'completed' | 'upcoming';
type EpisodeFilter = 'all' | 'no-episodes';

interface Anime {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  genres: string[];
  release_year: number | null;
  status: string | null;
  view_count: number | null;
  type: string | null;
  created_at: string | null;
  episode_count?: number;
}

interface SearchSuggestion {
  id: string;
  title: string;
  cover_image: string | null;
  type: string | null;
}

interface NoEpisodesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  animeTitle: string;
}

function NoEpisodesPopup({ isOpen, onClose, animeTitle }: NoEpisodesPopupProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-xl animate-scale-in">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-orange-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Episodes Coming Soon</h3>
          </div>
        </div>
        <p className="text-muted-foreground mb-6">
          The episodes for "<span className="text-foreground font-medium">{animeTitle}</span>" are currently under progress. Please check back later!
        </p>
        <Button 
          onClick={onClose}
          className="w-full anime-button"
        >
          OK, Got It!
        </Button>
      </div>
    </div>
  );
}

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedGenre, setSelectedGenre] = useState(searchParams.get('genre') || '');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>((searchParams.get('type') as TypeFilter) || 'all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>((searchParams.get('status') as StatusFilter) || 'all');
  const [episodeFilter, setEpisodeFilter] = useState<EpisodeFilter>((searchParams.get('episodes') as EpisodeFilter) || 'all');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  
  // Search history hook
  const { searchHistory, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
  
  // No episodes popup state
  const [noEpisodesPopup, setNoEpisodesPopup] = useState<{ isOpen: boolean; animeTitle: string }>({
    isOpen: false,
    animeTitle: '',
  });

  // Determine if we're in Search Mode (active search query in URL)
  const isSearchMode = Boolean(searchParams.get('q'));
  
  // Clear search and return to Browse Mode
  const clearSearch = () => {
    setSearchQuery('');
    const params = new URLSearchParams(searchParams);
    params.delete('q');
    setSearchParams(params);
  };

  // Escape key handler to exit Search Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchMode) {
        clearSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchMode]);

  // Fetch search suggestions when typing
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchSuggestions([]);
        return;
      }

      setIsLoadingSuggestions(true);
      const sanitized = sanitizeSearchQuery(searchQuery);
      
      const { data } = await supabase
        .from('anime_public')
        .select('id, title, cover_image, type')
        .ilike('title', `%${sanitized}%`)
        .limit(6);

      if (data) {
        setSearchSuggestions(data);
      }
      setIsLoadingSuggestions(false);
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const urlType = searchParams.get('type') as TypeFilter;
    if (urlType && ['all', 'series', 'movie'].includes(urlType)) {
      setTypeFilter(urlType);
    }
    const urlStatus = searchParams.get('status') as StatusFilter;
    if (urlStatus && ['all', 'ongoing', 'completed', 'upcoming'].includes(urlStatus)) {
      setStatusFilter(urlStatus);
    }
    const urlEpisodes = searchParams.get('episodes') as EpisodeFilter;
    if (urlEpisodes && ['all', 'no-episodes'].includes(urlEpisodes)) {
      setEpisodeFilter(urlEpisodes);
    }
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
    const type = searchParams.get('type');

    if (q) {
      const sanitizedQuery = sanitizeSearchQuery(q);
      if (sanitizedQuery && sanitizedQuery.length > 0) {
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

    // Filter by type (series or movie)
    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    // Filter by status (ongoing, completed, upcoming)
    const status = searchParams.get('status');
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (!error && data) {
      // Fetch episode counts for each anime
      const animeWithCounts = await Promise.all(
        data.map(async (anime) => {
          const { data: seasons } = await supabase
            .from('seasons')
            .select('id')
            .eq('anime_id', anime.id);
          
          let totalEpisodes = 0;
          if (seasons && seasons.length > 0) {
            for (const season of seasons) {
              const { count } = await supabase
                .from('episodes')
                .select('id', { count: 'exact', head: true })
                .eq('season_id', season.id);
              totalEpisodes += count || 0;
            }
          }
          
          return { ...anime, episode_count: totalEpisodes };
        })
      );
      
      // Apply episode filter
      const episodeFilterValue = searchParams.get('episodes');
      let filteredList = animeWithCounts;
      if (episodeFilterValue === 'no-episodes') {
        filteredList = animeWithCounts.filter(anime => anime.episode_count === 0);
      }
      
      setAnimeList(filteredList);
    }
    setIsLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchQuery) {
      params.set('q', searchQuery);
      // Add to search history
      addToHistory(searchQuery);
    } else {
      params.delete('q');
    }
    setShowSearchDropdown(false);
    setSearchParams(params);
  };

  const handleHistoryItemClick = (query: string) => {
    setSearchQuery(query);
    const params = new URLSearchParams(searchParams);
    params.set('q', query);
    setShowSearchDropdown(false);
    setSearchParams(params);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setShowSearchDropdown(false);
    addToHistory(suggestion.title);
    navigate(`/anime/${suggestion.id}`);
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

  const handleTypeFilter = (type: TypeFilter) => {
    const params = new URLSearchParams(searchParams);
    if (type === 'all') {
      params.delete('type');
    } else {
      params.set('type', type);
    }
    setTypeFilter(type);
    setSearchParams(params);
  };

  const handleStatusFilter = (status: StatusFilter) => {
    const params = new URLSearchParams(searchParams);
    if (status === 'all') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    setStatusFilter(status);
    setSearchParams(params);
  };

  const handleEpisodeFilter = (filter: EpisodeFilter) => {
    const params = new URLSearchParams(searchParams);
    if (filter === 'all') {
      params.delete('episodes');
    } else {
      params.set('episodes', filter);
    }
    setEpisodeFilter(filter);
    setSearchParams(params);
  };

  const handleAnimeClick = (anime: Anime, e: React.MouseEvent) => {
    if (anime.episode_count === 0) {
      e.preventDefault();
      setNoEpisodesPopup({ isOpen: true, animeTitle: anime.title });
    }
  };

  const isNew = (dateString: string | null) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    return hours <= 24;
  };

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'series', label: 'Series' },
    { value: 'movie', label: 'Movies' },
  ];

  const sortOptions = [
    { value: 'newest' as const, label: 'New Releases', icon: Clock },
    { value: 'popular' as const, label: 'Most Popular', icon: TrendingUp },
    { value: 'trending' as const, label: 'Trending', icon: Sparkles },
  ];

  const statusOptions: { value: StatusFilter; label: string; icon: typeof Timer }[] = [
    { value: 'all', label: 'All', icon: Filter },
    { value: 'ongoing', label: 'Ongoing', icon: Timer },
    { value: 'completed', label: 'Completed', icon: CheckCircle2 },
    { value: 'upcoming', label: 'Upcoming', icon: CalendarClock },
  ];

  const episodeOptions: { value: EpisodeFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'no-episodes', label: 'Pending Upload' },
  ];

  // Determine what to show in dropdown
  const showSuggestions = searchQuery.trim().length >= 2 && searchSuggestions.length > 0;
  const showHistory = searchQuery.trim().length === 0 && searchHistory.length > 0;
  const showDropdownContent = showSuggestions || showHistory;

  return (
    <div className="min-h-screen">
      {/* Content Navigation Tabs */}
      <ContentNavTabs />
      
      {/* No Episodes Popup */}
      <NoEpisodesPopup
        isOpen={noEpisodesPopup.isOpen}
        onClose={() => setNoEpisodesPopup({ isOpen: false, animeTitle: '' })}
        animeTitle={noEpisodesPopup.animeTitle}
      />
      {/* Hero header */}
      <div className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="container relative">
          {/* Mode indicator */}
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
              isSearchMode 
                ? "bg-primary/20 text-primary border border-primary/30" 
                : "bg-muted text-muted-foreground"
            )}>
              {isSearchMode ? (
                <>
                  <Search className="h-4 w-4" />
                  Search Mode
                </>
              ) : (
                <>
                  <Filter className="h-4 w-4" />
                  Browse Mode
                </>
              )}
            </div>
            {isSearchMode && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Exit Search
                </Button>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> to exit
                </span>
              </div>
            )}
          </div>
          
          <h1 className="text-5xl md:text-6xl font-heading font-bold mb-4 animate-fade-in">
            {isSearchMode ? (
              <>Search Results for "<span className="anime-gradient-text">{searchParams.get('q')}</span>"</>
            ) : (
              <>Browse <span className="anime-gradient-text">Anime</span></>
            )}
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl animate-fade-in animation-delay-100">
            {isSearchMode 
              ? `Showing results matching your search`
              : 'Discover your next favorite series from our extensive collection'
            }
          </p>
        </div>
      </div>

      <div className="container pb-12">
        {/* Search Bar - Always visible */}
        <div className="mb-8">
          <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl animate-fade-in-up stagger-1">
            <div className="relative flex-1" ref={searchContainerRef}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
              <Input
                ref={searchInputRef}
                type="search"
                placeholder={isSearchMode ? "Modify your search..." : "Search for anime..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearchDropdown(true)}
                className={cn(
                  "pl-12 pr-10 h-14 bg-card/50 border-border/50 rounded-xl text-base focus:border-primary/50 focus:bg-card transition-all",
                  isSearchMode && "border-primary/30 bg-primary/5"
                )}
              />
              
              {/* Clear input button */}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    if (isSearchMode) clearSearch();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              
              {/* Search Dropdown - Only in Browse Mode */}
              {!isSearchMode && showSearchDropdown && showDropdownContent && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-xl overflow-hidden" style={{ zIndex: 99999, position: 'relative' }}>
                  {/* Search Suggestions with Thumbnails */}
                  {showSuggestions && (
                    <div className="max-h-80 overflow-y-auto">
                      <div className="px-4 py-2 border-b border-border/50">
                        <span className="text-xs font-medium text-muted-foreground">Suggestions</span>
                      </div>
                      {searchSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="w-12 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            <img 
                              src={suggestion.cover_image || '/placeholder.svg'} 
                              alt={suggestion.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium line-clamp-1">{suggestion.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{suggestion.type || 'Anime'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Search History - Only when input is empty */}
                  {showHistory && (
                    <>
                      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                          <History className="h-3 w-3" />
                          Recent Searches
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); clearHistory(); }}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {searchHistory.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between px-4 py-2 hover:bg-muted/50 cursor-pointer group"
                          >
                            <button
                              type="button"
                              onClick={() => handleHistoryItemClick(item.query)}
                              className="flex items-center gap-3 flex-1 text-left"
                            >
                              <Search className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">{item.query}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removeFromHistory(item.query); }}
                              className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <Button type="submit" className="anime-button h-14 px-8 rounded-xl">
              <Search className="h-5 w-5 mr-2" />
              Search
            </Button>
          </form>
        </div>

        {/* Browse Filters - Available in both modes for optional refinement */}
        <div className={cn(
          "mb-10 space-y-6 transition-all",
          isSearchMode && "opacity-70"
        )}>
          {/* Section label for Search Mode */}
          {isSearchMode && (
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Optional filters to refine search results</span>
            </div>
          )}

          {/* Type filter */}
          <div className="flex flex-wrap items-center gap-3 animate-fade-in-up stagger-2">
            <span className="text-sm text-muted-foreground font-medium">Type:</span>
            {typeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleTypeFilter(option.value)}
                className={cn("filter-btn flex items-center gap-2", typeFilter === option.value && "active")}
              >
                {option.value === 'movie' && <Film className="h-4 w-4" />}
                {option.value === 'series' && <Tv className="h-4 w-4" />}
                {option.label}
              </button>
            ))}
          </div>

          {/* Sort options - Hide in Search Mode as search is keyword-based */}
          {!isSearchMode && (
            <div className="flex flex-wrap items-center gap-3 animate-fade-in-up stagger-3">
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
          )}

          {/* Status filter */}
          <div className="flex flex-wrap items-center gap-3 animate-fade-in-up stagger-4">
            <span className="text-sm text-muted-foreground font-medium">Status:</span>
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusFilter(option.value)}
                className={cn("filter-btn flex items-center gap-2", statusFilter === option.value && "active")}
              >
                <option.icon className="h-4 w-4" />
                {option.label}
              </button>
            ))}
          </div>

          {/* Episode filter - Only in Browse Mode */}
          {!isSearchMode && (
            <div className="flex flex-wrap items-center gap-3 animate-fade-in-up stagger-5">
              <span className="text-sm text-muted-foreground font-medium">Episodes:</span>
              {episodeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleEpisodeFilter(option.value)}
                  className={cn("filter-btn flex items-center gap-2", episodeFilter === option.value && "active")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {/* Genre filters */}
          <div className="flex flex-wrap items-center gap-3 animate-fade-in-up stagger-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <Sparkles className="h-4 w-4" />
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

        {/* Top 10 Most Popular Section - Only in Browse Mode, hidden when searching */}
        {!isSearchMode && !searchParams.get('genre') && sortBy === 'newest' && (
          <MostPopularSection />
        )}

        {/* Results count */}
        {!isLoading && (
          <div className="mb-6 text-muted-foreground animate-fade-in">
            {isSearchMode ? (
              <>
                Found <span className="text-foreground font-semibold">{animeList.length}</span> result{animeList.length !== 1 ? 's' : ''} for "<span className="text-primary font-medium">{searchParams.get('q')}</span>"
              </>
            ) : (
              <>
                Found <span className="text-foreground font-semibold">{animeList.length}</span> anime
                {selectedGenre && <span> in <span className="text-primary font-medium capitalize">{selectedGenre}</span></span>}
              </>
            )}
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
            <h3 className="text-2xl font-bold mb-2">
              {isSearchMode ? 'No results found' : 'No anime found'}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {isSearchMode 
                ? `We couldn't find any anime matching "${searchParams.get('q')}". Try a different search term.`
                : 'Try adjusting your filters to find what you\'re looking for.'
              }
            </p>
            {isSearchMode && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={clearSearch}
              >
                <X className="h-4 w-4 mr-2" />
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {animeList.map((anime, index) => (
              <Link 
                key={anime.id} 
                to={`/anime/${anime.id}`} 
                className="browse-card animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={(e) => handleAnimeClick(anime, e)}
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
                  
                  {/* Upcoming/Coming Soon badge */}
                  {anime.status === 'upcoming' && (
                    <div className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-orange-500 text-white rounded-md flex items-center gap-1 z-10 animate-pulse">
                      <CalendarClock className="w-3 h-3" />
                      Coming Soon
                    </div>
                  )}
                  
                  {/* Completed badge */}
                  {anime.status === 'completed' && (
                    <div className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-green-600 text-white rounded-md flex items-center gap-1 z-10">
                      <CheckCircle2 className="w-3 h-3" />
                      Completed
                    </div>
                  )}

                  {/* NEW badge for content uploaded in last 24 hours */}
                  {isNew(anime.created_at) && (
                    <div className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-green-500 text-white rounded-md animate-pulse z-10">
                      NEW
                    </div>
                  )}

                  {/* Episode count badge - Bottom left */}
                  {anime.episode_count !== undefined && anime.episode_count > 0 && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-md flex items-center gap-1 z-10">
                      <Tv className="h-3 w-3" />
                      {anime.episode_count} EP{anime.episode_count !== 1 ? 'S' : ''}
                    </div>
                  )}

                  {/* Type badge */}
                  {anime.type === 'movie' && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 text-xs font-bold bg-accent text-accent-foreground rounded-md flex items-center gap-1 z-10">
                      <Film className="h-3 w-3" />
                      Movie
                    </div>
                  )}

                  {/* Episodes Under Progress overlay */}
                  {anime.episode_count === 0 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                      <div className="bg-orange-500/90 text-white px-3 py-2 rounded-lg text-center">
                        <AlertCircle className="h-5 w-5 mx-auto mb-1" />
                        <span className="text-xs font-bold">Episodes Under Progress</span>
                      </div>
                    </div>
                  )}

                  {/* Hover overlay */}
                  
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
