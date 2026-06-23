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

const ALLOWED_GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Mysterious', 'Hentai', 'Anime', 'Anime Series', 'Hindi', 'English', 'Tamil', 'Telugu', 'Japanese', 'Crunchyroll', 'Muse India', 'Sony YAY', 'Amazon Prime', 'Netflix', 'Zee 5'] as const;
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

      {/* Compact cinematic hero */}
      <div className="relative overflow-hidden border-b border-border/40">
        {/* Ambient gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="absolute -top-24 left-1/3 w-[420px] h-[420px] bg-primary/15 rounded-full blur-3xl opacity-60" />
        <div className="absolute -bottom-24 right-1/4 w-72 h-72 bg-accent/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,hsl(var(--primary)/0.08),transparent_60%)]" />

        <div className="container relative px-4 py-8 sm:py-12">
          {/* Mode pill + clear */}
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all",
              isSearchMode 
                ? "bg-primary/20 text-primary border border-primary/40 shadow-sm shadow-primary/20" 
                : "bg-muted/60 text-muted-foreground border border-border/50"
            )}>
              {isSearchMode ? <Search className="h-3 w-3" /> : <Filter className="h-3 w-3" />}
              {isSearchMode ? 'Searching' : 'Browse'}
            </div>
            {isSearchMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Exit
              </Button>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-heading font-bold leading-tight animate-fade-in">
            {isSearchMode ? (
              <>Results for <span className="anime-gradient-text">"{searchParams.get('q')}"</span></>
            ) : (
              <>Discover <span className="anime-gradient-text">Anime</span></>
            )}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-2 max-w-xl animate-fade-in animation-delay-100">
            {isSearchMode 
              ? 'Refine with the filters below or pick a result.'
              : 'Browse our entire catalog — filter by type, genre, status, and more.'
            }
          </p>

          {/* Hero search bar */}
          <form onSubmit={handleSearch} className="mt-5 sm:mt-7 flex gap-2 max-w-2xl animate-fade-in-up">
            <div className="relative flex-1" ref={searchContainerRef}>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground z-10 pointer-events-none" />
              <Input
                ref={searchInputRef}
                type="search"
                placeholder={isSearchMode ? "Modify your search…" : "Search anime by title…"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearchDropdown(true)}
                className={cn(
                  "pl-10 sm:pl-11 pr-10 h-11 sm:h-12 bg-card/70 backdrop-blur-md border-border/60 rounded-xl text-sm sm:text-base focus:border-primary/60 focus:bg-card focus-visible:ring-2 focus-visible:ring-primary/30 transition-all shadow-sm",
                  isSearchMode && "border-primary/40 bg-primary/5"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 z-10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              
              {/* Search Dropdown */}
              {!isSearchMode && showSearchDropdown && showDropdownContent && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl overflow-hidden" style={{ zIndex: 99999 }}>
                  {showSuggestions && (
                    <div className="max-h-80 overflow-y-auto">
                      <div className="px-4 py-2 border-b border-border/50">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Suggestions</span>
                      </div>
                      {searchSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-muted/60 transition-colors text-left"
                        >
                          <div className="w-10 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            <img 
                              src={suggestion.cover_image || '/placeholder.svg'} 
                              alt={suggestion.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-1">{suggestion.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{suggestion.type || 'Anime'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {showHistory && (
                    <>
                      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <History className="h-3 w-3" />
                          Recent
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); clearHistory(); }}
                          className="text-[10px] font-medium text-muted-foreground hover:text-destructive transition-colors uppercase tracking-wider"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {searchHistory.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between px-3 py-2 hover:bg-muted/60 cursor-pointer group"
                          >
                            <button
                              type="button"
                              onClick={() => handleHistoryItemClick(item.query)}
                              className="flex items-center gap-2.5 flex-1 text-left"
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
            <Button type="submit" className="anime-button h-11 sm:h-12 px-4 sm:px-7 rounded-xl shadow-md shadow-primary/20">
              <Search className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
              <span className="hidden sm:inline">Search</span>
            </Button>
          </form>
        </div>
      </div>

      <div className="container px-4 pt-5 sm:pt-7 pb-12">
        {/* Filters — chip rows in card */}
        <div className={cn(
          "rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-3 sm:p-5 mb-6 sm:mb-8 space-y-3 sm:space-y-4 transition-all",
          isSearchMode && "opacity-95"
        )}>
          {isSearchMode && (
            <div className="flex items-center gap-2 pb-2 border-b border-border/50">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Refine your results</span>
            </div>
          )}

          {/* Type */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold w-16 shrink-0">Type</span>
            <div className="flex flex-wrap gap-1.5">
              {typeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleTypeFilter(option.value)}
                  className={cn("filter-btn flex items-center gap-1.5 text-xs", typeFilter === option.value && "active")}
                >
                  {option.value === 'movie' && <Film className="h-3.5 w-3.5" />}
                  {option.value === 'series' && <Tv className="h-3.5 w-3.5" />}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          {!isSearchMode && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold w-16 shrink-0">Sort</span>
              <div className="flex flex-wrap gap-1.5">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    className={cn("filter-btn flex items-center gap-1.5 text-xs", sortBy === option.value && "active")}
                  >
                    <option.icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold w-16 shrink-0">Status</span>
            <div className="flex flex-wrap gap-1.5">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusFilter(option.value)}
                  className={cn("filter-btn flex items-center gap-1.5 text-xs", statusFilter === option.value && "active")}
                >
                  <option.icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Episodes */}
          {!isSearchMode && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold w-16 shrink-0">Episodes</span>
              <div className="flex flex-wrap gap-1.5">
                {episodeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleEpisodeFilter(option.value)}
                    className={cn("filter-btn text-xs", episodeFilter === option.value && "active")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Genres — horizontal scrollable rail */}
          <div className="pt-3 border-t border-border/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                Genres
              </span>
              {selectedGenre && (
                <button
                  onClick={() => handleGenreFilter(selectedGenre)}
                  className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              {ALLOWED_GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => handleGenreFilter(genre)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap border transition-all",
                    selectedGenre === genre.toLowerCase()
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30 scale-105"
                      : "bg-card/60 text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Top 10 Most Popular — Browse Mode only */}
        {!isSearchMode && !searchParams.get('genre') && sortBy === 'newest' && (
          <MostPopularSection />
        )}

        {/* Results header */}
        {!isLoading && (
          <div className="flex items-center justify-between mb-4 sm:mb-6 animate-fade-in">
            <div className="text-sm sm:text-base text-muted-foreground">
              {isSearchMode ? (
                <>
                  <span className="text-foreground font-bold">{animeList.length}</span> result{animeList.length !== 1 ? 's' : ''} for <span className="text-primary font-semibold">"{searchParams.get('q')}"</span>
                </>
              ) : (
                <>
                  <span className="text-foreground font-bold">{animeList.length}</span> anime
                  {selectedGenre && <span> · <span className="text-primary font-semibold capitalize">{selectedGenre}</span></span>}
                </>
              )}
            </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
            {animeList.map((anime, index) => (
              <Link 
                key={anime.id} 
                to={`/anime/${anime.id}`} 
                className="browse-card group animate-fade-in-up"
                style={{ animationDelay: `${Math.min(index * 40, 600)}ms` }}
                onClick={(e) => handleAnimeClick(anime, e)}
              >
                {/* Poster */}
                <div className="aspect-[2/3] relative overflow-hidden rounded-xl">
                  {/* Skeleton/blur background */}
                  <div
                    className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-40"
                    style={{ backgroundImage: `url(${anime.cover_image || '/placeholder.svg'})` }}
                    aria-hidden="true"
                  />
                  <img
                    src={anime.cover_image || '/placeholder.svg'}
                    alt={anime.title}
                    className="browse-card-image relative z-[1]"
                    loading="lazy"
                  />

                  {/* Always-on bottom gradient for legibility */}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/95 via-black/50 to-transparent z-[2] pointer-events-none" />

                  {/* TOP-LEFT: status badge */}
                  <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
                    {anime.status === 'ongoing' && (
                      <div className="badge-glass-og">OG</div>
                    )}
                    {anime.status === 'completed' && (
                      <div className="badge-glass-com">COM</div>
                    )}
                    {anime.status === 'upcoming' && (
                      <div className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-orange-500/95 text-white rounded-md flex items-center gap-1 backdrop-blur-md shadow-lg shadow-orange-500/30 animate-pulse">
                        <CalendarClock className="w-2.5 h-2.5" />
                        Soon
                      </div>
                    )}
                    {anime.type === 'movie' && (
                      <div className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-accent/95 text-accent-foreground rounded-md flex items-center gap-1 backdrop-blur-md">
                        <Film className="w-2.5 h-2.5" />
                        Movie
                      </div>
                    )}
                  </div>

                  {/* TOP-RIGHT: NEW + H-DUB */}
                  <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
                    {isNew(anime.created_at) && (
                      <div className="badge-glass-new animate-pulse">NEW</div>
                    )}
                    <div className="badge-glass-hdub">H-DUB</div>
                  </div>

                  {/* BOTTOM-LEFT: episode count chip */}
                  {anime.episode_count !== undefined && anime.episode_count > 0 && anime.type !== 'movie' && (
                    <div className="absolute bottom-2 left-2 z-10 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold bg-black/70 text-white rounded-md flex items-center gap-1 backdrop-blur-md ring-1 ring-white/10">
                      <Tv className="h-2.5 w-2.5 text-primary" />
                      {anime.episode_count} EP
                    </div>
                  )}

                  {/* BOTTOM-RIGHT: year */}
                  {anime.release_year && (
                    <div className="absolute bottom-2 right-2 z-10 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold bg-black/70 text-white/90 rounded-md backdrop-blur-md ring-1 ring-white/10">
                      {anime.release_year}
                    </div>
                  )}

                  {/* Episodes Under Progress overlay */}
                  {anime.episode_count === 0 && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center z-20 p-3 text-center">
                      <div className="bg-orange-500/95 text-white px-2.5 py-2 rounded-lg shadow-xl">
                        <AlertCircle className="h-4 w-4 mx-auto mb-1" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Under Progress</span>
                      </div>
                    </div>
                  )}

                  {/* Hover Play overlay (desktop) */}
                  <div className="absolute inset-0 z-[3] hidden sm:flex items-center justify-center bg-black/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="h-14 w-14 rounded-full bg-primary/95 flex items-center justify-center shadow-2xl shadow-primary/50 ring-4 ring-white/20 scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="h-6 w-6 text-primary-foreground fill-current ml-0.5" />
                    </div>
                  </div>

                  {/* Title overlay always visible at bottom */}
                  <div className="absolute inset-x-0 bottom-0 z-[4] p-2.5 sm:p-3 pt-8">

                    <h3 className="font-bold text-[12px] sm:text-sm text-white line-clamp-2 leading-tight drop-shadow-md group-hover:text-primary transition-colors">
                      {anime.title}
                    </h3>
                  </div>
                </div>

                {/* Meta footer — year · episodes · genre */}
                <div className="mt-1.5 px-0.5 flex items-center justify-between gap-2 text-[10px] sm:text-[11px]">
                  <div className="flex items-center gap-1.5 text-muted-foreground font-medium min-w-0">
                    {anime.release_year && (
                      <span className="text-foreground/90 font-semibold">{anime.release_year}</span>
                    )}
                    {anime.release_year && (anime.episode_count ?? 0) > 0 && anime.type !== 'movie' && (
                      <span className="opacity-50">·</span>
                    )}
                    {(anime.episode_count ?? 0) > 0 && anime.type !== 'movie' && (
                      <span className="flex items-center gap-0.5">
                        <Tv className="h-2.5 w-2.5 text-primary" />
                        {anime.episode_count} EP
                      </span>
                    )}
                    {anime.type === 'movie' && (
                      <span className="flex items-center gap-0.5">
                        <Film className="h-2.5 w-2.5 text-accent" />
                        Movie
                      </span>
                    )}
                  </div>
                  {anime.genres && anime.genres.length > 0 && (
                    <span className="text-muted-foreground/70 uppercase tracking-wider truncate text-[9px] sm:text-[10px] font-medium shrink">
                      {anime.genres[0]}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
