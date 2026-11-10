import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, AlertCircle, History, Trash2, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import { PosterCard } from '@/components/anime/PosterCard';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { formatViews, getViewCount } from '@/lib/viewCount';

const ALLOWED_GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Mysterious', 'Hentai', 'Anime', 'Anime Series', 'Hindi', 'English', 'Tamil', 'Telugu', 'Japanese', 'Crunchyroll', 'Muse India', 'Sony YAY', 'Amazon Prime', 'Netflix', 'Zee 5'] as const;
const MAX_SEARCH_LENGTH = 100;
const SEARCH_PATTERN = /^[a-zA-Z0-9\s\-'.,!?:]+$/;
const PAGE_SIZE = 36;
const ANY = 'any';

// Sanitize search input to prevent ILIKE pattern abuse
const sanitizeSearchQuery = (query: string): string => {
  let sanitized = query.trim().slice(0, MAX_SEARCH_LENGTH);
  if (!SEARCH_PATTERN.test(sanitized)) sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-'.,!?:]/g, '');
  return sanitized.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
};

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'trending', label: 'Most Liked' },
  { value: 'title', label: 'Title A–Z' },
] as const;
type SortOption = typeof SORTS[number]['value'];

const FACETS = [
  { key: 'type', title: 'Format', options: [{ value: 'series', label: 'TV Series' }, { value: 'movie', label: 'Movie' }] },
  { key: 'status', title: 'Status', options: [{ value: 'ongoing', label: 'Releasing' }, { value: 'completed', label: 'Finished' }, { value: 'upcoming', label: 'Not Yet Released' }] },
  { key: 'audio', title: 'Audio', options: [{ value: 'hindi', label: 'Hindi Dub' }, { value: 'eng', label: 'English Dub' }, { value: 'sub', label: 'Sub only' }] },
] as const;

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
  genres: string[] | null;
  release_year: number | null;
  status: string | null;
  view_count: number | null;
  type: string | null;
  created_at: string | null;
  is_eng_dub: boolean | null;
  is_sub_only: boolean | null;
  episode_count?: number;
}

interface SearchSuggestion { id: string; title: string; cover_image: string | null; type: string | null }

function NoEpisodesPopup({ isOpen, onClose, animeTitle }: { isOpen: boolean; onClose: () => void; animeTitle: string }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70">
      <div className="bg-card border border-border rounded-lg p-6 max-w-sm mx-4 shadow-xl animate-scale-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center"><AlertCircle className="h-5 w-5 text-primary" /></div>
          <h3 className="text-lg font-bold text-foreground">Episodes Coming Soon</h3>
        </div>
        <p className="text-muted-foreground mb-6">The episodes for "<span className="text-foreground font-medium">{animeTitle}</span>" are currently under progress. Please check back later!</p>
        <Button onClick={onClose} className="w-full">OK, Got It!</Button>
      </div>
    </div>
  );
}

const isNew = (dateString: string | null) => !!dateString && Date.now() - new Date(dateString).getTime() <= 24 * 3600 * 1000;

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { searchHistory, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
  const [noEpisodesPopup, setNoEpisodesPopup] = useState({ isOpen: false, animeTitle: '' });

  const q = searchParams.get('q') || '';
  const genre = searchParams.get('genre') || '';
  const year = searchParams.get('year') || '';
  const sortParam = searchParams.get('sort');
  const sortBy: SortOption = SORTS.some(s => s.value === sortParam) ? sortParam as SortOption : 'newest';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const isSearchMode = Boolean(q);

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear() + 1;
    return Array.from({ length: now - 1969 }, (_, i) => String(now - i));
  }, []);

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value); else params.delete(key);
    if (key !== 'page') params.delete('page');
    setSearchParams(params);
  };

  const clearSearch = () => { setSearchQuery(''); updateParam('q', null); };

  useEffect(() => { setSearchQuery(q); }, [q]);

  // Escape exits Search Mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && isSearchMode) clearSearch(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // Suggestions while typing (2 chars, 300ms debounce)
  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchSuggestions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('anime_public').select('id, title, cover_image, type')
        .ilike('title', `%${sanitizeSearchQuery(searchQuery)}%`).limit(6);
      if (data) setSearchSuggestions(data);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) setShowSearchDropdown(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const filterKey = ['q', 'genre', 'type', 'status', 'audio', 'year', 'sort'].map(k => searchParams.get(k) || '').join('|');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      let query = supabase.from('anime_public').select('id, title, cover_image, genres, release_year, status, view_count, type, created_at, is_eng_dub, is_sub_only');
      if (sortBy === 'popular') query = query.order('view_count', { ascending: false, nullsFirst: false });
      else if (sortBy === 'trending') query = query.order('like_count', { ascending: false, nullsFirst: false });
      else if (sortBy === 'title') query = query.order('title', { ascending: true });
      else query = query.order('created_at', { ascending: false });

      if (q) {
        const s = sanitizeSearchQuery(q);
        if (s) query = query.ilike('title', `%${s}%`);
      }
      if (genre) {
        const match = ALLOWED_GENRES.find(g => g.toLowerCase() === genre.toLowerCase());
        if (match) query = query.contains('genres', [match]);
      }
      const type = searchParams.get('type');
      if (type === 'series' || type === 'movie') query = query.eq('type', type);
      const status = searchParams.get('status');
      if (status && ['ongoing', 'completed', 'upcoming'].includes(status)) query = query.eq('status', status);
      const audio = searchParams.get('audio');
      if (audio === 'sub') query = query.eq('is_sub_only', true);
      else if (audio === 'eng') query = query.eq('is_eng_dub', true);
      else if (audio === 'hindi') query = query.eq('is_sub_only', false).eq('is_eng_dub', false);
      if (year && /^\d{4}$/.test(year)) query = query.eq('release_year', Number(year));

      const { data, error } = await query;
      if (cancelled) return;
      if (error || !data) { setAnimeList([]); setIsLoading(false); return; }

      // One batched count query per 150 titles instead of one query per season.
      const counts = new Map<string, number>();
      const ids = data.map(a => a.id);
      for (let i = 0; i < ids.length; i += 150) {
        const { data: seasons } = await supabase.from('seasons').select('anime_id, episodes(count)').in('anime_id', ids.slice(i, i + 150));
        (seasons as { anime_id: string; episodes: { count: number }[] }[] | null)?.forEach(s => {
          counts.set(s.anime_id, (counts.get(s.anime_id) || 0) + (s.episodes?.[0]?.count || 0));
        });
      }
      if (cancelled) return;
      setAnimeList((data as Anime[]).map(a => ({ ...a, episode_count: counts.get(a.id) || 0 })));
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const totalPages = Math.max(1, Math.ceil(animeList.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = animeList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const goToPage = (p: number) => {
    updateParam('page', p > 1 ? String(p) : null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) addToHistory(searchQuery.trim());
    setShowSearchDropdown(false);
    updateParam('q', searchQuery.trim() || null);
  };

  const showSuggestions = searchQuery.trim().length >= 2 && searchSuggestions.length > 0;
  const showHistory = searchQuery.trim().length === 0 && searchHistory.length > 0;

  const pageNumbers = useMemo(() => {
    const set = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1].filter(n => n >= 1 && n <= totalPages));
    const sorted = [...set].sort((a, b) => a - b);
    const out: (number | 'gap')[] = [];
    sorted.forEach((n, i) => { if (i && n - sorted[i - 1] > 1) out.push('gap'); out.push(n); });
    return out;
  }, [currentPage, totalPages]);

  return (
    <div className="min-h-screen catalogue-page-v5 browse-v5 relative">
      <ContentNavTabs />
      <NoEpisodesPopup isOpen={noEpisodesPopup.isOpen} onClose={() => setNoEpisodesPopup({ isOpen: false, animeTitle: '' })} animeTitle={noEpisodesPopup.animeTitle} />

      <div className="container px-4 pt-4 pb-12">
        <h1 className="sr-only">{isSearchMode ? `Search results for ${q}` : 'Browse anime'}</h1>

        {/* Top filter bar */}
        <div className="browse-ra-topbar pb-5 mb-5 border-b border-border">
          <form onSubmit={handleSearch} className="browse-ra-field col-span-2 md:col-span-1">
            <span>Search</span>
            <div className="relative" ref={searchContainerRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                aria-label="Search anime"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearchDropdown(true)}
                className="browse-ra-control pl-8 pr-8 outline-none focus:border-primary/60"
              />
              {searchQuery && (
                <button type="button" aria-label="Clear search" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {showSearchDropdown && (showSuggestions || showHistory) && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-popover border border-border rounded-md shadow-2xl overflow-hidden z-50">
                  {showSuggestions && searchSuggestions.map((s) => (
                    <button key={s.id} type="button" onClick={() => { setShowSearchDropdown(false); addToHistory(s.title); navigate(`/anime/${s.id}`); }} className="flex items-center gap-3 w-full px-3 py-2 hover:bg-muted text-left">
                      <img src={s.cover_image || '/placeholder.svg'} alt="" className="w-8 h-12 rounded object-contain bg-muted" />
                      <span className="min-w-0"><span className="block text-sm line-clamp-1">{s.title}</span><span className="block text-[11px] text-muted-foreground capitalize">{s.type || 'Anime'}</span></span>
                    </button>
                  ))}
                  {showHistory && (
                    <>
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><History className="h-3 w-3" />Recent</span>
                        <button type="button" onClick={clearHistory} className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive">Clear</button>
                      </div>
                      {searchHistory.map((item) => (
                        <div key={item.query} className="flex items-center justify-between px-3 py-1.5 hover:bg-muted group">
                          <button type="button" onClick={() => { setShowSearchDropdown(false); addToHistory(item.query); updateParam('q', item.query); }} className="flex items-center gap-2 flex-1 text-left text-sm"><Search className="h-3.5 w-3.5 text-muted-foreground" />{item.query}</button>
                          <button type="button" aria-label={`Remove ${item.query}`} onClick={() => removeFromHistory(item.query)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </form>

          <label className="browse-ra-field">
            <span>Genres</span>
            <Select value={genre ? genre.toLowerCase() : ANY} onValueChange={(v) => updateParam('genre', v === ANY ? null : v)}>
              <SelectTrigger className="browse-ra-control" aria-label="Genre"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ANY}>Any</SelectItem>
                {ALLOWED_GENRES.map(g => <SelectItem key={g} value={g.toLowerCase()}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>

          <label className="browse-ra-field">
            <span>Year</span>
            <Select value={year || ANY} onValueChange={(v) => updateParam('year', v === ANY ? null : v)}>
              <SelectTrigger className="browse-ra-control" aria-label="Year"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ANY}>Any</SelectItem>
                {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>

          <label className="browse-ra-field">
            <span>Sort</span>
            <Select value={sortBy} onValueChange={(v) => updateParam('sort', v === 'newest' ? null : v)}>
              <SelectTrigger className="browse-ra-control" aria-label="Sort"><SelectValue /></SelectTrigger>
              <SelectContent>{SORTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        </div>

        <div className="browse-ra-layout">
          {/* Left facet sidebar (horizontal strip on phones) */}
          <aside className="browse-ra-facets" aria-label="Filters">
            {FACETS.map(facet => {
              const active = searchParams.get(facet.key);
              return (
                <details key={facet.key} className="browse-ra-facet" open>
                  <summary>{facet.title}<ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform" /></summary>
                  <div className="mt-2">
                    {facet.options.map(opt => (
                      <button key={opt.value} type="button" className="browse-ra-option" aria-pressed={active === opt.value}
                        onClick={() => updateParam(facet.key, active === opt.value ? null : opt.value)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </details>
              );
            })}
          </aside>

          <section aria-label="Results" className="min-w-0">
            <div className="flex items-center justify-between gap-3 mb-4 min-h-6">
              <p className="text-xs text-muted-foreground">
                {isLoading ? 'Loading…' : <>{animeList.length.toLocaleString()} results found{isSearchMode && <> for <span className="text-primary">"{q}"</span></>}</>}
              </p>
              {(isSearchMode || genre || year || FACETS.some(f => searchParams.get(f.key))) && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => { setSearchQuery(''); setSearchParams(new URLSearchParams()); }}>
                  <X className="h-3.5 w-3.5 mr-1" />Clear all
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="browse-ra-grid">
                {Array.from({ length: 18 }).map((_, i) => <div key={i}><div className="aspect-[2/3] rounded-md skeleton-shimmer" /><div className="h-3 mt-2 w-3/4 rounded skeleton-shimmer" /></div>)}
              </div>
            ) : animeList.length === 0 ? (
              <div className="text-center py-20">
                <Search className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">{isSearchMode ? 'No results found' : 'No anime found'}</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {isSearchMode ? `We couldn't find any anime matching "${q}". Try a different search term.` : "Try adjusting your filters to find what you're looking for."}
                </p>
              </div>
            ) : (
              <>
                <div className="browse-ra-grid">
                  {pageItems.map((anime) => (
                    <AnimeCardContextMenu key={anime.id} animeTitle={anime.title} animeUrl={`/anime/${anime.id}`} coverImage={anime.cover_image}>
                      <PosterCard
                        fluid
                        to={`/anime/${anime.id}`}
                        title={anime.title}
                        cover={anime.cover_image}
                        isEngDub={anime.is_eng_dub}
                        isSubOnly={anime.is_sub_only}
                        genres={anime.genres}
                        episodes={anime.episode_count}
                        views={formatViews(getViewCount(anime.title, anime.view_count))}
                        type={anime.type}
                        year={anime.release_year}
                        status={anime.status}
                        tag={isNew(anime.created_at) ? 'NEW' : null}
                        pending={anime.episode_count === 0}
                        onClick={(e) => {
                          if (anime.episode_count === 0) { e.preventDefault(); setNoEpisodesPopup({ isOpen: true, animeTitle: anime.title }); }
                        }}
                      />
                    </AnimeCardContextMenu>
                  ))}
                </div>

                {totalPages > 1 && (
                  <nav aria-label="Pagination" className="flex items-center justify-center gap-2 mt-10">
                    <button type="button" className="browse-ra-page" aria-label="Previous page" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></button>
                    {pageNumbers.map((n, i) => n === 'gap'
                      ? <span key={`gap-${i}`} className="browse-ra-page" aria-hidden>…</span>
                      : <button key={n} type="button" className="browse-ra-page" aria-current={n === currentPage ? 'page' : undefined} onClick={() => goToPage(n)}>{n}</button>)}
                    <button type="button" className="browse-ra-page" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></button>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
